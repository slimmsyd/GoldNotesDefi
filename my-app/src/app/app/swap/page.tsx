'use client';

import { useState } from 'react';
import { SwapInterface } from '@/components/app/swap/swap-interface';
import { RedeemInterface } from '@/components/app/swap/redeem-interface';

const TABS = [
  { key: 'swap', label: 'Swap' },
  { key: 'redeem', label: 'Redeem' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function SwapPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('swap');

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center">
      {/* Tab Selector */}
      <div className="flex gap-1 bg-[#111111] border border-gray-800/50 p-1 mb-6 max-w-[480px] w-full mx-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? tab.key === 'redeem'
                  ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                  : 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.key === 'redeem' && (
              <span className="ml-1.5 text-[10px] opacity-70">BURN</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'swap' && <SwapInterface />}
      {activeTab === 'redeem' && <RedeemInterface />}
    </div>
  );
}
