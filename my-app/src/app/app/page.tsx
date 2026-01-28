'use client';

/**
 * App Dashboard Page
 * Route: /app
 * 
 * Displays:
 * - Mempool Blocks (Hero - Top of visual hierarchy)
 * - Solvency Status
 * - Live Supply Stats
 * - Audit Trail
 */

import { useProtocolData } from '@/hooks/useProtocolData';
import { MempoolBlocks } from '@/components/app/dashboard/mempool-blocks';
import { SolvencyHero } from '@/components/app/dashboard/solvency-hero';
import { StatsGrid } from '@/components/app/dashboard/stats-grid';
import { AuditTrail } from '@/components/app/dashboard/audit-trail';

export default function AppDashboard() {
  const { data, isLoading, error, refresh } = useProtocolData({
    refreshInterval: 30000,
  });

  return (
    <div className="space-y-8">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <button
            onClick={refresh}
            className="text-red-400 hover:text-red-300 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero: Mempool-style Blocks (Top of Visual Hierarchy) */}
      <MempoolBlocks />

      {/* Solvency Status */}
      <SolvencyHero data={data} isLoading={isLoading} />

      {/* Stats Grid */}
      <StatsGrid data={data} isLoading={isLoading} />

      {/* Audit Trail (Full Width) */}
      <AuditTrail />

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-gray-600 text-xs border-t border-gray-800 pt-4">
        <span>
          Network: <span className="text-gray-400">Solana Devnet</span>
        </span>
        {data && (
          <span>
            Last updated: {data.lastFetched.toLocaleTimeString()}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="ml-2 text-gray-400 hover:text-white disabled:opacity-50"
            >
              ↻
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
