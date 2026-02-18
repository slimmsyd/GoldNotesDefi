import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

function lamportsToNumber(input: string): number {
  const lamportsBig = BigInt(input);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (lamportsBig > maxSafe) {
    throw new Error('Lamports value exceeds safe integer range');
  }
  return Number(lamportsBig);
}

export async function buildSolDirectCheckoutTransaction(input: {
  rpcEndpoint: string;
  payerWallet: string;
  merchantWallet: string;
  memo: string;
  expectedLamports: string;
}): Promise<Transaction> {
  const connection = new Connection(input.rpcEndpoint, 'confirmed');
  const payer = new PublicKey(input.payerWallet);
  const merchant = new PublicKey(input.merchantWallet);

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: merchant,
    lamports: lamportsToNumber(input.expectedLamports),
  });

  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(input.memo, 'utf8'),
  });

  const tx = new Transaction().add(transferInstruction, memoInstruction);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  return tx;
}
