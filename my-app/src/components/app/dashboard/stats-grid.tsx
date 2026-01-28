'use client';

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
  color: 'amber' | 'green' | 'blue' | 'purple';
  delay?: number;
}

function StatCard({ title, value, subtitle, icon, color, delay = 0 }: StatCardProps) {
  const colorClasses = {
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-500',
    green: 'from-green-500/20 to-green-600/5 border-green-500/30 text-green-500',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-500',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-6 relative overflow-hidden`}
    >
      <div className="absolute top-4 right-4 opacity-30">
        {icon}
      </div>

      <div className="relative z-10">
        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

export function StatsGrid({ data, isLoading }: StatsGridProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 animate-pulse">
            <div className="w-24 h-4 bg-gray-800 rounded mb-3" />
            <div className="w-16 h-8 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Treasury Balance"
        value={data.treasuryBalance?.toLocaleString() ?? '—'}
        subtitle="Available supply"
        color="amber"
        delay={0.1}
        icon={
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
          </svg>
        }
      />

      <StatCard
        title="Proven Reserves"
        value={data.provenReserves}
        subtitle={`Backing ${data.totalSupply} minted`}
        color="green"
        delay={0.2}
        icon={
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
          </svg>
        }
      />

      <StatCard
        title="Batches"
        value={data.totalBatches}
        subtitle="ZK proven"
        color="blue"
        delay={0.3}
        icon={
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z" />
          </svg>
        }
      />

      <Link href="/app/swap">
        <StatCard
          title="W3B Price"
          value="$9.18"
          subtitle="1:1 Goldback peg"
          color="purple"
          delay={0.4}
          icon={
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
            </svg>
          }
        />
      </Link>
    </div>
  );
}
