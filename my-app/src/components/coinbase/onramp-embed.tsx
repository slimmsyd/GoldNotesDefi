'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnrampEmbedProps {
  walletAddress: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OnrampEmbed({ walletAddress, isOpen, onClose, onSuccess }: OnrampEmbedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onrampUrl, setOnrampUrl] = useState<string | null>(null);

  const fetchSessionToken = useCallback(async () => {
    if (!walletAddress) {
      setError('No wallet address provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

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

      const url = `https://pay.coinbase.com/buy/select-asset?sessionToken=${data.token}`;
      setOnrampUrl(url);
    } catch (err) {
      console.error('Onramp embed error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Coinbase Onramp');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Fetch session token when modal opens
  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchSessionToken();
    }
  }, [isOpen, walletAddress, fetchSessionToken]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setOnrampUrl(null);
      setError(null);
      setLoading(true);
    }
  }, [isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Listen for messages from the iframe (Coinbase sends success/error events)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Coinbase
      if (event.origin !== 'https://pay.coinbase.com') return;

      if (event.data?.type === 'success' || event.data?.eventName === 'success') {
        onSuccess?.();
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-full max-w-md h-[700px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-white">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#0052FF]" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="16" fill="currentColor" fillOpacity="0.1" />
                  <path d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" fill="currentColor" />
                </svg>
                <span className="text-sm font-semibold text-neutral-900">Fund with Coinbase</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 relative bg-neutral-50">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-[#0052FF]/20 rounded-full" />
                    <div className="absolute inset-0 w-12 h-12 border-4 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-sm text-neutral-500">Loading Coinbase Onramp...</p>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white p-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-600 text-center">{error}</p>
                  <button
                    onClick={fetchSessionToken}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#0052FF] rounded-lg hover:bg-[#0040CC] transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!loading && !error && onrampUrl && (
                <iframe
                  src={onrampUrl}
                  title="Coinbase Onramp"
                  className="w-full h-full border-0"
                  allow="payment; camera"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
                />
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-neutral-100 bg-white">
              <p className="text-[10px] text-neutral-400 text-center">
                Powered by Coinbase. Funds will be sent to your connected wallet.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
