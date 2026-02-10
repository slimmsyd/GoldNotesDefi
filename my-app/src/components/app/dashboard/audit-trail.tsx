'use client';

/**
 * Audit Trail Component
 * GoldBack Design System Implementation
 *
 * Displays ZK proof history with links to Solana explorer
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MerkleRootRecord } from '@/lib/protocol-constants';
import { fetchMerkleRootHistory } from '@/lib/supabase-protocol';

export function AuditTrail() {
  const [roots, setRoots] = useState<MerkleRootRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchMerkleRootHistory(5);
        setRoots(data);
      } catch (e) {
        console.error('Failed to load audit trail', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'anchored':
      case 'confirmed':
        return { color: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/20' };
      case 'unconfirmed':
        return { color: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/20' };
      case 'failed':
        return { color: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/20' };
      default:
        return { color: 'bg-gray-500', text: 'text-gray-400', bg: 'bg-gray-500/20' };
    }
  };

  const getExplorerUrl = (txHash: string | null) => {
    if (!txHash) return null;
    return `https://solscan.io/tx/${txHash}?cluster=devnet`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="bg-gray-900/50 border border-gray-800 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#c9a84c]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold">Proof History</h3>
            <p className="text-gray-500 text-xs">ZK-verified merkle roots</p>
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1">
          {roots.length} records
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        ) : roots.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Building Proof History</p>
            <p className="text-gray-500 text-sm mb-3">ZK-verified merkle roots will be recorded here for transparent auditing</p>
            <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-800/50 px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Proofs are submitted daily
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700">
            {roots.map((root, index) => {
              const explorerUrl = getExplorerUrl(root.solana_tx_hash);
              const statusConfig = getStatusConfig(root.status);
              const Wrapper = explorerUrl ? 'a' : 'div';
              const wrapperProps = explorerUrl
                ? {
                    href: explorerUrl,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : {};

              return (
                <motion.div
                  key={root.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.3 }}
                >
                  <Wrapper
                    {...wrapperProps}
                    className={`block bg-gray-800/30 p-4 border border-gray-800/50 transition-all duration-200 ${
                      explorerUrl ? 'hover:bg-gray-800/50 hover:border-gray-600 hover:translate-y-[-2px] hover:shadow-lg cursor-pointer group focus:outline-none' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Icon */}
                      <div className={`w-10 h-10 ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                        {root.status === 'anchored' || root.status === 'confirmed' ? (
                          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : root.status === 'unconfirmed' ? (
                          <svg className="w-5 h-5 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            <span className={`w-1 h-1 rounded-full ${statusConfig.color}`} />
                            {root.status.charAt(0).toUpperCase() + root.status.slice(1)}
                          </span>
                          <span className="text-gray-500 text-xs">{formatTimeAgo(root.anchored_at)}</span>
                        </div>
                        <p className="text-gray-500 text-xs font-mono truncate" title={root.root_hash}>
                          {root.root_hash.slice(0, 20)}...{root.root_hash.slice(-8)}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-[#e8d48b] font-bold text-lg">{root.total_serials.toLocaleString()}</p>
                        <p className="text-gray-500 text-xs uppercase tracking-wider">serials</p>
                      </div>

                      {/* Verification Link */}
                      {explorerUrl && (
                        <div className="flex items-center self-center ml-2 flex-shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-800/50 text-xs font-medium text-gray-400 group-hover:text-[#e8d48b] group-hover:bg-[#c9a84c]/10 transition-colors">
                            <span className="hidden sm:inline">Verify</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </span>
                        </div>
                      )}
                    </div>
                  </Wrapper>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
