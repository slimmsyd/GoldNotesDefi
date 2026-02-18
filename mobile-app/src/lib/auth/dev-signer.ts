import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export function createDevHmacSignature(message: string, secret: string): string {
  if (!secret) {
    throw new Error('Missing EXPO_PUBLIC_DEV_SIGNER_SECRET');
  }

  const digest = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(message));
  return bytesToHex(digest);
}
