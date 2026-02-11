/**
 * On-Chain Price Sync
 * 
 * Calls `set_w3b_price` on the Solana program to update the on-chain
 * lamports price, keeping it in sync with the scraped Goldback USD rate.
 * 
 * Uses the same authority keypair that auto-verify uses.
 */

import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN, setProvider } from '@coral-xyz/anchor';
import { PROTOCOL_CONFIG } from './protocol-constants';

// Reuse the NodeWallet from auto-verify
class NodeWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey { return this.payer.publicKey; }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map(tx => { if (tx instanceof Transaction) tx.partialSign(this.payer); return tx; });
  }
}

// Minimal IDL — V2 layout with operator-based set_w3b_price
const PRICE_IDL = {
  version: '0.1.0',
  name: 'w3b_protocol',
  instructions: [
    {
      name: 'setW3bPrice',
      accounts: [
        { name: 'protocolState', isMut: true, isSigner: false },
        { name: 'operator', isMut: false, isSigner: true },
      ],
      args: [{ name: 'priceLamports', type: 'u64' }],
    },
  ],
  accounts: [
    {
      name: 'ProtocolState',
      type: {
        kind: 'struct' as const,
        fields: [
          { name: 'authority', type: 'publicKey' },
          { name: 'operator', type: 'publicKey' },
          { name: 'w3bMint', type: 'publicKey' },
          { name: 'treasury', type: 'publicKey' },
          { name: 'totalSupply', type: 'u64' },
          { name: 'totalBurned', type: 'u64' },
          { name: 'currentMerkleRoot', type: { array: ['u8', 32] } },
          { name: 'provenReserves', type: 'u64' },
          { name: 'lastRootUpdate', type: 'i64' },
          { name: 'lastProofTimestamp', type: 'i64' },
          { name: 'w3bPriceLamports', type: 'u64' },
          { name: 'solReceiver', type: 'publicKey' },
          { name: 'yieldApyBps', type: 'u16' },
          { name: 'totalYieldDistributed', type: 'u64' },
          { name: 'lastYieldDistribution', type: 'i64' },
          { name: 'isPaused', type: 'bool' },
          { name: 'bump', type: 'u8' },
          { name: '_reserved', type: { array: ['u8', 64] } },
        ],
      },
    },
  ],
  metadata: { address: PROTOCOL_CONFIG.programId },
};

/**
 * Sync the on-chain W3B price to match the current Goldback rate.
 * 
 * @param newLamportsPrice - The calculated lamports price to set
 * @returns Object with tx hash and details, or null if skipped/failed
 */
export async function syncOnChainPrice(
  newLamportsPrice: number
): Promise<{ tx: string; oldPrice: number; newPrice: number } | null> {
  // 1. Load authority keypair
  const keypairEnv = process.env.PROTOCOL_AUTHORITY_KEYPAIR;
  if (!keypairEnv) {
    console.warn('[price-sync] PROTOCOL_AUTHORITY_KEYPAIR not set, skipping on-chain sync');
    return null;
  }

  let authority: Keypair;
  try {
    authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairEnv)));
  } catch {
    console.error('[price-sync] Invalid PROTOCOL_AUTHORITY_KEYPAIR format');
    return null;
  }

  // 2. Connect to Solana
  const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || PROTOCOL_CONFIG.rpcEndpoint;
  const connection = new Connection(rpcEndpoint, 'confirmed');
  const programId = new PublicKey(PROTOCOL_CONFIG.programId);

  // 3. Setup Anchor
  const wallet = new NodeWallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  setProvider(provider);

  const program = new Program(PRICE_IDL as any, provider);

  // 4. Find PDA
  const [protocolStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_state')],
    programId
  );

  // 5. Read current on-chain price to compare
  let currentPriceLamports = 0;
  try {
    const state = await (program.account as any).protocolState.fetch(protocolStatePda);
    currentPriceLamports = (state as any).w3bPriceLamports.toNumber();
  } catch (err) {
    console.warn('[price-sync] Could not read current on-chain price:', err);
  }

  // 6. Skip if price hasn't changed meaningfully (within 1%)
  if (currentPriceLamports > 0) {
    const driftPercent = Math.abs(newLamportsPrice - currentPriceLamports) / currentPriceLamports * 100;
    if (driftPercent < 1) {
      console.log(`[price-sync] Price drift is only ${driftPercent.toFixed(2)}%, skipping update`);
      return null;
    }
    console.log(`[price-sync] Price drift: ${driftPercent.toFixed(2)}% (${currentPriceLamports} → ${newLamportsPrice} lamports)`);
  }

  // 7. Call set_w3b_price
  try {
    const tx = await (program.methods as any)
      .setW3bPrice(new BN(newLamportsPrice))
      .accountsPartial({
        protocolState: protocolStatePda,
        operator: authority.publicKey,
      })
      .rpc();

    console.log(`[price-sync] ✅ On-chain price updated: ${currentPriceLamports} → ${newLamportsPrice} lamports (tx: ${tx})`);

    return {
      tx,
      oldPrice: currentPriceLamports,
      newPrice: newLamportsPrice,
    };
  } catch (err) {
    console.error('[price-sync] Failed to update on-chain price:', err);
    return null;
  }
}

/**
 * Read the current on-chain W3B price in lamports (read-only, no keypair needed).
 */
export async function getOnChainPriceLamports(): Promise<number | null> {
  try {
    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || PROTOCOL_CONFIG.rpcEndpoint;
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const programId = new PublicKey(PROTOCOL_CONFIG.programId);

    const [protocolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('protocol_state')],
      programId
    );

    const accountInfo = await connection.getAccountInfo(protocolStatePda);
    if (!accountInfo) return null;

    // Read w3b_price_lamports at V2 offset 208
    const priceLamports = accountInfo.data.readBigUInt64LE(208);
    return Number(priceLamports);
  } catch {
    return null;
  }
}
