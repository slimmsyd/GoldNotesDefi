import { env } from '../../config/env';
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey(env.wgbProgramId);
export const WGB_MINT = new PublicKey(env.wgbMint);
export const TREASURY = new PublicKey(env.wgbTreasury);
export const PROTOCOL_STATE_PDA = new PublicKey(env.wgbProtocolState);
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const BUY_WGB_DISCRIMINATOR = new Uint8Array([32, 152, 242, 112, 159, 221, 39, 173]);
const BURN_WGB_DISCRIMINATOR = new Uint8Array([207, 123, 197, 201, 16, 132, 251, 254]);
const INIT_USER_PROFILE_DISCRIMINATOR = new Uint8Array([148, 35, 126, 247, 28, 169, 135, 175]);

function writeU64LE(value: bigint, buffer: Uint8Array, offset: number): void {
  for (let i = 0; i < 8; i += 1) {
    buffer[offset + i] = Number((value >> BigInt(i * 8)) & BigInt(0xff));
  }
}

export async function fetchWgbPriceLamports(connection: Connection): Promise<bigint> {
  const accountInfo = await connection.getAccountInfo(PROTOCOL_STATE_PDA);
  if (!accountInfo) {
    throw new Error('Protocol state not found');
  }

  return accountInfo.data.readBigUInt64LE(208);
}

export async function fetchSolReceiver(connection: Connection): Promise<PublicKey> {
  const accountInfo = await connection.getAccountInfo(PROTOCOL_STATE_PDA);
  if (!accountInfo) {
    throw new Error('Protocol state not found');
  }

  const receiverBytes = accountInfo.data.slice(216, 248);
  return new PublicKey(receiverBytes);
}

export async function getUserWgbTokenAccount(userPubkey: PublicKey): Promise<PublicKey> {
  const [ata] = PublicKey.findProgramAddressSync(
    [userPubkey.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), WGB_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

export function getUserProfilePDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_profile'), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}

export function getRedemptionRequestPDA(userPubkey: PublicKey, requestId: bigint): [PublicKey, number] {
  const idBuffer = Buffer.alloc(8);
  writeU64LE(requestId, idBuffer, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('redemption'), userPubkey.toBuffer(), idBuffer],
    PROGRAM_ID
  );
}

export function createInitUserProfileInstruction(user: PublicKey): TransactionInstruction {
  const [userProfilePda] = getUserProfilePDA(user);
  const data = new Uint8Array(8);
  data.set(INIT_USER_PROFILE_DISCRIMINATOR, 0);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: userProfilePda, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export async function maybeCreateInitUserProfileInstruction(
  connection: Connection,
  user: PublicKey
): Promise<TransactionInstruction | null> {
  const [userProfilePda] = getUserProfilePDA(user);
  const existing = await connection.getAccountInfo(userProfilePda);
  if (existing) return null;
  return createInitUserProfileInstruction(user);
}

export function createBuyWgbInstruction(
  buyer: PublicKey,
  buyerTokenAccount: PublicKey,
  solReceiver: PublicKey,
  amount: bigint
): TransactionInstruction {
  const data = new Uint8Array(16);
  data.set(BUY_WGB_DISCRIMINATOR, 0);
  writeU64LE(amount, data, 8);
  const [userProfilePda] = getUserProfilePDA(buyer);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: PROTOCOL_STATE_PDA, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TREASURY, isSigner: false, isWritable: true },
      { pubkey: solReceiver, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: userProfilePda, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
}

export function createAssociatedWgbTokenAccountInstruction(
  payer: PublicKey,
  owner: PublicKey,
  associatedTokenAddress: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: WGB_MINT, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
}

export function createBurnWgbInstruction(
  user: PublicKey,
  userTokenAccount: PublicKey,
  amount: bigint,
  requestId: bigint
): TransactionInstruction {
  const [redemptionPda] = getRedemptionRequestPDA(user, requestId);
  const [userProfilePda] = getUserProfilePDA(user);

  const data = new Uint8Array(24);
  data.set(BURN_WGB_DISCRIMINATOR, 0);
  writeU64LE(amount, data, 8);
  writeU64LE(requestId, data, 16);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: PROTOCOL_STATE_PDA, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: WGB_MINT, isSigner: false, isWritable: true },
      { pubkey: redemptionPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: userProfilePda, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
}

export async function fetchUserWgbBalance(connection: Connection, userPubkey: PublicKey): Promise<bigint> {
  const tokenAccount = await getUserWgbTokenAccount(userPubkey);
  const accountInfo = await connection.getAccountInfo(tokenAccount);
  if (!accountInfo) return BigInt(0);
  return accountInfo.data.readBigUInt64LE(64);
}

export function generateRequestId(): bigint {
  return BigInt(Date.now());
}
