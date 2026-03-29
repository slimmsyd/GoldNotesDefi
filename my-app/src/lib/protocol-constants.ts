/**
 * WGB Protocol Constants
 * Deployed Infrastructure on Solana
 * 
 * Network configuration is read from environment variables:
 * - NEXT_PUBLIC_SOLANA_NETWORK: 'devnet' | 'mainnet-beta' (default: 'devnet')
 * - NEXT_PUBLIC_RPC_ENDPOINT: RPC URL (default: https://api.devnet.solana.com)
 * 
 * IMPORTANT: For production, set these environment variables:
 *   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
 *   NEXT_PUBLIC_RPC_ENDPOINT=<your-mainnet-rpc-url>
 */

// Network type for wallet adapter compatibility
export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet';

// Read network from env with devnet as default
const getNetwork = (): SolanaNetwork => {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (network === 'mainnet-beta' || network === 'devnet' || network === 'testnet') {
    return network;
  }
  return 'devnet'; // Default to devnet for safety
};

// Read RPC endpoint from env with appropriate default based on network
const getRpcEndpoint = (): string => {
  const customEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  if (customEndpoint) {
    return customEndpoint;
  }
  // Default endpoints based on network
  const network = getNetwork();
  if (network === 'mainnet-beta') {
    return 'https://api.mainnet-beta.solana.com';
  }
  return 'https://api.devnet.solana.com';
};

// Get display name for the network (for UI)
const getNetworkDisplay = (): string => {
  const network = getNetwork();
  switch (network) {
    case 'mainnet-beta':
      return 'Mainnet';
    case 'devnet':
      return 'Devnet';
    case 'testnet':
      return 'Testnet';
    default:
      return 'Unknown';

      
  }
};

// Network-specific token addresses
const getUsdcMint = (): string => {
  const network = getNetwork();
  if (network === 'mainnet-beta') {
    return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC
  }
  return '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
};

const getUsdtMint = (): string => {
  const network = getNetwork();
  if (network === 'mainnet-beta') {
    return 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'; // Mainnet USDT
  }
  return '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet (same as USDC)
};

// Check if we're in a potentially misconfigured state
const checkNetworkWarnings = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const isProduction = 
    window.location.hostname !== 'localhost' && 
    !window.location.hostname.includes('127.0.0.1');
  
  const network = getNetwork();
  
  if (isProduction && network === 'devnet') {
    return 'Warning: Running on Devnet in a production environment. Set NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta for production.';
  }
  
  return null;
};

// Read a public env var, returning the first non-empty value or a fallback.
// In production (Vercel) the vars are always set; locally they may be absent.
const requirePublicEnv = (
  values: Array<string | undefined>,
  envVars: string[],
  label: string,
  fallback = ''
): string => {
  for (const value of values) {
    const trimmedValue = value?.trim();
    if (trimmedValue) {
      return trimmedValue;
    }
  }

  // Don't crash – just warn. The vars will be present on Vercel.
  if (typeof console !== 'undefined') {
    const envLabel = envVars.join(' or ');
    console.warn(
      `[protocol-constants] ${envLabel} (${label}) is not set. ` +
      'Features depending on this value will be unavailable until it is configured.'
    );
  }
  return fallback;
};

// Static access required — Next.js/Turbopack only inlines NEXT_PUBLIC_* env vars
// into the client bundle when accessed as literal `process.env.NEXT_PUBLIC_X`.
// Dynamic access like `process.env[varName]` is NOT detected by the compiler.
const PUBLIC_WGB_PROGRAM_ID =
  process.env.NEXT_PUBLIC_WGB_PROGRAM_ID?.trim() ||
  process.env.NEXT_PUBLIC_W3B_PROGRAM_ID?.trim();

const PUBLIC_WGB_MINT =
  process.env.NEXT_PUBLIC_WGB_MINT?.trim() ||
  process.env.NEXT_PUBLIC_W3B_MINT?.trim();

const PUBLIC_WGB_TREASURY_ACCOUNT =
  process.env.NEXT_PUBLIC_WGB_TREASURY_ACCOUNT?.trim() ||
  process.env.NEXT_PUBLIC_W3B_TREASURY_ACCOUNT?.trim();

const PUBLIC_WGB_PROTOCOL_STATE_PDA =
  process.env.NEXT_PUBLIC_WGB_PROTOCOL_STATE_PDA?.trim() ||
  process.env.NEXT_PUBLIC_W3B_PROTOCOL_STATE_PDA?.trim();

const PUBLIC_WGB_SUPABASE_URL =
  process.env.NEXT_PUBLIC_WGB_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_W3B_SUPABASE_URL?.trim();

