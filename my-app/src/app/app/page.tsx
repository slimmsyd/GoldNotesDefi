'use client';

/**
 * App Dashboard Page
 * Route: /app
 *
 * GoldBack Design System Implementation
 * Steve Jobs/Jony Ive Audit - Phase 1 Applied
 *
 * Information Architecture (Priority Order):
 * 1. Solvency Status (CRITICAL - is protocol safe?)
 * 2. Key Metrics (treasury, reserves, batches)
 * 3. Mempool Blocks (live activity)
 * 4. Audit Trail (historical data)
 */

import { motion } from 'framer-motion';
import { useProtocolData } from '@/hooks/useProtocolData';
import { useUPMARates } from '@/hooks/useUPMARates';
import { MempoolBlocks } from '@/components/app/dashboard/mempool-blocks';
import { StatsGrid } from '@/components/app/dashboard/stats-grid';
import { PortfolioHero } from '@/components/app/dashboard/portfolio-hero';
import { QuickActions } from '@/components/app/dashboard/quick-actions';
import { VerifyNowButton } from '@/components/app/dashboard/verify-now-button';
import { RecentBatches } from '@/components/app/dashboard/recent-batches';

// Animation variants - standardized timing (Phase 3)
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export default function AppDashboard() {
  const { data, isLoading, error, refresh } = useProtocolData({
    refreshInterval: 30000,
  });
  const upmaRates = useUPMARates(60_000);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-8"
    >
      {/* Page Header - Single Live indicator (removed duplicate) */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          {/* <h1 className="text-4xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-400 mt-2">Real-time protocol overview</p> */}
        </div>
        <div className="flex items-center gap-3">
          {/* Verify Now (Admin Only) */}
          <VerifyNowButton onComplete={refresh} />

          {/* Refresh Button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 bg-[#c9a84c]/10 border border-[#c9a84c]/30 px-4 py-2 text-[#e8d48b] hover:bg-[#c9a84c]/20 hover:border-[#c9a84c]/50 transition-colors disabled:opacity-50 focus:outline-none cursor-pointer rounded-full min-w-[100px]"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : null}
            <span className="text-xs font-medium">{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/20 border border-red-500/30 p-4 flex items-center justify-between rounded-[4.5px]"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-transparent flex items-center justify-center">
              <img src="/AppAssets/PNG Renders/umbrella_black.png" alt="Error" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <p className="text-red-400 font-medium text-sm">Connection Error</p>
              <p className="text-red-400/70 text-xs">{error}</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="bg-red-500/20 text-red-400 font-medium px-4 py-3 hover:bg-red-500/30 border border-red-500/30 transition-colors text-sm focus:outline-none rounded-[4.5px]"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* 1. PORTFOLIO HERO - Primary focal point */}
      <motion.div variants={fadeInUp}>
        <PortfolioHero data={data} isLoading={isLoading} upmaRates={upmaRates} />
      </motion.div>

      {/* 2. QUICK ACTIONS */}
      <motion.div variants={fadeInUp}>
        <QuickActions />
      </motion.div>

      {/* 3. ASSET STATS - Supporting data */}
      <motion.div variants={fadeInUp}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Asset Information</h3>
        </div>
        <StatsGrid data={data} isLoading={isLoading} upmaRates={upmaRates} />
      </motion.div>

      {/* 4. RECENT BATCHES - Incoming serial batches */}
      <motion.div variants={fadeInUp}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Recent Batches</h3>
        </div>
        <RecentBatches goldbackPrice={data?.goldbackPrice ?? null} />
      </motion.div>

      {/* Footer Meta */}
      <motion.div
        variants={fadeInUp}
        className="flex items-center justify-between text-gray-500 text-xs border-t border-gray-800/50 pt-6"
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#c9a84c]" />
            Network: <span className="text-gray-400">Solana Devnet</span>
          </span>
        </div>
        {data && (
          <span>
            Last updated:{' '}
            <span className="text-gray-400">{data.lastFetched.toLocaleTimeString()}</span>
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}
