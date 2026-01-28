'use client';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'anchored':
      case 'confirmed':
        return 'bg-green-500';
      case 'unconfirmed':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getExplorerUrl = (txHash: string | null) => {
    if (!txHash) return null;
    return `https://solscan.io/tx/${txHash}?cluster=devnet`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 h-full flex flex-col"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          ZK Proof History
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <div className="text-center text-gray-600 py-8 italic">
          No proofs submitted yet
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {roots.map((root, index) => {
            const explorerUrl = getExplorerUrl(root.solana_tx_hash);
            const Wrapper = explorerUrl ? 'a' : 'div';
            const wrapperProps = explorerUrl ? {
              href: explorerUrl,
              target: '_blank',
              rel: 'noopener noreferrer'
            } : {};

            return (
              <motion.div
                key={root.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Wrapper
                  {...wrapperProps}
                  className={`block bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 transition-all ${
                    explorerUrl 
                      ? 'hover:bg-gray-800 hover:border-gray-600 cursor-pointer group' 
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(root.status)}`} />
                        <span className="text-white text-sm font-medium capitalize">
                          {root.status}
                        </span>
                        {explorerUrl && (
                          <svg className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs font-mono truncate" title={root.root_hash}>
                        Root: {root.root_hash}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-amber-500 font-bold">{root.total_serials}</p>
                      <p className="text-gray-600 text-xs">serials</p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between items-end">
                    <span className="text-gray-600 text-xs">
                      {new Date(root.anchored_at).toLocaleString()}
                    </span>
                    {root.solana_tx_hash && (
                      <span className="text-[10px] text-gray-700 font-mono group-hover:text-blue-400/80 transition-colors">
                        View on Solscan →
                      </span>
                    )}
                  </div>
                </Wrapper>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
