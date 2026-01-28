'use client';

import { useProtocolData } from '@/hooks/useProtocolData';
import { MempoolVisualizer } from '@/components/app/vault/mempool-visualizer';
import { ReserveGrowthChart } from '@/components/app/vault/reserve-growth-chart';
import { GoldbackBubbles } from '@/components/app/vault/goldback-bubbles';
import { SolvencyBadge } from '@/components/app/vault/solvency-badge';
import { ProofHistoryTable } from '@/components/app/vault/proof-history-table';
import { TreasuryBalance } from '@/components/app/vault/treasury-balance';

export default function VaultPage() {
  const { data, isLoading, refresh } = useProtocolData({ refreshInterval: 30000 });

  return (
    <div className="space-y-8">
      <div className="max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Vault Visualization</h1>
        <p className="text-xl text-gray-400 font-light leading-relaxed">
          Real-time verification of physical Goldback serials entering the cryptographic reserve.
        </p>
      </div>

      {/* 0. Status Overview: Solvency + Treasury Balance */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SolvencyBadge />
        </div>
        <div className="lg:col-span-1">
          <TreasuryBalance
            treasuryBalance={data?.treasuryBalance ?? null}
            isLoading={isLoading}
            onRefresh={refresh}
          />
        </div>
      </section>

      {/* 1. The Pulse: Live Inflow Stream */}
      <section className="w-full">
        <MempoolVisualizer className="h-[320px]" />
      </section>

      {/* 2. The Big Picture: Historical Growth */}
      <section className="w-full">
        <ReserveGrowthChart />
      </section>

      {/* 3. The Deep Dive: Constellation */}
      <section className="w-full">
        <GoldbackBubbles />
      </section>

      {/* 4. The Audit Trail: Proof History */}
      <section className="w-full">
        <ProofHistoryTable />
      </section>
    </div>
  );
}
