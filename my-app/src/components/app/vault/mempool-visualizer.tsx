'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoldbackSerialRecord } from '@/lib/protocol-constants';
import { fetchRecentSerials, fetchBatchStats, BatchStats } from '@/lib/supabase-protocol';

interface MempoolVisualizerProps {
  className?: string;
}

export function MempoolVisualizer({ className }: MempoolVisualizerProps) {
  const [serials, setSerials] = useState<GoldbackSerialRecord[]>([]);
  const [batches, setBatches] = useState<BatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    async function loadData() {
      try {
        const [recentSerials, batchStats] = await Promise.all([
          fetchRecentSerials(50),
          fetchBatchStats(),
        ]);
        setSerials(recentSerials);
        setBatches(batchStats);
      } catch (error) {
        console.error('Failed to load visualizer data', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const { pendingSerials, confirmedBatches } = useMemo(() => {
    const displayStream = serials.slice(0, 15);
    return {
      pendingSerials: displayStream,
      confirmedBatches: batches,
    };
  }, [serials, batches]);

  return (
    <div className={`w-full bg-gray-900/50 border border-gray-800 overflow-hidden backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-800/50 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <h3 className="text-white font-semibold tracking-wide">Live Protocol Activity</h3>
         </div>
         <div className="flex gap-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-[#c9a84c]" />
               Raw Ingest
            </div>
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
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
             <h4 className="text-gray-400 text-sm font-medium">Incoming Serials</h4>
             <span className="text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 text-xs font-mono">
                {pendingSerials.length} PENDING
             </span>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar mask-linear-fade">
             <AnimatePresence mode="popLayout">
              {pendingSerials.map((serial, index) => (
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
            {pendingSerials.length === 0 && !isLoading && (
               <div className="w-full h-24 flex items-center justify-center text-gray-600 text-sm italic border border-dashed border-gray-800">
                  Waiting for serials...
               </div>
            )}
          </div>
        </div>

        {/* 2. Verified Batches */}
        <div className="relative pl-0 lg:pl-6">
          <div className="flex items-center justify-between mb-6">
             <h4 className="text-gray-400 text-sm font-medium">Anchored Batches</h4>
             <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 text-xs font-mono">
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
      <div className="absolute inset-0 bg-[#c9a84c]/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-gray-900 border border-gray-800 hover:border-[#c9a84c]/50 p-3 transition-all duration-300 group-hover:-translate-y-1">
        <div className="flex items-center justify-between mb-2">
            <div className="w-6 h-6 bg-[#c9a84c]/10 flex items-center justify-center text-[#c9a84c] text-[10px] font-bold">
               $1
            </div>
            <div className="w-1.5 h-1.5 bg-[#c9a84c] animate-pulse" />
        </div>
        <div className="font-mono text-white font-medium text-xs tracking-wider mb-1">
          {serial.serial_number}
        </div>
        <div className="text-[10px] text-gray-500 font-mono">
          {new Date(serial.received_at).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit' })}
        </div>
      </div>
    </div>
  );
}

function BatchBlock({ batch }: { batch: BatchStats }) {
  return (
    <div className="group w-48 relative shrink-0">
       <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
       <div className="relative bg-gray-900 border border-gray-800 hover:border-blue-500/50 p-4 transition-all duration-300 group-hover:-translate-y-1">
         <div className="flex justify-between items-start mb-3">
            <div className="flex flex-col">
               <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Batch</span>
               <span className="text-white text-xs font-mono font-medium truncate w-20" title={batch.batchId}>
                  {batch.batchId.split('-').pop()}...
               </span>
            </div>
            <div className="p-1.5 bg-gray-800 text-green-400">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
               </svg>
            </div>
         </div>
         
         <div className="flex items-end gap-2 mb-2">
            <span className="text-2xl font-bold text-white">{batch.serialCount}</span>
            <span className="text-xs text-gray-500 mb-1">Items</span>
         </div>
         
         <div className="w-full bg-gray-800 h-1 mb-2 overflow-hidden">
            <div className="bg-blue-500 h-full w-full" />
         </div>

         <div className="text-[10px] text-gray-600 font-mono text-right">
            {new Date(batch.latestReceived).toLocaleTimeString()}
         </div>
       </div>
    </div>
  );
}
