'use client';

/**
 * Solvency Hero Component
 * GoldBack Design System Implementation
 *
 * Displays protocol solvency status with visual indicators
 */

import { motion } from 'framer-motion';
import { ProtocolData } from '@/lib/protocol-constants';

interface SolvencyHeroProps {
  data: ProtocolData | null;
  isLoading: boolean;
}

// Step-based staleness indicator configuration
const getStalenessConfig = (timestamp: Date) => {
  const hoursAgo = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) return { color: 'text-green-400', dot: 'bg-green-500', label: 'Fresh', hoursAgo };
  if (hoursAgo < 36) return { color: 'text-yellow-400', dot: 'bg-yellow-500', label: 'Aging', hoursAgo };
  if (hoursAgo < 48) return { color: 'text-orange-400', dot: 'bg-orange-500', label: 'Warning', hoursAgo };
  return { color: 'text-red-400', dot: 'bg-red-500', label: 'Stale', hoursAgo };
};

const formatTimeAgo = (hoursAgo: number): string => {
  if (hoursAgo < 1) return `${Math.floor(hoursAgo * 60)}m ago`;
  if (hoursAgo < 24) return `${Math.floor(hoursAgo)}h ago`;
  return `${Math.floor(hoursAgo / 24)}d ago`;
};

export function SolvencyHero({ data, isLoading }: SolvencyHeroProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-[4.5px] h-full animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gray-800" />
          <div className="flex-1 space-y-3">
            <div className="w-32 h-6 bg-gray-800" />
            <div className="w-full h-4 bg-gray-800" />
            <div className="w-3/4 h-4 bg-gray-800" />
          </div>
        </div>
        <div className="mt-6 h-2 bg-gray-800" />
      </div>
    );
  }

  const { isSolvent, provenReserves, totalSupply, lastProofTimestamp, treasuryBalance } = data;
  const circulatingSupply = totalSupply - treasuryBalance;
  const solvencyRatio = totalSupply === 0 ? 100 : Math.min((provenReserves / totalSupply) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden border rounded-[4.5px] h-full ${isSolvent
        ? 'bg-gradient-to-br from-green-500/5 via-gray-900/50 to-gray-900/50 border-green-500/20'
        : 'bg-gradient-to-br from-red-500/5 via-gray-900/50 to-gray-900/50 border-red-500/20'
        }`}
    >
      {/* Background glow */}
      <div
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-30 ${isSolvent ? 'bg-green-500' : 'bg-red-500'
          }`}
      />

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          {/* Status Icon */}
          <div
            className={`w-14 h-14 flex-shrink-0 flex items-center justify-center bg-transparent`}
          >
            {isSolvent ? (
              <img src="/AppAssets/PNG Renders/profit_shield_black.png" alt="Solvent" className="w-10 h-10 object-contain drop-shadow-md" />
            ) : (
              <img src="/AppAssets/PNG Renders/umbrella_black.png" alt="Insolvent" className="w-10 h-10 object-contain drop-shadow-md" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className={`text-xl font-bold ${isSolvent ? 'text-green-400' : 'text-red-400'}`}>
                {isSolvent ? 'Fully Backed' : 'Under-Collateralized'}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium ${isSolvent ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSolvent ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isSolvent ? 'bg-green-500' : 'bg-red-500'}`} />
                </span>
                {solvencyRatio.toFixed(0)}%
              </span>
              {/* Zeroth Law Circuit Breaker Badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-gray-800/50 text-gray-400 border border-gray-700"
                title="Minting is blocked if reserves fall below token supply"
              >
                <img src="/AppAssets/PNG Renders/lock_black.png" alt="Circuit Breaker" className="w-5 h-5 object-contain drop-shadow-md" />
                Circuit Breaker
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              <span className="text-white font-semibold">{provenReserves.toLocaleString()}</span> reserves backing{' '}
              <span className="text-white font-semibold">{totalSupply.toLocaleString()}</span> W3B tokens
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800/30 p-3 border border-gray-800/50">
            <div className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">Treasury</div>
            <div className="text-[#e8d48b] font-bold text-lg">{treasuryBalance.toLocaleString()}</div>
            <div className="text-gray-500 text-xs">Available Supply</div>
          </div>
          <div className="bg-gray-800/30 p-3 border border-gray-800/50">
            <div className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">Circulating</div>
            <div className="text-white font-bold text-lg">{circulatingSupply.toLocaleString()}</div>
            <div className="text-gray-500 text-xs">In Circulation</div>
          </div>
        </div>

        {/* Solvency Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-gray-500 font-medium">Collateralization</span>
            <span className={`font-mono font-bold ${isSolvent ? 'text-green-400' : 'text-red-400'}`}>
              {solvencyRatio.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-gray-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${solvencyRatio}%` }}
              transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
              className={`h-full ${isSolvent
                ? 'bg-gradient-to-r from-green-600 to-green-400'
                : 'bg-gradient-to-r from-red-600 to-red-400'
                }`}
            />
          </div>
        </div>

        {/* Last Verified Timestamp with Staleness Indicator */}
        {lastProofTimestamp && (() => {
          const staleness = getStalenessConfig(lastProofTimestamp);
          return (
            <div
              className="mt-4 flex items-center gap-2 text-xs"
              title="Proofs must be less than 48 hours old for minting to be enabled"
            >
              <span className={`relative flex h-2 w-2`}>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${staleness.dot}`} />
              </span>
              <span className={staleness.color}>
                Verified {formatTimeAgo(staleness.hoursAgo)}
              </span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">
                {staleness.label === 'Stale' ? (
                  <span className="text-red-400 font-medium">48h limit exceeded</span>
                ) : (
                  `${Math.max(0, Math.floor(48 - staleness.hoursAgo))}h until stale`
                )}
              </span>
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
}
