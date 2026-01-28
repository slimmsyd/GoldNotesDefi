'use client';

import { useState } from 'react';
import { OnrampEmbed } from './onramp-embed';

interface OnrampButtonProps {
  walletAddress: string;
  className?: string;
  variant?: 'button' | 'link';
  mode?: 'popup' | 'embed';
  onSuccess?: () => void;
}

export function OnrampButton({ 
  walletAddress, 
  className, 
  variant = 'button', 
  mode = 'popup',
  onSuccess 
}: OnrampButtonProps) {
  const [loading, setLoading] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);

  const isLink = variant === 'link';

  const handleBuy = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }

    // If embed mode, open the embed modal instead of popup
    if (mode === 'embed') {
      setEmbedOpen(true);
      return;
    }

    // Popup mode
    setLoading(true);
    try {
      const res = await fetch('/api/coinbase-onramp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destinationWallet: walletAddress }),
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Failed to start onramp session');
      }

      // Open Coinbase Onramp popup
      const onrampUrl = `https://pay.coinbase.com/buy/select-asset?sessionToken=${data.token}`;
      window.open(onrampUrl, 'CoinbaseOnramp', 'width=500,height=700');

    } catch (error) {
      console.error('Onramp error:', error);
      alert('Could not start Coinbase Onramp. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmbedClose = () => {
    setEmbedOpen(false);
  };

  const handleEmbedSuccess = () => {
    setEmbedOpen(false);
    onSuccess?.();
  };

  // Link variant - simple text link
  if (isLink) {
    return (
      <>
        <button
          onClick={handleBuy}
          disabled={loading || !walletAddress}
          className={className || 'text-xs text-[#0052FF] hover:text-[#0040CC] underline cursor-pointer bg-transparent border-none disabled:opacity-50'}
        >
          {loading ? 'Loading...' : mode === 'embed' ? 'Fund inline' : 'Buy with Coinbase'}
        </button>
        {mode === 'embed' && (
          <OnrampEmbed
            walletAddress={walletAddress}
            isOpen={embedOpen}
            onClose={handleEmbedClose}
            onSuccess={handleEmbedSuccess}
          />
        )}
      </>
    );
  }

  // Button variant - full button with icon
  return (
    <>
      <button
        onClick={handleBuy}
        disabled={loading || !walletAddress}
        className={className || 'w-full py-3 bg-[#0052FF] text-white text-sm font-bold rounded-xl hover:bg-[#0040CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Preparing...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="currentColor" fillOpacity="0.2" />
              <path d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" fill="currentColor" />
              <path d="M16 10a1 1 0 00-1 1v4.586l-2.707 2.707a1 1 0 001.414 1.414l3-3A1 1 0 0017 16v-5a1 1 0 00-1-1z" fill="currentColor" />
            </svg>
            Top Up with Coinbase
          </>
        )}
      </button>
      {mode === 'embed' && (
        <OnrampEmbed
          walletAddress={walletAddress}
          isOpen={embedOpen}
          onClose={handleEmbedClose}
          onSuccess={handleEmbedSuccess}
        />
      )}
    </>
  );
}
