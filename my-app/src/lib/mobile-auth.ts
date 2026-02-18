import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

const DEFAULT_TOKEN_TTL_SECONDS = 900;
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

export interface AuthenticatedRequestContext {
  walletAddress: string;
  source: 'bearer' | 'header';
}

export interface ResolvedAuthRequest {
  context: AuthenticatedRequestContext | null;
  error: string | null;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.MOBILE_AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('MOBILE_AUTH_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

function getTokenTtlSeconds(): number {
  const raw = process.env.MOBILE_AUTH_TOKEN_TTL_SECONDS;
  const parsed = Number.parseInt(raw || '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_TOKEN_TTL_SECONDS;
}

function isValidWalletAddress(wallet: string): boolean {
  try {
    const pk = new PublicKey(wallet);
    return pk.toBase58() === wallet;
  } catch {
    return false;
  }
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function buildMobileAuthMessage(wallet: string, timestamp: number, nonce: string): string {
  return [
    'GoldBack Mobile Auth',
    `wallet:${wallet}`,
    `timestamp:${timestamp}`,
    `nonce:${nonce}`,
    'action:mobile_api_access',
  ].join('\n');
}

export function createChallenge(wallet: string): {
  wallet: string;
  timestamp: number;
  nonce: string;
  message: string;
} {
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString('hex');
  const message = buildMobileAuthMessage(wallet, timestamp, nonce);
  return { wallet, timestamp, nonce, message };
}

export function validateChallengePayload(input: {
  wallet: string;
  timestamp: number;
  nonce: string;
  message: string;
}): { valid: boolean; error?: string } {
  const { wallet, timestamp, nonce, message } = input;

  if (!wallet || !nonce || !message) {
    return { valid: false, error: 'Missing challenge fields' };
  }

  if (!isValidWalletAddress(wallet)) {
    return { valid: false, error: 'Invalid wallet address' };
  }

  if (!Number.isFinite(timestamp)) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > CHALLENGE_MAX_AGE_MS) {
    return { valid: false, error: 'Challenge is stale' };
  }

  const expectedMessage = buildMobileAuthMessage(wallet, timestamp, nonce);
  if (message !== expectedMessage) {
    return { valid: false, error: 'Challenge message mismatch' };
  }

  return { valid: true };
}

export function createDevHmacSignature(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

export function canUseDevSigner(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.MOBILE_AUTH_ALLOW_DEV_SIGNER === 'true';
}

export async function issueAuthToken(wallet: string): Promise<{ token: string; expiresAt: string }> {
  const ttlSeconds = getTokenTtlSeconds();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((nowSeconds + ttlSeconds) * 1000).toISOString();

  const token = await new SignJWT({ sub: wallet, typ: 'mobile-auth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + ttlSeconds)
    .sign(getJwtSecret());

  return { token, expiresAt };
}

export async function verifyAuthToken(token: string): Promise<{ valid: boolean; wallet?: string }> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const sub = payload.sub;
    if (typeof sub !== 'string' || !isValidWalletAddress(sub)) {
      return { valid: false };
    }
    return { valid: true, wallet: sub };
  } catch {
    return { valid: false };
  }
}

export async function resolveAuthenticatedRequest(request: Request): Promise<ResolvedAuthRequest> {
  const bearerToken = extractBearerToken(request);

  if (bearerToken) {
    const verified = await verifyAuthToken(bearerToken);
    if (verified.valid && verified.wallet) {
      return {
        context: { walletAddress: verified.wallet, source: 'bearer' },
        error: null,
      };
    }
  }

  const headerWallet = request.headers.get('X-Wallet-Address') || request.headers.get('x-wallet-address');
  if (headerWallet && isValidWalletAddress(headerWallet)) {
    return {
      context: { walletAddress: headerWallet, source: 'header' },
      error: null,
    };
  }

  if (bearerToken) {
    return { context: null, error: 'Invalid or expired bearer token' };
  }

  return { context: null, error: 'Authentication required' };
}

export function verifyDevHmac(input: {
  message: string;
  signature: string;
}): { valid: boolean; error?: string } {
  const secret = process.env.MOBILE_AUTH_DEV_SIGNER_SECRET;
  if (!secret) {
    return { valid: false, error: 'MOBILE_AUTH_DEV_SIGNER_SECRET is not configured' };
  }

  const expected = createDevHmacSignature(input.message, secret);
  const valid = safeEqual(expected, input.signature);
  return valid ? { valid: true } : { valid: false, error: 'Invalid dev_hmac signature' };
}

export function verifySolanaEd25519Signature(input: {
  wallet: string;
  message: string;
  signature: string;
}): { valid: boolean; error?: string } {
  try {
    const publicKeyBytes = new PublicKey(input.wallet).toBytes();
    const signatureBytes = Buffer.from(input.signature, 'base64');
    const messageBytes = new TextEncoder().encode(input.message);

    if (publicKeyBytes.length !== 32) {
      return { valid: false, error: 'Invalid wallet public key bytes' };
    }
    if (signatureBytes.length !== 64) {
      return { valid: false, error: 'Invalid ed25519 signature bytes' };
    }

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    return valid ? { valid: true } : { valid: false, error: 'Invalid solana_ed25519 signature' };
  } catch {
    return { valid: false, error: 'Failed to decode wallet signature payload' };
  }
}