// Program and Account Addresses
// NOTE: These must match what's stored in the ProtocolState PDA on-chain
export const PROTOCOL_CONFIG = {
  // The WGB Protocol Program ID
  programId: requirePublicEnv(
    [PUBLIC_WGB_PROGRAM_ID],
    ['NEXT_PUBLIC_WGB_PROGRAM_ID', 'NEXT_PUBLIC_W3B_PROGRAM_ID'],
    'Program ID'
  ),

  // Token Mint (SPL Token-2022) - stored in ProtocolState
  wgbMint: requirePublicEnv(
    [PUBLIC_WGB_MINT],
    ['NEXT_PUBLIC_WGB_MINT', 'NEXT_PUBLIC_W3B_MINT'],
    'WGB Mint'
  ),

  // Treasury Token Account - PDA-controlled (owner = protocolState PDA)
  treasury: requirePublicEnv(
    [PUBLIC_WGB_TREASURY_ACCOUNT],
    ['NEXT_PUBLIC_WGB_TREASURY_ACCOUNT', 'NEXT_PUBLIC_W3B_TREASURY_ACCOUNT'],
    'Treasury Account'
  ),

  // Protocol State PDA
  protocolState: requirePublicEnv(
    [PUBLIC_WGB_PROTOCOL_STATE_PDA],
    ['NEXT_PUBLIC_WGB_PROTOCOL_STATE_PDA', 'NEXT_PUBLIC_W3B_PROTOCOL_STATE_PDA'],
    'Protocol State PDA'
  ),

  // Network (read from env)
  network: getNetwork(),
  rpcEndpoint: getRpcEndpoint(),

  // UI display name for the network
  networkDisplay: getNetworkDisplay(),

  // Network-specific token addresses
  usdcMint: getUsdcMint(),
  usdtMint: getUsdtMint(),

  // Helper to check for network configuration issues
  networkWarning: checkNetworkWarnings(),

  // Is this mainnet?
  isMainnet: getNetwork() === 'mainnet-beta',
  isDevnet: getNetwork() === 'devnet',
} as const;

// Supabase Configuration (Blockchain project)
export const SUPABASE_CONFIG = {
  url: PUBLIC_WGB_SUPABASE_URL || 'https://jbsasakwyxjbetdezifj.supabase.co',
  // Prefer the WGB key name, but support the legacy W3B name as an alias.
  anonKeyEnvVar: 'NEXT_PUBLIC_WGB_SUPABASE_ANON_KEY',
} as const;

// V2 Protocol State Account Layout
// Space: 8 (disc) + 32 + 32 + 32 + 32 + 8 + 8 + 32 + 8 + 8 + 8 + 8 + 32 + 2 + 8 + 8 + 1 + 1 + 64 = 332 bytes
export interface ProtocolStateData {
  // Authority
  authority: string;           // Admin (cold wallet) — high-risk ops
  operator: string;            // Operator (hot wallet) — routine ops

  // Token
  wgbMint: string;
  treasury: string;
  totalSupply: number;         // Minted WGB token count
  totalBurned: number;         // Burned WGB count

  // Reserve Proof
  currentMerkleRoot: Uint8Array;
  provenReserves: number;      // ZK-proven goldback count
  lastRootUpdate: number;      // Unix timestamp (seconds)
  lastProofTimestamp: number;   // Unix timestamp (seconds)

  // Pricing
  wgbPriceLamports: number;    // Price of 1 WGB in lamports
  solReceiver: string;         // Where SOL payments are sent

  // Yield
  yieldApyBps: number;        // APY in basis points (350 = 3.5%)
  totalYieldDistributed: number;
  lastYieldDistribution: number;

  // Config
  isPaused: boolean;
  bump: number;
}

// Supabase Table Types
export interface MerkleRootRecord {
  id: number;
  root_hash: string;
  total_serials: number;
  anchored_at: string;
  solana_tx_hash: string | null;
  status: 'unconfirmed' | 'confirmed' | 'anchored' | 'failed';
}

export interface GoldbackSerialRecord {
  id: string;
  serial_number: string;
  batch_id: string;
  received_at: string;
  merkle_leaf_hash: Uint8Array;
  included_in_root: string | null;

}

// Combined Protocol Data (what the UI needs)
export interface ProtocolData {
  // On-chain data
  totalSupply: number;
  provenReserves: number;
  lastProofTimestamp: Date | null;
  currentMerkleRoot: string;
  isPaused: boolean;
  treasuryBalance: number; // WGB tokens available in treasury

  // Derived
  isSolvent: boolean;
  solvencyRatio: number; // reserves / supply (or Infinity if supply is 0)

  // Off-chain data (Supabase)
  lastAuditRecord: MerkleRootRecord | null;
  totalBatches: number;

  // Goldback/WGB Price Data
  goldbackPrice: number | null;           // Current Goldback rate (WGB is 1:1)
  goldbackPriceUpdatedAt: Date | null;    // When the price was last updated
  goldbackPrice24hChange: number | null;  // 24h price change percentage
  isGoldbackPriceStale: boolean;          // True if price is >30 min old

  // Meta
  lastFetched: Date;
  isLoading: boolean;
  error: string | null;
}
