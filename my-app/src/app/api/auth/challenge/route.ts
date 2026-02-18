import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { createChallenge } from '@/lib/mobile-auth';

export const runtime = 'nodejs';

function isValidWalletAddress(wallet: string): boolean {
  try {
    const pk = new PublicKey(wallet);
    return pk.toBase58() === wallet;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.trim() || '';

  if (!wallet) {
    return NextResponse.json({ error: 'wallet query param is required' }, { status: 400 });
  }

  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const challenge = createChallenge(wallet);
  return NextResponse.json(challenge);
}

