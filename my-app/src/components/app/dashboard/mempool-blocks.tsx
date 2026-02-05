'use client';

/**
 * Mempool Blocks Component
 * GoldBack Design System Implementation
 *
 * Displays verified Goldback batches in a horizontal scrollable view
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchBatchStats, BatchStats } from '@/lib/supabase-protocol';

interface BlockData extends BatchStats {
  blockNumber: number;
  ageMinutes: number;
}

interface MempoolBlocksProps {
  goldbackPrice: number | null;
}

export function MempoolBlocks({ goldbackPrice }: MempoolBlocksProps) {
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBlocks() {
      try {
        const batches = await fetchBatchStats();

        // Transform batches into block data with computed fields
        const blockData: BlockData[] = batches.map((batch, index) => {
          const receivedDate = new Date(batch.latestReceived);
          const now = new Date();
          const ageMinutes = Math.floor((now.getTime() - receivedDate.getTime()) / (1000 * 60));

          return {
            ...batch,
            blockNumber: batches.length - index,
            ageMinutes,
          };
        });

        setBlocks(blockData.slice(0, 8));
      } catch (error) {
        console.error('Failed to load blocks:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadBlocks();
    const interval = setInterval(loadBlocks, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatAge = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-48 bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-5 w-24 bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-44 h-48 bg-gray-800/50 rounded-2xl animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-white font-medium mb-1">Awaiting ZK Proofs</p>
        <p className="text-gray-500 text-sm mb-3">Verified Goldback batches will appear here once submitted to the network</p>
        <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-800/50 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
          Monitoring for new proofs
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-semibold">Verified Batches</h2>
            <p className="text-gray-500 text-xs">ZK-proven Goldback certificates</p>
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-400">On-Chain Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
            <span className="text-gray-400">Pending Verification</span>
          </div>
        </div>
      </div>

      {/* Blocks Container - Horizontal Slider */}
      <div className="p-6 overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="flex gap-4 min-w-max pb-2">
          <AnimatePresence mode="popLayout">
            {blocks.map((block, index) => (
              <MempoolBlock
                key={block.batchId}
                block={block}
                index={index}
                isAnchored={block.isAnchored ?? true}
                formatAge={formatAge}
                goldbackPrice={goldbackPrice}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer with scroll hint */}
      <div className="px-6 py-3 border-t border-gray-800/50 bg-gray-900/30 flex justify-between items-center text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Newer</span>
        </div>
        <span>Scroll to explore</span>
        <div className="flex items-center gap-2">
          <span>Older</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

interface MempoolBlockProps {
  block: BlockData;
  index: number;
  isAnchored: boolean;
  formatAge: (minutes: number) => string;
  goldbackPrice: number | null;
}

function MempoolBlock({ block, index, isAnchored, formatAge, goldbackPrice }: MempoolBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="shrink-0 cursor-pointer group"
    >
      <div
        className={`relative w-44 rounded-2xl border overflow-hidden transition-all duration-200 ${
          isAnchored
            ? 'bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700/50 group-hover:border-amber-500/30 group-hover:shadow-lg group-hover:shadow-amber-500/10'
            : 'bg-gradient-to-b from-amber-900/20 to-gray-900 border-amber-500/30 group-hover:shadow-lg group-hover:shadow-amber-500/10'
        }`}
      >
        {/* Top Accent Bar */}
        <div className={`h-1 ${isAnchored ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`} />

        {/* Block Number Header */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-amber-400 font-mono text-xs font-bold tracking-wider">
              #{(block.blockNumber ?? index + 1).toString().padStart(5, '0')}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                isAnchored
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              <span className={`w-1 h-1 rounded-full ${isAnchored ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
              {isAnchored ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Stats Body */}
        <div className="px-4 py-3 space-y-3">
          {/* Total Value */}
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-0.5">Value</div>
            <div className="text-white font-bold text-2xl tracking-tight">
              {goldbackPrice !== null
                ? `$${(block.totalValueUsd ?? block.serialCount * goldbackPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : '—'}
            </div>
          </div>

          {/* Serial Count */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{block.serialCount.toLocaleString()}</div>
              <div className="text-gray-500 text-xs">Goldbacks</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-800/50 bg-gray-950/50 flex items-center justify-between">
          <span className="text-gray-500 text-xs">{formatAge(block.ageMinutes ?? 0)}</span>
          <svg className="w-4 h-4 text-gray-500 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Shimmer on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
      </div>
    </motion.div>
  );
}
