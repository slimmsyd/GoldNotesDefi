/**
 * Network Utilities
 * Helpers for detecting and validating Solana network configuration
 */

import { Connection } from '@solana/web3.js';
import { PROTOCOL_CONFIG, SolanaNetwork } from './protocol-constants';

export interface NetworkInfo {
  network: SolanaNetwork;
  displayName: string;
  isMainnet: boolean;
  isDevnet: boolean;
  rpcEndpoint: string;
}

export interface NetworkValidationResult {
  isValid: boolean;
  appNetwork: SolanaNetwork;
  detectedNetwork: SolanaNetwork | null;
  errorMessage: string | null;
  userInstructions: string | null;
}

/**
 * Get current network configuration from app settings
 */
export function getNetworkInfo(): NetworkInfo {
  const network = PROTOCOL_CONFIG.network;
  return {
    network,
    displayName: getNetworkDisplayName(network),
    isMainnet: network === 'mainnet-beta',
    isDevnet: network === 'devnet',
    rpcEndpoint: PROTOCOL_CONFIG.rpcEndpoint,
  };
}

/**
 * Get user-friendly network display name
 */
export function getNetworkDisplayName(network: SolanaNetwork): string {
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
}

/**
 * Detect which network the RPC endpoint is connected to
 * by checking the genesis hash
 */
export async function detectNetworkFromConnection(connection: Connection): Promise<SolanaNetwork | null> {
  try {
    const genesisHash = await connection.getGenesisHash();
    
    // Known genesis hashes for Solana networks
    const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
    const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
    const TESTNET_GENESIS = '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY';
    
    if (genesisHash === MAINNET_GENESIS) {
      return 'mainnet-beta';
    } else if (genesisHash === DEVNET_GENESIS) {
      return 'devnet';
    } else if (genesisHash === TESTNET_GENESIS) {
      return 'testnet';
    }
    
    return null;
  } catch (error) {
    console.error('Failed to detect network from connection:', error);
    return null;
  }
}

/**
 * Validate that the app's configured network matches what we're actually connected to
 */
export async function validateNetworkConnection(connection: Connection): Promise<NetworkValidationResult> {
  const appNetwork = PROTOCOL_CONFIG.network;
  const detectedNetwork = await detectNetworkFromConnection(connection);
  
  if (!detectedNetwork) {
    return {
      isValid: false,
      appNetwork,
      detectedNetwork: null,
      errorMessage: 'Unable to detect network. Please check your internet connection.',
      userInstructions: 'Try refreshing the page or checking your network connection.',
    };
  }
  
  if (detectedNetwork !== appNetwork) {
    const appDisplayName = getNetworkDisplayName(appNetwork);
    const detectedDisplayName = getNetworkDisplayName(detectedNetwork);
    
    return {
      isValid: false,
      appNetwork,
      detectedNetwork,
      errorMessage: `Network mismatch: App is configured for ${appDisplayName} but connected to ${detectedDisplayName}.`,
      userInstructions: `Please contact support. The app should be connected to ${appDisplayName}.`,
    };
  }
  
  return {
    isValid: true,
    appNetwork,
    detectedNetwork,
    errorMessage: null,
    userInstructions: null,
  };
}

/**
 * Check if we're in a production environment but using devnet
 * This helps catch configuration errors
 */
export function isDevnetInProduction(): boolean {
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname !== 'localhost' && 
     !window.location.hostname.includes('127.0.0.1') &&
     !window.location.hostname.includes('vercel.app')); // staging domains are OK
  
  return isProduction && PROTOCOL_CONFIG.network === 'devnet';
}

/**
 * Get appropriate explorer URL based on network
 */
export function getExplorerUrl(signature: string, type: 'tx' | 'address' = 'tx'): string {
  const network = PROTOCOL_CONFIG.network;
  const baseUrl = 'https://solscan.io';
  const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  
  return `${baseUrl}/${type}/${signature}${clusterParam}`;
}

/**
 * Get appropriate explorer URL for accounts
 */
export function getAccountExplorerUrl(address: string): string {
  return getExplorerUrl(address, 'address');
}

/**
 * Network-specific token addresses
 */
export const NETWORK_TOKENS = {
  'mainnet-beta': {
    USDC: process.env.NEXT_PUBLIC_MAINNET_USDC || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: process.env.NEXT_PUBLIC_MAINNET_USDT || 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    SOL: process.env.NEXT_PUBLIC_MAINNET_SOL || 'So11111111111111111111111111111111111111112',
  },
  'devnet': {
    USDC: process.env.NEXT_PUBLIC_DEVNET_USDC || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    USDT: process.env.NEXT_PUBLIC_DEVNET_USDT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Same as USDC on devnet
    SOL: process.env.NEXT_PUBLIC_DEVNET_SOL || 'So11111111111111111111111111111111111111112',
  },
  'testnet': {
    USDC: process.env.NEXT_PUBLIC_TESTNET_USDC || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    USDT: process.env.NEXT_PUBLIC_TESTNET_USDT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    SOL: process.env.NEXT_PUBLIC_TESTNET_SOL || 'So11111111111111111111111111111111111111112',
  },
} as const;

/**
 * Get the correct token mint address for the current network
 */
export function getTokenMint(token: 'USDC' | 'USDT' | 'SOL'): string {
  const network = PROTOCOL_CONFIG.network;
  return NETWORK_TOKENS[network][token];
}

/**
 * Format a wallet address for display (truncated)
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) {
    return address;
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
