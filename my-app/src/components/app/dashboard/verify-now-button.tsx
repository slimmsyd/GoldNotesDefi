'use client';

/**
 * Verify Now Button
 *
 * Admin-only button that triggers the auto-verify pipeline
 * from the dashboard UI. Replaces terminal commands.
 *
 * Only visible to admin wallets defined in NEXT_PUBLIC_ADMIN_WALLETS.
 */

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

interface VerifyResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    totalSerials: number;
    merkleRoot: string;
    updateTx: string;
    mintTx: string | null;
    finalState: {
      totalSupply: number;
      provenReserves: number;
    } | null;
  };
  elapsed?: number;
}

function buildAdminVerifyMessage(wallet: string, timestamp: number, nonce: string): string {
  return [
    'W3B Admin Verify Request',
    `wallet:${wallet}`,
    `timestamp:${timestamp}`,
    `nonce:${nonce}`,
    'action:auto_verify',
  ].join('\n');
}

function randomNonce(bytes = 16): string {
  const buffer = new Uint8Array(bytes);
  window.crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

export function VerifyNowButton({ onComplete }: { onComplete?: () => void }) {
  const { publicKey, connected, signMessage } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Check if current wallet is an admin
  const adminWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',').map((w) => w.trim());
  const isAdmin = connected && publicKey && adminWallets.includes(publicKey.toBase58());

  if (!isAdmin) return null;

  async function handleVerify() {
    setIsVerifying(true);
    setResult(null);
    setShowResult(true);

    try {
      if (!signMessage || !publicKey) {
        throw new Error('Connected wallet does not support message signing.');
      }

      const wallet = publicKey.toBase58();
      const timestamp = Date.now();
      const nonce = randomNonce();
      const message = buildAdminVerifyMessage(wallet, timestamp, nonce);
      const signature = await signMessage(new TextEncoder().encode(message));

      const response = await fetch('/api/admin/auto-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'dashboard_button',
          wallet,
          timestamp,
          nonce,
          message,
          signature: toBase64(signature),
        }),
      });

      const data: VerifyResult = await response.json();
      setResult(data);

      // Refresh dashboard data after successful verification
      if (data.success && onComplete) {
        setTimeout(onComplete, 1500);
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <>
      {/* Verify Now Button */}
      <button
        onClick={handleVerify}
        disabled={isVerifying}
        className="flex items-center gap-2 bg-[#c9a84c]/10 border border-[#c9a84c]/30 px-4 py-2 text-[#e8d48b] hover:bg-[#c9a84c]/20 hover:border-[#c9a84c]/50 transition-colors disabled:opacity-50 focus:outline-none cursor-pointer"
      >
        {isVerifying ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        )}
        <span className="text-xs font-medium">{isVerifying ? 'Verifying...' : 'Verify Now'}</span>
      </button>

      {/* Result Toast */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 right-6 z-50 max-w-md"
          >
            <div
              className={`border p-4 shadow-2xl ${
                result.success
                  ? 'bg-gray-900 border-green-500/30'
                  : 'bg-gray-900 border-red-500/30'
              }`}
            >
              {/* Close button */}
              <button
                onClick={() => setShowResult(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-white cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                {result.success ? (
                  <div className="w-8 h-8 bg-green-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-red-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className={`font-medium text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {result.success ? 'Verification Complete' : 'Verification Failed'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {result.message || result.error}
                  </p>
                </div>
              </div>

              {/* Details (success only) */}
              {result.success && result.data && (
                <div className="space-y-1.5 text-xs border-t border-gray-800 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Serials Verified</span>
                    <span className="text-white font-mono">{result.data.totalSerials}</span>
                  </div>
                  {result.data.finalState && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Proven Reserves</span>
                        <span className="text-green-400 font-mono">{result.data.finalState.provenReserves}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Supply</span>
                        <span className="text-white font-mono">{result.data.finalState.totalSupply}</span>
                      </div>
                    </>
                  )}
                  {result.data.mintTx && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tokens Minted</span>
                      <span className="text-[#e8d48b] font-mono">Yes</span>
                    </div>
                  )}
                  {result.elapsed && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Time</span>
                      <span className="text-gray-400 font-mono">{(result.elapsed / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                  {result.data.updateTx && (
                    <a
                      href={`https://explorer.solana.com/tx/${result.data.updateTx}${PROTOCOL_CONFIG.network === 'mainnet-beta' ? '' : `?cluster=${PROTOCOL_CONFIG.network}`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[#c9a84c] hover:text-[#e8d48b] mt-2 transition-colors"
                    >
                      View on Explorer &rarr;
                    </a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
