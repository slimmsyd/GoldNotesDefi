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
      bg: 'bg-[#c9a84c]/20',
      border: 'border-gray-800 hover:border-[#c9a84c]/40',
      icon: 'text-[#c9a84c]',
      glow: 'group-hover:shadow-[#c9a84c]/10',
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
      className={`group bg-gray-900/50 border ${config.border} p-5 relative overflow-hidden transition-all duration-200 hover:translate-y-[-2px] ${config.glow} group-hover:shadow-lg h-full`}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 ${config.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 bg-transparent flex items-center justify-center`}>
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
              className={`flex items-center gap-0.5 text-xs font-medium mb-1 ${trend.isPositive ? 'text-green-400' : 'text-red-400'
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
      <Link href={href} className="block h-full focus:outline-none">
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
          <div key={i} className="bg-gray-900/50 border border-gray-800 p-5 animate-pulse">
            <div className="w-10 h-10 bg-gray-800 mb-3" />
            <div className="w-20 h-3 bg-gray-800 mb-2" />
            <div className="w-24 h-7 bg-gray-800" />
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
          <img src="/AppAssets/PNG Renders/safe_black.png" alt="Treasury" className="w-6 h-6 object-contain drop-shadow-md" />
        }
      />

      <StatCard
        title="Reserves"
        value={data.provenReserves.toLocaleString()}
        subtitle={`${data.totalSupply.toLocaleString()} minted`}
        color="green"
        delay={0.15}
        icon={
          <img src="/AppAssets/PNG Renders/goldbar_black.png" alt="Reserves" className="w-6 h-6 object-contain drop-shadow-md" />
        }
      />

      <StatCard
        title="Batches"
        value={data.totalBatches.toLocaleString()}
        subtitle="ZK proven"
        color="amber"
        delay={0.2}
        icon={
          <img src="/AppAssets/PNG Renders/cheque_black.png" alt="Batches" className="w-6 h-6 object-contain drop-shadow-md" />
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
          <img src="/AppAssets/PNG Renders/bar_chart_black.png" alt="Price" className="w-6 h-6 object-contain drop-shadow-md" />
        }
      />
    </div>
  );
}
