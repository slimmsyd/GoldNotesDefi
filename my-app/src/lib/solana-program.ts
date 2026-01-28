/**
 * Solana Program Integration for W3B Protocol
 * Provides functions to read on-chain protocol state
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { PROTOCOL_CONFIG, ProtocolStateData } from './protocol-constants';

// W3B Protocol IDL (minimal version for reading state)
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
          { name: 'w3bMint', type: 'publicKey' },
          { name: 'treasury', type: 'publicKey' },
          { name: 'currentMerkleRoot', type: { array: ['u8', 32] } },
          { name: 'lastRootUpdate', type: 'i64' },
          { name: 'lastProofTimestamp', type: 'i64' },
          { name: 'provenReserves', type: 'u64' },
          { name: 'totalSupply', type: 'u64' },
          { name: 'isPaused', type: 'bool' },
          { name: 'bump', type: 'u8' },
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

// Raw account data decoder (without full Anchor provider)
export async function fetchProtocolStateRaw(): Promise<ProtocolStateData | null> {
  const connection = getConnection();
  const protocolStatePubkey = getProtocolStatePDA();

  try {
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'solana-program.ts:55',message:'fetchProtocolStateRaw:begin',data:{rpcEndpoint:PROTOCOL_CONFIG.rpcEndpoint,protocolState:protocolStatePubkey.toBase58()},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion agent log
    const accountInfo = await connection.getAccountInfo(protocolStatePubkey);
    
    if (!accountInfo) {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'solana-program.ts:61',message:'fetchProtocolStateRaw:accountInfo:null',data:{protocolState:protocolStatePubkey.toBase58()},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion agent log
      console.warn('Protocol state account not found');
      return null;
    }

    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'solana-program.ts:67',message:'fetchProtocolStateRaw:accountInfo:ok',data:{dataLength:accountInfo.data.length,owner:accountInfo.owner?.toBase58?.() ?? 'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion agent log

    // Manual deserialization of the ProtocolState account
    // Layout: 8 (discriminator) + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1
    const data = accountInfo.data;
    let offset = 8; // Skip discriminator

    const authority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const w3bMint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const treasury = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const currentMerkleRoot = new Uint8Array(data.slice(offset, offset + 32));
    offset += 32;

    // Read i64 as little-endian
    const lastRootUpdate = Number(data.readBigInt64LE(offset));
    offset += 8;

    const lastProofTimestamp = Number(data.readBigInt64LE(offset));
    offset += 8;

    // Read u64 as little-endian
    const provenReserves = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const totalSupply = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const isPaused = data[offset] === 1;
    offset += 1;

    const bump = data[offset];

    return {
      authority,
      w3bMint,
      treasury,
      currentMerkleRoot,
      lastRootUpdate,
      lastProofTimestamp,
      provenReserves,
      totalSupply,
      isPaused,
      bump,
    };
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'solana-program.ts:114',message:'fetchProtocolStateRaw:error',data:{message:error instanceof Error ? error.message : 'unknown',name:error instanceof Error ? error.name : 'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion agent log
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
