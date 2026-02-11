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
// These are computed from anchor's instruction naming convention: sha256("global:<name>")[0..8]
const BUY_W3B_DISCRIMINATOR = new Uint8Array([32, 152, 242, 112, 159, 221, 39, 173]);
const BURN_W3B_DISCRIMINATOR = new Uint8Array([207, 123, 197, 201, 16, 132, 251, 254]);
const INIT_USER_PROFILE_DISCRIMINATOR = new Uint8Array([148, 35, 126, 247, 28, 169, 135, 175]);

/**
 * Fetch the current W3B price in lamports from on-chain state
 */
export async function fetchW3bPriceLamports(connection: Connection): Promise<bigint> {
  const accountInfo = await connection.getAccountInfo(PROTOCOL_STATE_PDA);
  if (!accountInfo) {
    throw new Error('Protocol state not found');
  }
  
  // Read w3b_price_lamports at V2 offset 208
  // V2 Layout: 8 (disc) + 32 (authority) + 32 (operator) + 32 (w3bMint) + 32 (treasury)
  //   + 8 (totalSupply) + 8 (totalBurned) + 32 (merkleRoot) + 8 (provenReserves)
  //   + 8 (lastRootUpdate) + 8 (lastProofTimestamp) = 208
  const priceOffset = 208;
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
  
  // Read sol_receiver at V2 offset 216 (after w3b_price_lamports)
  const receiverOffset = 216;
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

  const [userProfilePda] = getUserProfilePDA(buyer);

  // Account metas for buy_w3b instruction
  const keys = [
    { pubkey: PROTOCOL_STATE_PDA, isSigner: false, isWritable: false },
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TREASURY, isSigner: false, isWritable: true },
    { pubkey: solReceiver, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: userProfilePda, isSigner: false, isWritable: true },
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

/**
 * Derive the UserProfile PDA for a given user
 */
export function getUserProfilePDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_profile'), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive the RedemptionRequest PDA for a given user + request_id
 */
export function getRedemptionRequestPDA(
  userPubkey: PublicKey,
  requestId: bigint
): [PublicKey, number] {
  const idBuffer = Buffer.alloc(8);
  idBuffer.writeBigUInt64LE(requestId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('redemption'), userPubkey.toBuffer(), idBuffer],
    PROGRAM_ID
  );
}

/**
 * Create an init_user_profile instruction
 */
export function createInitUserProfileInstruction(
  user: PublicKey
): TransactionInstruction {
  const [userProfilePda] = getUserProfilePDA(user);

  const data = new Uint8Array(8);
  data.set(INIT_USER_PROFILE_DISCRIMINATOR, 0);

  const keys = [
    { pubkey: userProfilePda, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.from(data),
  });
}

/**
 * Build an init_user_profile instruction only if the PDA is missing.
 * This lets first-time wallets execute buy/burn in the same transaction.
 */
export async function maybeCreateInitUserProfileInstruction(
  connection: Connection,
  user: PublicKey
): Promise<TransactionInstruction | null> {
  const [userProfilePda] = getUserProfilePDA(user);
  const existingProfile = await connection.getAccountInfo(userProfilePda);

  if (existingProfile) {
    return null;
  }

  return createInitUserProfileInstruction(user);
}

/**
 * Create a burn_w3b instruction (Burn-to-Redeem)
 *
 * @param user - The user burning tokens (signer)
 * @param userTokenAccount - The user's W3B token account
 * @param amount - Amount of W3B tokens to burn
 * @param requestId - Sequential redemption request ID
 */
export function createBurnW3bInstruction(
  user: PublicKey,
  userTokenAccount: PublicKey,
  amount: bigint,
  requestId: bigint
): TransactionInstruction {
  const [redemptionPda] = getRedemptionRequestPDA(user, requestId);
  const [userProfilePda] = getUserProfilePDA(user);

  // Serialize instruction data: discriminator + amount (u64) + request_id (u64)
  const data = new Uint8Array(24);
  data.set(BURN_W3B_DISCRIMINATOR, 0);
  writeU64LE(amount, data, 8);
  writeU64LE(requestId, data, 16);

  // Account metas for burn_w3b instruction
  const keys = [
    { pubkey: PROTOCOL_STATE_PDA, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: W3B_MINT, isSigner: false, isWritable: true },
    { pubkey: redemptionPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: userProfilePda, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.from(data),
  });
}

/**
 * Fetch the user's W3B token balance
 */
export async function fetchUserW3bBalance(
  connection: Connection,
  userPubkey: PublicKey
): Promise<bigint> {
  const tokenAccount = await getUserW3bTokenAccount(userPubkey);
  const accountInfo = await connection.getAccountInfo(tokenAccount);
  if (!accountInfo) return BigInt(0);

  // SPL Token-2022 account layout: amount is at offset 64 (8 bytes LE)
  const amount = accountInfo.data.readBigUInt64LE(64);
  return amount;
}

/**
 * Generate a unique request ID based on current timestamp
 * In production, this should query the chain/DB for the next unused ID
 */
export function generateRequestId(): bigint {
  return BigInt(Date.now());
}
