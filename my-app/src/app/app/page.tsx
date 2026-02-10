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
import { MempoolBlocks } from '@/components/app/dashboard/mempool-blocks';
import { SolvencyHero } from '@/components/app/dashboard/solvency-hero';
import { StatsGrid } from '@/components/app/dashboard/stats-grid';
import { AuditTrail } from '@/components/app/dashboard/audit-trail';
import { ArchitectureExplainer } from '@/components/app/dashboard/architecture-explainer';
import { VerifyNowButton } from '@/components/app/dashboard/verify-now-button';

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
          <h1 className="text-4xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-400 mt-2">Real-time protocol overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Verify Now (Admin Only) */}
          <VerifyNowButton onComplete={refresh} />

          {/* Refresh Button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 px-4 py-2 text-gray-400 hover:text-white hover:border-[#c9a84c]/50 transition-colors disabled:opacity-50 focus:outline-none cursor-pointer"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-xs font-medium">Refresh</span>
          </button>
        </div>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/20 border border-red-500/30 p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-red-400 font-medium text-sm">Connection Error</p>
              <p className="text-red-400/70 text-xs">{error}</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="bg-red-500/20 text-red-400 font-medium px-4 py-3 hover:bg-red-500/30 border border-red-500/30 transition-colors text-sm focus:outline-none"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* 1. SOLVENCY STATUS - Primary focal point */}
      <motion.div variants={fadeInUp}>
        <SolvencyHero data={data} isLoading={isLoading} />
      </motion.div>

      {/* 1.5 ARCHITECTURE EXPLAINER - How the trust model works */}
      <motion.div variants={fadeInUp}>
        <ArchitectureExplainer />
      </motion.div>

      {/* 2. KEY METRICS - Supporting data */}
      <motion.div variants={fadeInUp}>
        <StatsGrid data={data} isLoading={isLoading} />
      </motion.div>

      {/* 3. MEMPOOL BLOCKS - Live activity */}
      <motion.div variants={fadeInUp}>
        <MempoolBlocks goldbackPrice={data?.goldbackPrice ?? null} />
      </motion.div>

      {/* 4. AUDIT TRAIL - Historical data */}
      <motion.div variants={fadeInUp}>
        <AuditTrail />
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
