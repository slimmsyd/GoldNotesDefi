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
        return { color: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/30' };
      case 'unconfirmed':
        return { color: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border border-yellow-500/30' };
      case 'failed':
        return { color: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30' };
      default:
        return { color: 'bg-gray-400', text: 'text-gray-400', bg: 'bg-white/5 border border-white/10' };
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
      className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden"
    >
      {/* Header */}
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-white/5 rounded-[12px] border border-white/10 flex items-center justify-center">
            <img src="/AppAssets/PNG Renders/laptop_security_black.png" alt="Proof History" className="w-6 h-6 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
          </div>
          <div>
            <h3 className="text-xl font-medium text-white">Proof History</h3>
            <p className="text-gray-500 text-sm mt-1 font-medium">ZK-verified merkle roots</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-gray-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
          {roots.length} records
        </span>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-[24px] animate-pulse" />
            ))}
          </div>
        ) : roots.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/5 rounded-[24px] border border-white/10 flex items-center justify-center mx-auto mb-4">
              <img src="/AppAssets/PNG Renders/safe_open_coins_black.png" alt="Building Proof History" className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
            </div>
            <p className="text-white font-bold tracking-tight mb-2">Building Proof History</p>
            <p className="text-gray-500 text-sm mb-4">ZK-verified merkle roots will be recorded here for transparent auditing</p>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full uppercase tracking-widest">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Proofs are submitted daily
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
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
                    className={`block bg-white/[0.02] p-5 border border-white/5 rounded-[24px] transition-all duration-300 ${explorerUrl ? 'hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer group focus:outline-none' : ''
                      }`}
                  >
                    <div className="flex items-center gap-6">
                      {/* Status Icon */}
                      <div className={`p-2 bg-white/5 border border-white/10 rounded-2xl flex-shrink-0`}>
                        {root.status === 'anchored' || root.status === 'confirmed' ? (
                          <img src="/AppAssets/PNG Renders/safe_open_coins_black.png" alt="Confirmed" className="w-8 h-8 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
                        ) : root.status === 'unconfirmed' ? (
                          <img src="/AppAssets/PNG Renders/calendar_black.png" alt="Unconfirmed" className="w-8 h-8 object-contain animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
                        ) : (
                          <img src="/AppAssets/PNG Renders/umbrella_black.png" alt="Failed" className="w-8 h-8 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm ${statusConfig.bg} ${statusConfig.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.color} shadow-[0_0_8px_currentColor]`} />
                            {root.status.charAt(0).toUpperCase() + root.status.slice(1)}
                          </span>
                          <span className="text-gray-500 text-xs font-medium">{formatTimeAgo(root.anchored_at)}</span>
                        </div>
                        <p className="text-gray-400 text-[10px] font-mono truncate bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 inline-block" title={root.root_hash}>
                          {root.root_hash.slice(0, 20)}...{root.root_hash.slice(-8)}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-[#c9a84c] font-bold text-2xl tracking-tighter drop-shadow-md">{root.total_serials.toLocaleString()}</p>
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">serials</p>
                      </div>

                      {/* Verification Link */}
                      {explorerUrl && (
                        <div className="flex items-center self-center ml-4 flex-shrink-0">
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all shadow-sm">
                            <span className="hidden sm:inline">Verify</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
