'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchBatchStats, BatchStats } from '@/lib/supabase-protocol';

interface BlockData extends BatchStats {
  blockNumber: number;
  ageMinutes: number;
}

export function MempoolBlocks() {
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
            blockNumber: batches.length - index, // Newer blocks have higher numbers
            ageMinutes,
          };
        });
        
        setBlocks(blockData.slice(0, 8)); // Show max 8 blocks
      } catch (error) {
        console.error('Failed to load blocks:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadBlocks();
    const interval = setInterval(loadBlocks, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const formatAge = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getBlockColor = (isAnchored: boolean, index: number): string => {
    if (!isAnchored) {
      return 'from-yellow-600 to-orange-700'; // Pending blocks are orange/yellow
    }
    // Confirmed blocks use purple/blue gradient
    const colors = [
      'from-purple-600 to-purple-900',
      'from-violet-600 to-violet-900',
      'from-indigo-600 to-indigo-900',
      'from-blue-600 to-blue-900',
      'from-cyan-700 to-cyan-900',
      'from-teal-700 to-teal-900',
      'from-emerald-700 to-emerald-900',
      'from-green-700 to-green-900',
    ];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <div className="w-full bg-gray-950 rounded-2xl border border-gray-800 p-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="shrink-0 w-44 h-52 bg-gray-900 rounded-lg animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="w-full bg-gray-950 rounded-2xl border border-gray-800 p-8 text-center">
        <div className="text-gray-600 mb-2">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
          </svg>
        </div>
        <p className="text-gray-500">No batches verified yet.</p>
        <p className="text-gray-600 text-sm mt-1">Run the pipeline to see blocks appear.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center">
        <h2 className="text-gray-200 font-semibold flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
          </svg>
          Verified Goldback Batches
        </h2>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="w-3 h-3 rounded bg-linear-to-br from-purple-600 to-purple-900" />
            Anchored
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <span className="w-3 h-3 rounded bg-linear-to-br from-yellow-600 to-orange-700" />
            Pending
          </div>
          <div className="flex items-center gap-2 text-green-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* Blocks Container */}
      <div className="p-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex gap-4 min-w-max">
          <AnimatePresence mode="popLayout">
            {blocks.map((block, index) => (
              <MempoolBlock
                key={block.batchId}
                block={block}
                index={index}
                colorClass={getBlockColor(block.isAnchored ?? true, index)}
                formatAge={formatAge}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Newer batches
        </div>
        <div className="flex items-center gap-1">
          Older batches
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
  colorClass: string;
  formatAge: (minutes: number) => string;
}

function MempoolBlock({ block, index, colorClass, formatAge }: MempoolBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        ease: "easeOut"
      }}
      className="shrink-0 cursor-pointer group"
    >
      <div 
        className={`relative w-40 bg-linear-to-b ${colorClass} rounded-xl border border-white/10 overflow-hidden transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-lg`}
      >
        {/* Top highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent" />
        
        {/* Block Number Header */}
        <div className="px-3 pt-3 pb-2 border-b border-white/10">
          <div className="text-cyan-300 font-mono text-sm font-bold tracking-wider">
            {(block.blockNumber ?? index + 1).toString().padStart(6, '0')}
          </div>
        </div>

        {/* Stats Body */}
        <div className="px-3 py-3 space-y-2">
          {/* Status */}
          <div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider">Status</div>
            <div className={`text-xs font-semibold ${block.isAnchored !== false ? 'text-green-400' : 'text-yellow-400'}`}>
              {block.isAnchored !== false ? 'Anchored' : 'Pending'}
            </div>
          </div>

          {/* Total Value */}
          <div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider">Value</div>
            <div className="text-white font-bold text-xl">
              ${(block.totalValueUsd ?? block.serialCount * 9.18).toFixed(0)}
            </div>
          </div>

          {/* Serial Count */}
          <div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider">Goldbacks</div>
            <div className="text-white/80 text-xs">
              {block.serialCount.toLocaleString()} serials
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-white/10 bg-black/20">
          <div className="text-white/40 text-[9px]">
            {formatAge(block.ageMinutes ?? 0)}
          </div>
        </div>

        {/* Shimmer on hover */}
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
      </div>
    </motion.div>
  );
}
