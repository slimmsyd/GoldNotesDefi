import "server-only";

import { createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const ADMIN_SIGNATURE_WINDOW_MS = 60_000;

export interface AdminSignedRequestPayload {
  wallet: string;
  timestamp: number;
  nonce: string;
  message: string;
  signature: string;
}

interface AuthResult {
  ok: boolean;
  method?: "webhook" | "wallet";
  reason?: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function parseCsvSet(value: string | undefined): Set<string> {
  return new Set(
    (value || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

export function buildAdminVerifyMessage(
  wallet: string,
  timestamp: number,
  nonce: string
): string {
  return [
    "W3B Admin Verify Request",
    `wallet:${wallet}`,
    `timestamp:${timestamp}`,
    `nonce:${nonce}`,
    "action:auto_verify",
  ].join("\n");
}

function toEd25519SpkiFromWallet(wallet: string) {
  const walletBytes = Buffer.from(new PublicKey(wallet).toBytes());
  return Buffer.concat([ED25519_SPKI_PREFIX, walletBytes]);
}

function isWalletAllowlisted(wallet: string): boolean {
  const allowlist = parseCsvSet(process.env.ADMIN_WALLET_ALLOWLIST);
  return allowlist.has(wallet);
}

function verifyWalletSignature(payload: AdminSignedRequestPayload): AuthResult {
  if (!payload.wallet || !payload.nonce || !payload.message || !payload.signature) {
    return { ok: false, reason: "Missing wallet auth payload fields" };
  }

  if (!Number.isFinite(payload.timestamp)) {
    return { ok: false, reason: "Invalid wallet auth timestamp" };
  }

  const now = Date.now();
  if (Math.abs(now - payload.timestamp) > ADMIN_SIGNATURE_WINDOW_MS) {
    return { ok: false, reason: "Wallet auth signature is stale" };
  }

  if (!isWalletAllowlisted(payload.wallet)) {
    return { ok: false, reason: "Wallet is not on admin allowlist" };
  }

  const expectedMessage = buildAdminVerifyMessage(
    payload.wallet,
    payload.timestamp,
    payload.nonce
  );

  if (payload.message !== expectedMessage) {
    return { ok: false, reason: "Wallet auth message mismatch" };
  }

  try {
    const signature = Buffer.from(payload.signature, "base64");
    const publicKeyDer = toEd25519SpkiFromWallet(payload.wallet);
    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });

    const valid = verify(
      null,
      Buffer.from(payload.message, "utf8"),
      publicKey,
      signature
    );

    if (!valid) {
      return { ok: false, reason: "Invalid wallet signature" };
    }

    return { ok: true, method: "wallet" };
  } catch (error) {
    return {
      ok: false,
      reason: `Wallet auth verification failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }
}

function isWebhookAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const bearer = getBearerToken(request);
  if (bearer && safeEqual(bearer, secret)) {
    return true;
  }

  const webhookSecret = request.headers.get("x-webhook-secret");
  if (webhookSecret && safeEqual(webhookSecret, secret)) {
    return true;
  }

  return false;
}

function toSignedPayload(body: unknown): AdminSignedRequestPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;

  if (
    typeof record.wallet !== "string" ||
    typeof record.timestamp !== "number" ||
    typeof record.nonce !== "string" ||
    typeof record.message !== "string" ||
    typeof record.signature !== "string"
  ) {
    return null;
  }

  return {
    wallet: record.wallet,
    timestamp: record.timestamp,
    nonce: record.nonce,
    message: record.message,
    signature: record.signature,
  };
}

export function authenticateAutoVerifyRequest(
  request: Request,
  body: unknown
): AuthResult {
  if (isWebhookAuthorized(request)) {
    return { ok: true, method: "webhook" };
  }

  const payload = toSignedPayload(body);
  if (!payload) {
    return { ok: false, reason: "Missing wallet auth payload" };
  }

  return verifyWalletSignature(payload);
}

export function assertMyAppSecurityEnv(): void {
  if (!isProduction()) {
    return;
  }

  const required = [
    "ADMIN_WEBHOOK_SECRET",
    "ADMIN_WALLET_ALLOWLIST",
    "PROTOCOL_AUTHORITY_KEYPAIR",
    "CRON_SECRET",
  ];

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(", ")}`);
  }
}

export function validateCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const token = getBearerToken(request);
  return Boolean(token && safeEqual(token, secret));
}
