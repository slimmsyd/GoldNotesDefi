/**
 * W3B Program Client
 * Helper functions to interact with the W3B Protocol on Solana
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PROTOCOL_CONFIG } from './protocol-constants';

// Program addresses
export const PROGRAM_ID = new PublicKey(PROTOCOL_CONFIG.programId);
export const W3B_MINT = new PublicKey(PROTOCOL_CONFIG.w3bMint);
export const TREASURY = new PublicKey(PROTOCOL_CONFIG.treasury);
export const PROTOCOL_STATE_PDA = new PublicKey(PROTOCOL_CONFIG.protocolState);

// Instruction discriminators (first 8 bytes of sha256 hash of instruction name)
// These are computed from anchor's instruction naming convention
const BUY_W3B_DISCRIMINATOR = new Uint8Array([32, 152, 242, 112, 159, 221, 39, 173]); // sha256("global:buy_w3b")[0..8]

/**
 * Fetch the current W3B price in lamports from on-chain state
 */
export async function fetchW3bPriceLamports(connection: Connection): Promise<bigint> {
  const accountInfo = await connection.getAccountInfo(PROTOCOL_STATE_PDA);
  if (!accountInfo) {
    throw new Error('Protocol state not found');
  }
  
  // Read w3b_price_lamports from offset 170 (after all other fields)
  // Layout: 8 (disc) + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 = 170
  const priceOffset = 170;
  const priceLamports = accountInfo.data.readBigUInt64LE(priceOffset);
  return priceLamports;
}

/**
 * Fetch the SOL receiver address from on-chain state
 */
export async function fetchSolReceiver(connection: Connection): Promise<PublicKey> {
  const accountInfo = await connection.getAccountInfo(PROTOCOL_STATE_PDA);
  if (!accountInfo) {
    throw new Error('Protocol state not found');
  }
  
  // Read sol_receiver from offset 178
  const receiverOffset = 178;
  const receiverBytes = accountInfo.data.slice(receiverOffset, receiverOffset + 32);
  return new PublicKey(receiverBytes);
}

/**
 * Write a u64 (BigInt) as little-endian bytes into a Uint8Array
 */
function writeU64LE(value: bigint, buffer: Uint8Array, offset: number): void {
  for (let i = 0; i < 8; i++) {
    buffer[offset + i] = Number((value >> BigInt(i * 8)) & BigInt(0xff));
  }
}

/**
 * Create a buy_w3b instruction
 * 
 * @param buyer - The buyer's public key (signer)
 * @param buyerTokenAccount - The buyer's W3B token account
 * @param solReceiver - The SOL receiver address
 * @param amount - Amount of W3B tokens to buy (in base units, 0 decimals)
 */
export function createBuyW3bInstruction(
  buyer: PublicKey,
  buyerTokenAccount: PublicKey,
  solReceiver: PublicKey,
  amount: bigint
): TransactionInstruction {
  // Serialize instruction data: discriminator + amount (u64)
  const data = new Uint8Array(16);
  // Copy discriminator
  data.set(BUY_W3B_DISCRIMINATOR, 0);
  // Write amount as u64 little-endian
  writeU64LE(amount, data, 8);

  // Account metas for buy_w3b instruction
  const keys = [
    { pubkey: PROTOCOL_STATE_PDA, isSigner: false, isWritable: false },
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TREASURY, isSigner: false, isWritable: true },
    { pubkey: solReceiver, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.from(data),
  });
}

/**
 * Get the user's W3B token account address
 */
export async function getUserW3bTokenAccount(userPubkey: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(
    W3B_MINT,
    userPubkey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

/**
 * Calculate how much SOL is needed for a given W3B amount
 */
export function calculateSolCost(amount: bigint, priceLamports: bigint): number {
  return Number(amount * priceLamports) / LAMPORTS_PER_SOL;
}
