/**
 * W3B Protocol Constants
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

// Program and Account Addresses
// NOTE: These must match what's stored in the ProtocolState PDA on-chain
export const PROTOCOL_CONFIG = {
  // The W3B Protocol Program ID
  programId: process.env.NEXT_PUBLIC_W3B_PROGRAM_ID || '9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6',
  
  // Token Mint (SPL Token-2022) - stored in ProtocolState
  w3bMint: process.env.NEXT_PUBLIC_W3B_MINT || 'GnsxWGypWatWY8tKeqAwSS12qP88yy2879GA79jfwJHL',
  
  // Treasury Token Account - PDA-controlled (owner = protocolState PDA)
  treasury: process.env.NEXT_PUBLIC_W3B_TREASURY_ACCOUNT || 'EvMFQw18whzzEBUgeBhurW1dFWTXCL9KYkEycKEWhqb6',
  
  // Protocol State PDA
  protocolState: process.env.NEXT_PUBLIC_W3B_PROTOCOL_STATE_PDA || 'CWYNiviNYPEApbGjjhDPZ8vmxRTMJiHsJto8JRZNPG8s',
  
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
  url: process.env.NEXT_PUBLIC_W3B_SUPABASE_URL || 'https://jbsasakwyxjbetdezifj.supabase.co',
  // Note: anon key should be in .env, this is just a fallback reference
  anonKeyEnvVar: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
} as const;

// Protocol State Account Layout
// Space: 8 (discriminator) + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 32 = 210 bytes
export interface ProtocolStateData {
  authority: string;
  w3bMint: string;
  treasury: string;
  currentMerkleRoot: Uint8Array;
  lastRootUpdate: number;      // Unix timestamp (seconds)
  lastProofTimestamp: number;  // Unix timestamp (seconds)
  provenReserves: number;      // ZK-proven goldback count
  totalSupply: number;         // Minted W3B token count
  isPaused: boolean;
  bump: number;
  // New fields for buy_w3b functionality
  w3bPriceLamports: number;    // Price of 1 W3B in lamports
  solReceiver: string;         // Where SOL payments are sent
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
  treasuryBalance: number; // W3B tokens available in treasury
  
  // Derived
  isSolvent: boolean;
  solvencyRatio: number; // reserves / supply (or Infinity if supply is 0)
  
  // Off-chain data (Supabase)
  lastAuditRecord: MerkleRootRecord | null;
  totalBatches: number;
  
  // Meta
  lastFetched: Date;
  isLoading: boolean;
  error: string | null;
}
