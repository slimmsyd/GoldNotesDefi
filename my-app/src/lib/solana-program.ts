/**
 * Solana Program Integration for W3B Protocol
 * Provides functions to read on-chain protocol state
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { PROTOCOL_CONFIG, ProtocolStateData } from './protocol-constants';

// W3B Protocol IDL — V2 layout (minimal version for reading state)
const W3B_IDL: Idl = {
  version: '0.1.0',
  name: 'w3b_protocol',
  instructions: [],
  accounts: [
    {
      name: 'ProtocolState',
      type: {
        kind: 'struct',
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
  errors: [],
  metadata: {
    address: PROTOCOL_CONFIG.programId,
  },
};

// Create a read-only connection
export function getConnection(): Connection {
  return new Connection(PROTOCOL_CONFIG.rpcEndpoint, 'confirmed');
}

// Get the Protocol State PDA
export function getProtocolStatePDA(): PublicKey {
  return new PublicKey(PROTOCOL_CONFIG.protocolState);
}

// Raw account data decoder — V2 layout (without full Anchor provider)
export async function fetchProtocolStateRaw(): Promise<ProtocolStateData | null> {
  const connection = getConnection();
  const protocolStatePubkey = getProtocolStatePDA();

  try {
    const accountInfo = await connection.getAccountInfo(protocolStatePubkey);
    
    if (!accountInfo) {
      console.warn('Protocol state account not found');
      return null;
    }

    // Manual deserialization of the V2 ProtocolState account
    // V2 Layout:
    //   8  discriminator
    //  32  authority        (offset  8)
    //  32  operator         (offset 40)
    //  32  w3bMint          (offset 72)
    //  32  treasury         (offset 104)
    //   8  totalSupply      (offset 136)
    //   8  totalBurned      (offset 144)
    //  32  currentMerkleRoot(offset 152)
    //   8  provenReserves   (offset 184)
    //   8  lastRootUpdate   (offset 192)
    //   8  lastProofTimestamp(offset 200)
    //   8  w3bPriceLamports (offset 208)
    //  32  solReceiver      (offset 216)
    //   2  yieldApyBps      (offset 248)
    //   8  totalYieldDist   (offset 250)
    //   8  lastYieldDist    (offset 258)
    //   1  isPaused         (offset 266)
    //   1  bump             (offset 267)
    //  64  _reserved        (offset 268)
    const data = accountInfo.data;
    let offset = 8; // Skip discriminator

    const authority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32; // 40

    const operator = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32; // 72

    const w3bMint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32; // 104

    const treasury = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32; // 136

    const totalSupply = Number(data.readBigUInt64LE(offset));
    offset += 8; // 144

    const totalBurned = Number(data.readBigUInt64LE(offset));
    offset += 8; // 152

    const currentMerkleRoot = new Uint8Array(data.slice(offset, offset + 32));
    offset += 32; // 184

    const provenReserves = Number(data.readBigUInt64LE(offset));
    offset += 8; // 192

    const lastRootUpdate = Number(data.readBigInt64LE(offset));
    offset += 8; // 200

    const lastProofTimestamp = Number(data.readBigInt64LE(offset));
    offset += 8; // 208

    const w3bPriceLamports = Number(data.readBigUInt64LE(offset));
    offset += 8; // 216

    const solReceiver = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32; // 248

    const yieldApyBps = data.readUInt16LE(offset);
    offset += 2; // 250

    const totalYieldDistributed = Number(data.readBigUInt64LE(offset));
    offset += 8; // 258

    const lastYieldDistribution = Number(data.readBigInt64LE(offset));
    offset += 8; // 266

    const isPaused = data[offset] === 1;
    offset += 1; // 267

    const bump = data[offset];

    return {
      authority,
      operator,
      w3bMint,
      treasury,
      totalSupply,
      totalBurned,
      currentMerkleRoot,
      provenReserves,
      lastRootUpdate,
      lastProofTimestamp,
      w3bPriceLamports,
      solReceiver,
      yieldApyBps,
      totalYieldDistributed,
      lastYieldDistribution,
      isPaused,
      bump,
    };
  } catch (error) {
    console.error('Error fetching protocol state:', error);
    throw error;
  }
}

// Helper to convert merkle root bytes to hex string
export function merkleRootToHex(root: Uint8Array): string {
  return '0x' + Array.from(root).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to format timestamp
export function timestampToDate(timestamp: number): Date | null {
  if (timestamp === 0) return null;
  return new Date(timestamp * 1000);
}

// Calculate solvency status
export function calculateSolvency(supply: number, reserves: number): {
  isSolvent: boolean;
  ratio: number;
} {
  if (supply === 0) {
    return { isSolvent: true, ratio: Infinity };
  }
  const ratio = reserves / supply;
  return {
    isSolvent: reserves >= supply,
    ratio,
  };
}
