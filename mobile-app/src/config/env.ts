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
  wgbProgramId: readEnv('EXPO_PUBLIC_WGB_PROGRAM_ID', '9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6'),
  wgbMint: readEnv('EXPO_PUBLIC_WGB_MINT', '5gw6McYxM3gCCiamCMCms9t6q2ytjPTD5P15ocjtVTVQ'),
  wgbTreasury: readEnv('EXPO_PUBLIC_WGB_TREASURY_ACCOUNT', 'FfADSgooHXMW4jHjF4KpBUJdmbsx3Nnw3PAbcemt8Ark'),
  wgbProtocolState: readEnv('EXPO_PUBLIC_WGB_PROTOCOL_STATE_PDA', 'CWYNiviNYPEApbGjjhDPZ8vmxRTMJiHsJto8JRZNPG8s'),
  devSignerSecret: process.env.EXPO_PUBLIC_DEV_SIGNER_SECRET || '',
  isProduction: appEnv === 'production',
} as const;
