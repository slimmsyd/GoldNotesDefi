'use client';

import { useProtocolData } from '@/hooks/useProtocolData';
import { MempoolVisualizer } from '@/components/app/vault/mempool-visualizer';
import { ReserveGrowthChart } from '@/components/app/vault/reserve-growth-chart';
import { GoldbackBubbles } from '@/components/app/vault/goldback-bubbles';
import { SolvencyBadge } from '@/components/app/vault/solvency-badge';
import { ProofHistoryTable } from '@/components/app/vault/proof-history-table';
import { TransparencyHeader } from '@/components/app/vault/transparency-header';
import { ArchitectureExplainer } from '@/components/app/dashboard/architecture-explainer';
import { AuditTrail } from '@/components/app/dashboard/audit-trail';

export default function VaultPage() {
  const { data, isLoading, refresh } = useProtocolData({ refreshInterval: 30000 });

  return (
    <div className="space-y-10">
      <TransparencyHeader />

      {/* 1. The Guarantee: Top Level Solvency & Architecture */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SolvencyBadge />
        </div>
        <div className="lg:col-span-1">
          <ArchitectureExplainer />
        </div>
      </section>

      {/* 2. The Ledger: Live Flows */}
      <section className="w-full">
        {/* <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Live Ledger</h2>
        </div> */}
        <div className="w-full">
          <MempoolVisualizer className="h-full min-h-[320px]" />
        </div>
      </section>

      {/* 3. The Deep Dive: Historical Charts */}
      <section className="w-full space-y-6">
        <div className="w-full">
          <ReserveGrowthChart />
        </div>
        {/* <div className="w-full">
          <GoldbackBubbles />
        </div> */}
      </section>

      {/* 4. The Audit Trail: Historical Data Tables */}
      <section className="w-full space-y-6">
        <div className="flex justify-between items-center border-b border-gray-800/50 pb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Immutable Audit Trail</h2>
        </div>
        <AuditTrail />
        <ProofHistoryTable />
      </section>
    </div>
  );
}
