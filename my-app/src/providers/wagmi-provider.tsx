'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
// NOTE: Legacy wallet adapters removed - Wallet Standard auto-detects modern wallets
// Phantom, Solflare, Backpack, etc. now register themselves automatically
import { PROTOCOL_CONFIG, SolanaNetwork } from '@/lib/protocol-constants';

// Import Solana wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';
// Import custom styles to match BlackW3B aesthetic
import '@/styles/wallet-adapter.css';

// Map our network type to WalletAdapterNetwork
const networkToWalletAdapter: Record<SolanaNetwork, WalletAdapterNetwork> = {
  'devnet': WalletAdapterNetwork.Devnet,
  'mainnet-beta': WalletAdapterNetwork.Mainnet,
  'testnet': WalletAdapterNetwork.Testnet,
};

export function SolanaProviderWrapper({ children }: { children: React.ReactNode }) {
  // Network and RPC are now configured via PROTOCOL_CONFIG (reads from env vars)
  // Set NEXT_PUBLIC_SOLANA_NETWORK and NEXT_PUBLIC_RPC_ENDPOINT in .env.local
  const network = networkToWalletAdapter[PROTOCOL_CONFIG.network];
  const endpoint = PROTOCOL_CONFIG.rpcEndpoint;

  // Empty wallets array - Wallet Standard auto-detects all installed wallets
  // This avoids conflicts with legacy adapters for wallets that now support the standard
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(error) => {
          console.warn('Wallet connection error:', error.message);
        }}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

