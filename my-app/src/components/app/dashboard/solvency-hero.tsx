'use client';

import { motion } from 'framer-motion';
import { ProtocolData } from '@/lib/protocol-constants';

interface SolvencyHeroProps {
  data: ProtocolData | null;
  isLoading: boolean;
}

export function SolvencyHero({ data, isLoading }: SolvencyHeroProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 animate-pulse">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gray-800 rounded-full" />
          <div className="space-y-3">
            <div className="w-48 h-8 bg-gray-800 rounded" />
            <div className="w-64 h-4 bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const { isSolvent, provenReserves, totalSupply, lastProofTimestamp, treasuryBalance } = data;
  const circulatingSupply = totalSupply - treasuryBalance;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-3xl p-8 border ${isSolvent
        ? 'bg-gradient-to-br from-green-950/50 to-gray-900/50 border-green-800/50'
        : 'bg-gradient-to-br from-red-950/50 to-gray-900/50 border-red-800/50'
        }`}
    >
      {/* Background glow */}
      <div
        className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-20 ${isSolvent ? 'bg-green-500' : 'bg-red-500'
          }`}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
        {/* Status Icon */}
        <div
          className={`w-20 h-20 flex-shrink-0 rounded-full flex items-center justify-center shadow-lg shadow-black/50 ${isSolvent
            ? 'bg-green-500/10 border-2 border-green-500 text-green-500'
            : 'bg-red-500/10 border-2 border-red-500 text-red-500'
            }`}
        >
          {isSolvent ? (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <div className="flex-1">
          <h2 className={`text-3xl md:text-4xl font-extrabold tracking-tight mb-2 ${isSolvent ? 'text-green-400' : 'text-red-400'}`}>
            {isSolvent ? 'Fully Backed' : 'Under-Collateralized'}
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            The W3B Protocol currently holds <span className="font-bold text-white">{provenReserves.toLocaleString()}</span> verified Goldbacks
            backing <span className="font-bold text-white">{totalSupply.toLocaleString()}</span> minted W3B tokens.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            <span className="text-amber-400 font-semibold">{treasuryBalance.toLocaleString()}</span> in Treasury (available) ·
            <span className="text-white font-semibold ml-1">{circulatingSupply.toLocaleString()}</span> in circulation
          </p>

          {lastProofTimestamp && (
            <div className="mt-4 inline-flex items-center gap-2 bg-gray-950/50 rounded-full px-4 py-1.5 border border-gray-800">
              <div className={`w-2 h-2 rounded-full ${isSolvent ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <p className="text-gray-400 text-sm font-mono">
                Last Verified: {lastProofTimestamp.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Solvency ratio bar */}
      <div className="mt-8 relative">
        <div className="flex justify-between text-xs font-mono text-gray-500 mb-2 uppercase tracking-wider">
          <span>Supply: {totalSupply.toLocaleString()}</span>
          <span>Reserves: {provenReserves.toLocaleString()}</span>
        </div>
        <div className="h-3 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: totalSupply === 0 ? '100%' : `${Math.min((provenReserves / totalSupply) * 100, 100)}%` }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
            className={`h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${isSolvent ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
          />
        </div>
      </div>
    </motion.div>
  );
}
