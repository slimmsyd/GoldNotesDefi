'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchBatchStats, BatchStats } from '@/lib/supabase-protocol';

interface RecentBatchesProps {
  goldbackPrice: number | null;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function RecentBatches({ goldbackPrice }: RecentBatchesProps) {
  const [batches, setBatches] = useState<BatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchBatchStats();
        setBatches(data);
      } catch (e) {
        console.error('Failed to load batch stats:', e);
      } finally {
        setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const totalSerials = batches.reduce((sum, b) => sum + b.serialCount, 0);
  const totalValue = goldbackPrice ? totalSerials * goldbackPrice : null;

  if (isLoading) {
    return (
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 animate-pulse">
        <div className="h-6 bg-white/10 rounded-full w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white/5 rounded-[24px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden"
    >
      {/* Header */}
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-white/5 rounded-[12px] border border-white/10 flex items-center justify-center">
            <img
              src="/AppAssets/PNG Renders/safe_open_coins_black.png"
              alt="Batches"
              className="w-6 h-6 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200"
            />
          </div>
          <div>
            <h3 className="text-xl font-medium text-white">Recent Batches</h3>
            <p className="text-gray-500 text-sm mt-1 font-medium">
              Incoming Goldback serial batches
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[#c9a84c] font-bold text-2xl tracking-tighter">
            {totalValue !== null
              ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `${totalSerials.toLocaleString()}`}
          </p>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            {totalValue !== null ? 'Total Value' : 'Total Serials'}
          </p>
        </div>
      </div>

      {/* Batch List */}
      <div className="p-6">
        {batches.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/5 rounded-[24px] border border-white/10 flex items-center justify-center mx-auto mb-4">
              <img
                src="/AppAssets/PNG Renders/calendar_black.png"
                alt="No Batches"
                className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200"
              />
            </div>
            <p className="text-white font-bold tracking-tight mb-2">No Batches Yet</p>
            <p className="text-gray-500 text-sm mb-4">
              Goldback serial batches will appear here after ingestion
            </p>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/30 px-3 py-1.5 rounded-full uppercase tracking-widest">
              Awaiting first batch
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
            {batches.map((batch, index) => {
              const batchValue = goldbackPrice
                ? batch.serialCount * goldbackPrice
                : null;

              return (
                <motion.div
                  key={batch.batchId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.3 }}
                  className="bg-white/[0.02] p-5 border border-white/5 rounded-[24px] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-5">
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {batch.isAnchored ? (
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                          <svg className="w-5 h-5 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Batch Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          batch.isAnchored
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            batch.isAnchored ? 'bg-emerald-400 shadow-[0_0_8px_currentColor]' : 'bg-yellow-400 shadow-[0_0_8px_currentColor]'
                          }`} />
                          {batch.isAnchored ? 'Verified' : 'Pending'}
                        </span>
                        <span className="text-gray-500 text-xs font-medium">
                          {formatTimeAgo(batch.latestReceived)}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs font-mono truncate">
                        {batch.batchId}
                      </p>
                    </div>

                    {/* Serials Count */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-white font-bold text-lg tracking-tight">
                        {batch.serialCount.toLocaleString()}
                      </p>
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                        serials
                      </p>
                    </div>

                    {/* USD Value */}
                    <div className="text-right flex-shrink-0 min-w-[80px]">
                      <p className="text-[#c9a84c] font-bold text-lg tracking-tight">
                        {batchValue !== null
                          ? `$${batchValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '---'}
                      </p>
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                        value
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
