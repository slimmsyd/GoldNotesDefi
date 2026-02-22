'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoldbackSerialRecord } from '@/lib/protocol-constants';
import {
  fetchBatchStats,
  fetchPendingSerialsCount,
  fetchRecentPendingSerials,
  BatchStats,
} from '@/lib/supabase-protocol';

interface MempoolVisualizerProps {
  className?: string;
}

export function MempoolVisualizer({ className }: MempoolVisualizerProps) {
  const [pendingSerials, setPendingSerials] = useState<GoldbackSerialRecord[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [batches, setBatches] = useState<BatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    async function loadData() {
      const [pendingSerialsResult, pendingCountResult, batchStatsResult] = await Promise.allSettled([
        fetchRecentPendingSerials(50),
        fetchPendingSerialsCount(),
        fetchBatchStats(),
      ]);

      let resolvedPendingSerials: GoldbackSerialRecord[] = [];

      if (pendingSerialsResult.status === 'fulfilled') {
        resolvedPendingSerials = pendingSerialsResult.value;
        setPendingSerials(resolvedPendingSerials);
      } else {
        console.error('Failed to load pending serial stream', pendingSerialsResult.reason);
      }

      if (pendingCountResult.status === 'fulfilled') {
        setPendingTotal(pendingCountResult.value);
      } else {
        console.warn('Falling back pending count to stream length', pendingCountResult.reason);
        setPendingTotal(
          resolvedPendingSerials.length > 0
            ? resolvedPendingSerials.length
            : pendingSerials.length
        );
      }

      if (batchStatsResult.status === 'fulfilled') {
        setBatches(batchStatsResult.value.filter((batch) => batch.isAnchored));
      } else {
        console.error('Failed to load batch stats', batchStatsResult.reason);
        setBatches([]);
      }

      setIsLoading(false);
    }

    loadData();
    const interval = setInterval(loadData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const { displayPendingSerials, confirmedBatches } = useMemo(() => {
    const displayStream = pendingSerials.slice(0, 15);
    return {
      displayPendingSerials: displayStream,
      confirmedBatches: batches.filter((batch) => batch.isAnchored),
    };
  }, [pendingSerials, batches]);

  return (
    <div className={`w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          <h3 className="text-white font-medium tracking-wide">Live Protocol Activity</h3>
        </div>
        <div className="flex gap-6 text-xs font-bold text-gray-500 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full" />
            Raw Ingest
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Verified Batch
          </div>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12 relative">
        {/* Vertical Separator (Desktop only) */}
        <div className="absolute left-1/2 top-8 bottom-8 w-px bg-linear-to-b from-transparent via-gray-800 to-transparent hidden lg:block" />

        {/* 1. Ingest Stream */}
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Incoming Serials</h4>
            <span className="text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/30 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">
              {pendingTotal} PENDING
            </span>
          </div>
          {pendingTotal > displayPendingSerials.length && (
            <div className="text-[10px] text-gray-500 mb-3">
              Showing latest {displayPendingSerials.length} of {pendingTotal}
            </div>
          )}

          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar mask-linear-fade">
            <AnimatePresence mode="popLayout">
              {displayPendingSerials.map((serial, index) => (
                <motion.div
                  key={serial.id}
                  initial={{ opacity: 0, x: -20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="shrink-0"
                >
                  <GoldbackTicket serial={serial} />
                </motion.div>
              ))}
            </AnimatePresence>
            {displayPendingSerials.length === 0 && !isLoading && (
              <div className="w-full h-24 flex items-center justify-center text-gray-600 text-sm italic border border-dashed border-gray-800">
                Waiting for serials...
              </div>
            )}
          </div>
        </div>

        {/* 2. Verified Batches */}
        <div className="relative pl-0 lg:pl-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Anchored Batches</h4>
            <span className="text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">
              {confirmedBatches.length} VERIFIED
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {confirmedBatches.map((batch) => (
              <BatchBlock key={batch.batchId} batch={batch} />
            ))}
            {confirmedBatches.length === 0 && !isLoading && (
              <div className="w-full h-24 flex items-center justify-center text-gray-600 text-sm italic border border-dashed border-gray-800">
                No verified batches yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GoldbackTicket({ serial }: { serial: GoldbackSerialRecord }) {
  return (
    <div className="group w-40 relative">
      <div className="absolute inset-0 bg-[#c9a84c]/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[24px]" />
      <div className="relative bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] p-4 transition-all duration-300 group-hover:-translate-y-1 rounded-[24px]">
        <div className="flex items-center justify-between mb-3">
          <div className="px-2 py-1 bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center text-[#c9a84c] text-[10px] font-bold rounded-full">
            $1.00
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse shadow-[0_0_8px_rgba(201,168,76,0.8)]" />
        </div>
        <div className="font-mono text-white/90 font-medium text-xs tracking-wider mb-1 px-1">
          {serial.serial_number}
        </div>
        <div className="text-[10px] text-gray-500 font-mono px-1">
          {new Date(serial.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function BatchBlock({ batch }: { batch: BatchStats }) {
  return (
    <div className="group w-48 relative shrink-0">
      <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[24px]" />
      <div className="relative bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] p-5 transition-all duration-300 group-hover:-translate-y-1 rounded-[24px]">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Batch ID</span>
            <span className="text-white/90 text-xs font-mono font-medium truncate w-20" title={batch.batchId}>
              {batch.batchId.split('-').pop()}...
            </span>
          </div>
          <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full shadow-lg">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="flex items-end gap-2 mb-3">
          <span className="text-3xl font-bold text-white tracking-tighter leading-none">{batch.serialCount}</span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Items</span>
        </div>

        <div className="w-full bg-white/5 h-1 mb-3 overflow-hidden rounded-full">
          <div className="bg-blue-400 h-full w-full rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
        </div>

        <div className="text-[10px] text-gray-500 font-mono text-right">
          {new Date(batch.latestReceived).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
