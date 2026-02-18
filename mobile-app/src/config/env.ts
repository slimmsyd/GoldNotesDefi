type AppEnv = 'development' | 'staging' | 'production';
type SolanaNetwork = 'devnet' | 'testnet' | 'mainnet-beta';

function resolveAppEnv(): AppEnv {
  const raw = process.env.EXPO_PUBLIC_ENV;
  if (raw === 'production' || raw === 'staging') return raw;
  return 'development';
}

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  return fallback;
}

const appEnv = resolveAppEnv();
const apiBaseUrl = readEnv(
  'EXPO_PUBLIC_API_BASE_URL',
  appEnv === 'development' ? 'http://10.0.2.2:3000' : ''
);

if (!apiBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must be set for staging/production builds');
}

const rawNetwork = readEnv('EXPO_PUBLIC_SOLANA_NETWORK', appEnv === 'production' ? 'mainnet-beta' : 'devnet');
const solanaNetwork: SolanaNetwork =
  rawNetwork === 'mainnet-beta' || rawNetwork === 'testnet' ? rawNetwork : 'devnet';

const rpcEndpoint = readEnv(
  'EXPO_PUBLIC_RPC_ENDPOINT',
  solanaNetwork === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'
);

export const env = {
  appEnv,
  apiBaseUrl,
  solanaNetwork,
  rpcEndpoint,
  devSignerSecret: process.env.EXPO_PUBLIC_DEV_SIGNER_SECRET || '',
  isProduction: appEnv === 'production',
} as const;
