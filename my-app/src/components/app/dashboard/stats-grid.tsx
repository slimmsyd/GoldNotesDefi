'use client';

/**
 * Stats Grid Component
 * GoldBack Design System Implementation
 *
 * Displays key protocol metrics in a responsive grid
 */

import { motion } from 'framer-motion';
import { ProtocolData } from '@/lib/protocol-constants';
import { UPMARatesData } from '@/hooks/useUPMARates';
import Link from 'next/link';

interface StatsGridProps {
  data: ProtocolData | null;
  isLoading: boolean;
  upmaRates?: UPMARatesData | null;
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
  actionLabel?: string;
}

function StatCard({ title, value, subtitle, icon, color, delay = 0, href, trend, actionLabel }: StatCardProps) {
  // Config for the pill backgrounds and accents
  const colorConfig = {
    amber: {
      bg: 'bg-[#c9a84c]/20',
      border: 'border-white/10 hover:border-white/20',
      pillBg: 'bg-[#c9a84c]/10 border border-[#c9a84c]/30 backdrop-blur-sm',
      pillText: 'text-[#c9a84c]',
      gradient: 'from-[#c9a84c]/20 to-transparent',
    },
    green: {
      bg: 'bg-green-500/20',
      border: 'border-white/10 hover:border-white/20',
      pillBg: 'bg-green-500/10 border border-green-500/30 backdrop-blur-sm',
      pillText: 'text-green-400',
      gradient: 'from-green-500/20 to-transparent',
    },
  };

  const config = colorConfig[color];
  const watermarkValue = String(value).replace(/[A-Za-z\s]/g, ''); // Extract just numbers and symbols

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`group bg-black/40 backdrop-blur-xl border ${config.border} p-6 relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] rounded-[32px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] h-[220px] flex flex-col justify-between`}
    >
      {/* Abstract Background Element (Mimics the reference image wave) */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 bg-gradient-radial ${config.gradient} rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 z-0`} />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0" />

      {/* Massive Faded Background Typography */}
      <div className="absolute -bottom-6 -right-2 text-[120px] font-black text-white/[0.04] leading-none select-none pointer-events-none tracking-tighter truncate w-[150%] text-right z-0">
        {watermarkValue}
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Top Row: Title + Status Pill */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <h4 className="text-white font-medium text-lg leading-tight drop-shadow-md">{title}</h4>

          {trend ? (
            <span
              className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-md ${trend.isPositive ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'
                }`}
            >
              <svg className={`w-2.5 h-2.5 ${trend.isPositive ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {trend.value}%
            </span>
          ) : (
            <span className="flex-shrink-0 bg-white/10 text-gray-300 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full whitespace-nowrap border border-white/5">
              {color === 'green' ? 'Verified' : 'Live'}
            </span>
          )}
        </div>

        {/* Middle Row: Massive Foreground Value + Subtitle */}
        <div className="my-auto pt-2">
          <h3 className="text-[40px] font-bold text-white tracking-tighter leading-none drop-shadow-lg">{value}</h3>
          {subtitle && (
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-2">
              {subtitle}
            </p>
          )}
        </div>

        {/* Bottom Row: Action / Status Pill */}
        <div className="flex items-center gap-3 mt-4">
          <div className={`${config.pillBg} ${config.pillText} px-4 py-1.5 rounded-full font-bold text-xs tracking-wider shadow-lg flex-shrink-0 flex items-center gap-2 uppercase`}>
            {actionLabel || 'VIEW DETAILS'}
          </div>

          {href && (
            <div className="bg-white/5 border border-white/10 w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#c9a84c] hover:text-black hover:border-transparent transition-all ml-auto flex-shrink-0 cursor-pointer shadow-lg text-white group-hover:bg-white/10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus:outline-none focus:ring-2 focus:ring-[#c9a84c] rounded-[32px]">
        {content}
      </Link>
    );
  }

  return content;
}

export function StatsGrid({ data, isLoading, upmaRates }: StatsGridProps) {
  const hasMetals = upmaRates && (upmaRates.goldSpot !== null || upmaRates.silverSpot !== null);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 p-5 rounded-[4.5px] animate-pulse">
            <div className="w-10 h-10 bg-gray-800 mb-3" />
            <div className="w-20 h-3 bg-gray-800 mb-2" />
            <div className="w-24 h-7 bg-gray-800" />
          </div>
        ))}
      </div>
    );
  }

  // Build spread subtitle for WGB price card
  const wgbSpreadSubtitle = upmaRates?.goldbackBuyBack != null
    ? `BUY $${(upmaRates.goldbackRate ?? data.goldbackPrice ?? 0).toFixed(2)} / SELL $${upmaRates.goldbackBuyBack.toFixed(2)}`
    : data.isGoldbackPriceStale ? 'PRICE MAY BE OUTDATED' : '1:1 GOLDBACK PEG';

  return (
    <div className={`grid grid-cols-2 ${hasMetals ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
      <StatCard
        title="Asset Backing"
        value={data.provenReserves.toLocaleString()}
        subtitle="100% physically backed"
        color="green"
        delay={0.1}
        actionLabel="VAULT SECURED"
        icon={
          <img src="/AppAssets/PNG Renders/safe_black.png" alt="Treasury" className="w-6 h-6 object-contain drop-shadow-md" />
        }
      />

      <StatCard
        title="Circulating Supply"
        value={`${data.totalSupply.toLocaleString()} WGB`}
        subtitle="MINTED SUPPLY"
        color="amber"
        delay={0.15}
        actionLabel="ON-CHAIN"
        icon={
          <img src="/AppAssets/PNG Renders/cheque_black.png" alt="Batches" className="w-6 h-6 object-contain drop-shadow-md" />
        }
      />

      <StatCard
        title="WGB Price"
        value={data.goldbackPrice !== null ? `$${data.goldbackPrice.toFixed(2)}` : '—'}
        subtitle={wgbSpreadSubtitle}
        color="amber"
        delay={0.2}
        href="/app/swap"
        actionLabel="SWAP NOW"
        trend={data.goldbackPrice24hChange !== null ? {
          value: Math.abs(Number(data.goldbackPrice24hChange.toFixed(2))),
          isPositive: data.goldbackPrice24hChange >= 0
        } : undefined}
        icon={
          <img src="/AppAssets/PNG Renders/bar_chart_black.png" alt="Price" className="w-6 h-6 object-contain drop-shadow-md" />
        }
      />

      {/* Gold Spot — from UPMA */}
      {hasMetals && upmaRates.goldSpot !== null && (
        <StatCard
          title="Gold Spot"
          value={`$${upmaRates.goldSpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="PER TROY OUNCE"
          color="amber"
          delay={0.25}
          actionLabel="UPMA LIVE"
          trend={upmaRates.goldRateChange != null && upmaRates.goldRateChange !== 0 ? {
            value: Math.abs(upmaRates.goldRateChange),
            isPositive: upmaRates.goldRateChange >= 0
          } : undefined}
          icon={
            <svg className="w-6 h-6 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      )}

      {/* Silver Spot — from UPMA */}
      {hasMetals && upmaRates.silverSpot !== null && (
        <StatCard
          title="Silver Spot"
          value={`$${upmaRates.silverSpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="PER TROY OUNCE"
          color="green"
          delay={0.3}
          actionLabel="UPMA LIVE"
          trend={upmaRates.silverRateChange != null && upmaRates.silverRateChange !== 0 ? {
            value: Math.abs(upmaRates.silverRateChange),
            isPositive: upmaRates.silverRateChange >= 0
          } : undefined}
          icon={
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      )}

      <StatCard
        title="Reserves"
        value={data.provenReserves.toLocaleString()}
        subtitle="PHYSICALLY SECURED"
        color="green"
        delay={0.35}
        actionLabel="AUDIT LIVE"
        icon={
          <img src="/AppAssets/PNG Renders/goldbar_black.png" alt="Reserves" className="w-6 h-6 object-contain drop-shadow-md" />
        }
      />
    </div>
  );
}
