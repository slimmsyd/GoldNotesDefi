'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NetworkStats, FeedEvent } from '@/hooks/useSolanaTransactions';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

/** Animated counter that smoothly increments */
function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    prevRef.current = value;
    if (start === end) return;

    const duration = 800;
    const startTime = performance.now();

    function animate(time: number) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(start + (end - start) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

/** Icon for each feed event type */
function FeedIcon({ type }: { type: FeedEvent['type'] }) {
  if (type === 'w3b_tx') {
    // Gold checkmark for W3B transactions
    return (
      <svg
        className="w-3 h-3 text-[#c9a84c] shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  // Activity pulse for TPS updates
  return (
    <svg
      className="w-3 h-3 text-[#c9a84c]/60 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

interface LiveTransactionFeedProps {
  networkStats: NetworkStats;
  feedEvents: FeedEvent[];
}

export function LiveTransactionFeed({ networkStats, feedEvents }: LiveTransactionFeedProps) {
  const [, setTick] = useState(0);

  // Re-render every 5s to update "X seconds ago" timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-3 w-[280px] sm:w-[320px]">
      {/* ── Live Network Stats Badge ── */}
      <div className="bg-black/60 backdrop-blur-md border border-[#c9a84c]/20 px-4 py-3 rounded-lg">
        {/* Top row: live indicator + TPS */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                networkStats.isConnected ? 'bg-[#c9a84c]' : 'bg-red-400'
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                networkStats.isConnected ? 'bg-[#c9a84c]' : 'bg-red-400'
              }`}
            />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-widest text-[#c9a84c]/70 font-medium">
              {networkStats.isConnected ? 'Live on Solana' : 'Connecting...'}
            </span>
            <span className="text-white text-sm font-semibold tabular-nums">
              {networkStats.tps > 0 ? (
                <>
                  ~<AnimatedCounter value={networkStats.tps} />{' '}
                  <span className="text-gray-400 font-normal text-xs">tx/s</span>
                </>
              ) : (
                <span className="text-gray-400 font-normal text-xs">Loading network data...</span>
              )}
            </span>
          </div>
        </div>

        {/* Stats row */}
        {networkStats.isConnected && (
          <div className="flex items-center justify-between border-t border-[#c9a84c]/10 pt-2 mt-1">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-gray-500">Network Total</span>
              <span className="text-white text-xs font-semibold tabular-nums">
                <AnimatedCounter value={networkStats.totalTransactions} />
              </span>
            </div>
            {networkStats.w3bTxCount > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-wider text-[#c9a84c]/60">W3B Txns</span>
                <span className="text-[#c9a84c] text-xs font-semibold tabular-nums">
                  {networkStats.w3bTxCount}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Scrolling Feed ── */}
      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-hidden">
        <AnimatePresence initial={false}>
          {feedEvents.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`backdrop-blur-sm border px-3 py-2 rounded-md ${
                event.type === 'w3b_tx'
                  ? 'bg-[#c9a84c]/10 border-[#c9a84c]/25'
                  : 'bg-black/40 border-[#c9a84c]/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FeedIcon type={event.type} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-white font-medium truncate">
                      {event.message}
                    </span>
                    <span className="text-[10px] text-gray-500 truncate">
                      {event.detail}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 whitespace-nowrap shrink-0">
                  {formatTimeAgo(event.timestamp)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
