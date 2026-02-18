import "server-only";

const DEFAULT_MERCHANT_WALLET = "CrQERYcZMnENP85qZBrdimS7oz2Ura9tAPxkZJPMpbNj";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function resolveMerchantWalletAddress(): string {
  return (
    process.env.MERCHANT_WALLET_ADDRESS ||
    process.env.NEXT_PUBLIC_MERCHANT_WALLET ||
    DEFAULT_MERCHANT_WALLET
  );
}

export function assertCheckoutSecurityEnv(): void {
  if (!isProduction()) return;

  const missing: string[] = [];

  if (!process.env.CRON_SECRET) {
    missing.push("CRON_SECRET");
  }
  if (!process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
    missing.push("NEXT_PUBLIC_RPC_ENDPOINT");
  }
  if (!process.env.MERCHANT_WALLET_ADDRESS && !process.env.NEXT_PUBLIC_MERCHANT_WALLET) {
    missing.push("MERCHANT_WALLET_ADDRESS");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required checkout env vars: ${missing.join(", ")}`);
  }
}
