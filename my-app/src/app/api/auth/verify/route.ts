import { NextRequest, NextResponse } from 'next/server';
import {
  canUseDevSigner,
  issueAuthToken,
  validateChallengePayload,
  verifySolanaEd25519Signature,
  verifyDevHmac,
} from '@/lib/mobile-auth';

export const runtime = 'nodejs';

interface AuthVerifyRequestBody {
  wallet?: string;
  timestamp?: number;
  nonce?: string;
  message?: string;
  method?: 'dev_hmac' | 'solana_ed25519';
  signature?: string;
}

export async function POST(request: NextRequest) {
  let body: AuthVerifyRequestBody;
  try {
    body = (await request.json()) as AuthVerifyRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const wallet = body.wallet?.trim() || '';
  const timestamp = body.timestamp;
  const nonce = body.nonce?.trim() || '';
  const message = body.message || '';
  const method = body.method;
  const signature = body.signature || '';

  const challengeValidation = validateChallengePayload({
    wallet,
    timestamp: Number(timestamp),
    nonce,
    message,
  });

  if (!challengeValidation.valid) {
    return NextResponse.json({ error: challengeValidation.error || 'Invalid challenge payload' }, { status: 400 });
  }

  if (method === 'dev_hmac') {
    if (!canUseDevSigner()) {
      return NextResponse.json({ error: 'dev_hmac auth method is disabled' }, { status: 403 });
    }

    const verified = verifyDevHmac({ message, signature });
    if (!verified.valid) {
      return NextResponse.json({ error: verified.error || 'Signature verification failed' }, { status: 401 });
    }
  } else if (method === 'solana_ed25519') {
    const verified = verifySolanaEd25519Signature({
      wallet,
      message,
      signature,
    });
    if (!verified.valid) {
      return NextResponse.json({ error: verified.error || 'Signature verification failed' }, { status: 401 });
    }
  } else {
    return NextResponse.json({ error: 'Unsupported verification method' }, { status: 400 });
  }

  const { token, expiresAt } = await issueAuthToken(wallet);

  return NextResponse.json({
    success: true,
    token,
    expiresAt,
    wallet,
  });
}
