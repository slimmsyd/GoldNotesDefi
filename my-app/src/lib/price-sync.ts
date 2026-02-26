import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN, setProvider } from '@coral-xyz/anchor';
import { PROTOCOL_CONFIG } from './protocol-constants';

class NodeWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map((tx) => {
      if (tx instanceof Transaction) tx.partialSign(this.payer);
      return tx;
    });
  }
}

const PRICE_IDL_FALLBACK = {
  address: PROTOCOL_CONFIG.programId,
  version: '0.1.0',
  name: 'wgb_protocol',
  instructions: [
    {
      name: 'set_wgb_price',
      accounts: [
        { name: 'protocol_state', isMut: true, isSigner: false },
        { name: 'operator', isMut: false, isSigner: true },
      ],
      args: [{ name: 'price_lamports', type: 'u64' }],
    },
    {
      name: 'set_wgb_price_admin',
      accounts: [
        { name: 'protocol_state', isMut: true, isSigner: false },
        { name: 'authority', isMut: false, isSigner: true },
      ],
      args: [{ name: 'price', type: 'u64' }],
    },
  ],
  metadata: {
    name: 'wgb_protocol',
    version: '0.1.0',
    address: PROTOCOL_CONFIG.programId,
  },
};

export interface SyncOnChainPriceOptions {
  allowAdminOverride?: boolean;
}

export interface SyncOnChainPriceResult {
  tx: string | null;
  oldPrice: number;
  newPrice: number;
  mode: 'noop' | 'operator' | 'admin_override';
}

export type PriceSyncErrorCode =
  | 'PROGRAM_INIT_FAILED'
  | 'STATE_READ_FAILED'
  | 'SET_PRICE_FAILED'
  | 'ADMIN_OVERRIDE_FAILED';

export class PriceSyncError extends Error {
  readonly code: PriceSyncErrorCode;
  readonly stage: PriceSyncErrorCode;

  constructor(code: PriceSyncErrorCode, message: string) {
    super(message);
    this.name = 'PriceSyncError';
    this.code = code;
    this.stage = code;
  }
}

export function getPriceSyncErrorContext(error: unknown): {
  code: PriceSyncErrorCode | 'UNKNOWN';
  stage: PriceSyncErrorCode | 'UNKNOWN';
  message: string;
} {
  if (error instanceof PriceSyncError) {
    return {
      code: error.code,
      stage: error.stage,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      stage: 'UNKNOWN',
      message: error.message,
    };
  }

  return {
    code: 'UNKNOWN',
    stage: 'UNKNOWN',
    message: String(error),
  };
}

function loadAuthorityKeypair(): Keypair {
  const keypairEnv = process.env.PROTOCOL_AUTHORITY_KEYPAIR;
  if (!keypairEnv) {
    throw new Error('PROTOCOL_AUTHORITY_KEYPAIR not set');
  }

  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairEnv)));
  } catch {
    throw new Error('Invalid PROTOCOL_AUTHORITY_KEYPAIR format');
  }
}

function normalizeIdlAddress(idl: any, address: string): any {
  return {
    ...idl,
    address,
    metadata: {
      ...(idl?.metadata ?? {}),
      address,
    },
  };
}

function loadProtocolIdl(programId: PublicKey): any {
  const idlAddress = programId.toBase58();
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, '../w3b-token/programs/w3b_protocol/target/idl/wgb_protocol.json'),
    path.resolve(cwd, 'w3b-token/programs/w3b_protocol/target/idl/wgb_protocol.json'),
    path.resolve(cwd, '../../w3b-token/programs/w3b_protocol/target/idl/wgb_protocol.json'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      return normalizeIdlAddress(parsed, idlAddress);
    } catch (error) {
      console.warn(`[price-sync] Failed to parse IDL at ${candidate}:`, error);
    }
  }

  return normalizeIdlAddress(PRICE_IDL_FALLBACK, idlAddress);
}

function getProgram(connection: Connection, authority: Keypair): Program {
  const wallet = new NodeWallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  setProvider(provider);

  const programId = new PublicKey(PROTOCOL_CONFIG.programId);
  const idl = loadProtocolIdl(programId);
  return new Program(idl as any, provider);
}

function isPriceGuardError(message: string): boolean {
  return message.includes('PriceChangeExceedsLimit');
}

