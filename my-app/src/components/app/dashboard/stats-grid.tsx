'use client';

/**
 * Stats Grid Component
 * GoldBack Design System Implementation
 *
 * Displays key protocol metrics in a responsive grid
 */

import { motion } from 'framer-motion';
import { ProtocolData } from '@/lib/protocol-constants';
import Link from 'next/link';

interface StatsGridProps {
  data: ProtocolData | null;
  isLoading: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'amber' | 'green';
  delay?: number;
  href?: string;
  trend?: { value: number; isPositive: boolean };
}

function StatCard({ title, value, subtitle, icon, color, delay = 0, href, trend }: StatCardProps) {
  // Phase 1.5: Reduced to 2 accent colors only (amber + green)
  const colorConfig = {
    amber: {
      bg: 'bg-amber-500/20',
      border: 'border-gray-800 hover:border-amber-500/40',
      icon: 'text-amber-500',
      glow: 'group-hover:shadow-amber-500/10',
    },
    green: {
      bg: 'bg-green-500/20',
      border: 'border-gray-800 hover:border-green-500/40',
      icon: 'text-green-500',
      glow: 'group-hover:shadow-green-500/10',
    },
  };

  const config = colorConfig[color];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`group bg-gray-900/50 border ${config.border} rounded-2xl p-5 relative overflow-hidden transition-all duration-200 hover:translate-y-[-2px] ${config.glow} group-hover:shadow-lg h-full`}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 ${config.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center`}>
            <div className={config.icon}>{icon}</div>
          </div>
          {href && (
            <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>

        {/* Label */}
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>

        {/* Value */}
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          {trend && (
            <span
              className={`flex items-center gap-0.5 text-xs font-medium mb-1 ${
                trend.isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              <svg
                className={`w-3 h-3 ${trend.isPositive ? '' : 'rotate-180'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {trend.value}%
            </span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}

export function StatsGrid({ data, isLoading }: StatsGridProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 animate-pulse">
            <div className="w-10 h-10 bg-gray-800 rounded-xl mb-3" />
            <div className="w-20 h-3 bg-gray-800 rounded mb-2" />
            <div className="w-24 h-7 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Treasury"
        value={data.treasuryBalance?.toLocaleString() ?? '—'}
        subtitle="Available supply"
        color="green"
        delay={0.1}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <StatCard
        title="Reserves"
        value={data.provenReserves.toLocaleString()}
        subtitle={`${data.totalSupply.toLocaleString()} minted`}
        color="green"
        delay={0.15}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
      />

      <StatCard
        title="Batches"
        value={data.totalBatches.toLocaleString()}
        subtitle="ZK proven"
        color="amber"
        delay={0.2}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
      />

      <StatCard
        title="W3B Price"
        value={data.goldbackPrice !== null ? `$${data.goldbackPrice.toFixed(2)}` : '—'}
        subtitle={data.isGoldbackPriceStale ? 'Price may be outdated' : '1:1 Goldback peg'}
        color="amber"
        delay={0.25}
        href="/app/swap"
        trend={data.goldbackPrice24hChange !== null ? {
          value: Math.abs(Number(data.goldbackPrice24hChange.toFixed(2))),
          isPositive: data.goldbackPrice24hChange >= 0
        } : undefined}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        }
      />
    </div>
  );
}