export async function syncOnChainPrice(
  newLamportsPrice: number,
  options: SyncOnChainPriceOptions = {}
): Promise<SyncOnChainPriceResult> {
  if (!Number.isFinite(newLamportsPrice) || newLamportsPrice <= 0) {
    throw new PriceSyncError(
      'SET_PRICE_FAILED',
      'SET_PRICE_FAILED: newLamportsPrice must be a positive number'
    );
  }

  const authority = loadAuthorityKeypair();
  const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || PROTOCOL_CONFIG.rpcEndpoint;
  const connection = new Connection(rpcEndpoint, 'confirmed');
  let program: Program;
  try {
    program = getProgram(connection, authority);
  } catch (error) {
    const message = getPriceSyncErrorContext(error).message;
    throw new PriceSyncError('PROGRAM_INIT_FAILED', `PROGRAM_INIT_FAILED: ${message}`);
  }

  const methods = program.methods as any;
  const programId = new PublicKey(PROTOCOL_CONFIG.programId);
  const [protocolStatePda] = PublicKey.findProgramAddressSync([Buffer.from('protocol_state')], programId);

  let currentPriceLamports = 0;
  try {
    const state = await (program.account as any).protocolState.fetch(protocolStatePda);
    currentPriceLamports = Number((state as any).wgbPriceLamports?.toString?.() ?? 0);
  } catch (err) {
    const message = getPriceSyncErrorContext(err).message;
    throw new PriceSyncError('STATE_READ_FAILED', `STATE_READ_FAILED: ${message}`);
  }

  if (currentPriceLamports > 0) {
    const driftPercent = Math.abs(newLamportsPrice - currentPriceLamports) / currentPriceLamports * 100;
    if (driftPercent < 1) {
      return {
        tx: null,
        oldPrice: currentPriceLamports,
        newPrice: newLamportsPrice,
        mode: 'noop',
      };
    }
  }

  const setOperatorBuilder =
    methods.setWgbPrice?.(new BN(newLamportsPrice)) ??
    methods.setWgbPrice?.(new BN(newLamportsPrice)) ??
    methods.set_wgb_price?.(new BN(newLamportsPrice));

  if (!setOperatorBuilder) {
    throw new PriceSyncError(
      'SET_PRICE_FAILED',
      'SET_PRICE_FAILED: set_wgb_price method not found in program IDL'
    );
  }

  try {
    const tx = await setOperatorBuilder
      .accountsPartial({
        protocolState: protocolStatePda,
        operator: authority.publicKey,
      })
      .rpc();

    return {
      tx,
      oldPrice: currentPriceLamports,
      newPrice: newLamportsPrice,
      mode: 'operator',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!options.allowAdminOverride || !isPriceGuardError(message)) {
      throw new PriceSyncError('SET_PRICE_FAILED', `SET_PRICE_FAILED: ${message}`);
    }

    const setAdminBuilder =
      methods.setWgbPriceAdmin?.(new BN(newLamportsPrice)) ??
      methods.setWgbPriceAdmin?.(new BN(newLamportsPrice)) ??
      methods.set_wgb_price_admin?.(new BN(newLamportsPrice));

    if (!setAdminBuilder) {
      throw new PriceSyncError(
        'ADMIN_OVERRIDE_FAILED',
        'ADMIN_OVERRIDE_FAILED: Price guard exceeded and set_wgb_price_admin method not found'
      );
    }

    let adminTx: string;
    try {
      adminTx = await setAdminBuilder
        .accountsPartial({
          protocolState: protocolStatePda,
          authority: authority.publicKey,
        })
        .rpc();
    } catch (adminErr) {
      const adminMessage = getPriceSyncErrorContext(adminErr).message;
      throw new PriceSyncError(
        'ADMIN_OVERRIDE_FAILED',
        `ADMIN_OVERRIDE_FAILED: ${adminMessage}`
      );
    }

    return {
      tx: adminTx,
      oldPrice: currentPriceLamports,
      newPrice: newLamportsPrice,
      mode: 'admin_override',
    };
  }
}

/**
 * Read current on-chain WGB price in lamports (offset 208 in V2 ProtocolState).
 */
export async function getOnChainPriceLamports(): Promise<number | null> {
  try {
    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || PROTOCOL_CONFIG.rpcEndpoint;
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const programId = new PublicKey(PROTOCOL_CONFIG.programId);
    const [protocolStatePda] = PublicKey.findProgramAddressSync([Buffer.from('protocol_state')], programId);
    const accountInfo = await connection.getAccountInfo(protocolStatePda, 'confirmed');
    if (!accountInfo || accountInfo.data.length < 216) return null;
    return Number(accountInfo.data.readBigUInt64LE(208));
  } catch {
    return null;
  }
}
