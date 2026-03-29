'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UPMARatesData } from '@/hooks/useUPMARates';

interface ProtocolStatus {
    success: boolean;
    data: {
        onChain: {
            totalSupply: number;
            provenReserves: number;
            lastProofTimestamp: string | null;
            currentMerkleRoot: string;
            isPaused: boolean;
        };
        solvency: {
            isSolvent: boolean;
            ratio: number | null;
            status: 'SOLVENT' | 'INSOLVENT';
        };
        fetchedAt: string;
    };
}

export function SolvencyBadge({ upmaRates }: { upmaRates?: UPMARatesData | null }) {
    const [status, setStatus] = useState<ProtocolStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/protocol-status');
            const data = await res.json();

            if (data.success) {
                setStatus(data);
                setError(null);
            } else {
                setError(data.error || 'Failed to fetch protocol status');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 animate-pulse rounded-[32px] h-full">
                <div className="h-8 bg-white/10 w-48 mb-4 rounded-full"></div>
                <div className="h-4 bg-white/5 w-32 rounded-full"></div>
            </div>
        );
    }

    if (error || !status) {
        return (
            <div className="bg-red-950/40 backdrop-blur-xl border border-red-500/30 p-8 rounded-[32px] h-full flex flex-col justify-center">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-red-500 animate-pulse rounded-full"></div>
                    <span className="text-red-400 font-bold tracking-wide">SYSTEM ERROR</span>
                </div>
                <p className="text-red-400/70 text-sm mt-2 font-mono">{error}</p>
                <button
                    onClick={fetchStatus}
                    className="mt-6 w-fit bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 px-6 py-2 rounded-full font-bold text-xs tracking-wider transition-all"
                >
                    RETRY CONNECTION
                </button>
            </div>
        );
    }

    const { onChain, solvency } = status.data;
    const isSolvent = solvency.isSolvent;
    const lastProof = onChain.lastProofTimestamp
        ? new Date(onChain.lastProofTimestamp).toLocaleString()
        : 'Never';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative overflow-hidden p-8 rounded-[32px] h-full flex flex-col justify-between bg-black/40 backdrop-blur-xl border ${isSolvent ? 'border-emerald-500/20' : 'border-red-500/20'}`}
        >
            {/* Abstract Background Element */}
            <div className={`absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-radial rounded-full blur-[100px] opacity-30 z-0 ${isSolvent ? 'from-emerald-500/20 to-transparent' : 'from-red-500/20 to-transparent'}`}></div>

            <div className="relative z-10 flex-1 flex flex-col justify-between h-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md shadow-lg ${isSolvent ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className={`w-2 h-2 rounded-full ${isSolvent ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]'}`}
                            ></motion.div>
                            <span className="text-xs font-bold tracking-widest uppercase">
                                {isSolvent ? 'System Solvent' : 'Insolvency Detected'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={fetchStatus}
                        className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest"
                        title="Refresh"
                    >
                        Refresh
                    </button>
                </div>

                {/* Massive Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-auto">
                    {/* Stat Block 1 */}
                    <div className="relative group p-4 border border-white/5 bg-white/[0.02] rounded-[24px] hover:bg-white/[0.04] transition-colors overflow-hidden flex flex-col justify-end min-h-[140px]">
                        <div className="absolute -bottom-4 -right-2 text-[80px] font-black text-white/[0.03] leading-none select-none pointer-events-none tracking-tighter truncate z-0">
                            {onChain.provenReserves}
                        </div>
                        <div className="relative z-10 flex flex-col items-start">
                            <h4 className="text-[32px] font-bold text-white tracking-tighter leading-none mb-1">{onChain.provenReserves.toLocaleString()}</h4>
                            <p className="text-[#c9a84c] text-[10px] font-bold uppercase tracking-widest">Physical Goldbacks</p>
                        </div>
                    </div>

                    {/* Stat Block 2 */}
                    <div className="relative group p-4 border border-white/5 bg-white/[0.02] rounded-[24px] hover:bg-white/[0.04] transition-colors overflow-hidden flex flex-col justify-end min-h-[140px]">
                        <div className="absolute -bottom-4 -right-2 text-[80px] font-black text-white/[0.03] leading-none select-none pointer-events-none tracking-tighter truncate z-0">
                            {onChain.totalSupply}
                        </div>
                        <div className="relative z-10 flex flex-col items-start">
                            <h4 className="text-[32px] font-bold text-white tracking-tighter leading-none mb-1">{onChain.totalSupply.toLocaleString()}</h4>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Minted WGB</p>
                        </div>
                    </div>

                    {/* Stat Block 3 */}
                    <div className="relative group p-4 border border-white/5 bg-white/[0.02] rounded-[24px] hover:bg-white/[0.04] transition-colors overflow-hidden flex flex-col justify-end min-h-[140px]">
                        <div className="absolute -bottom-4 -right-2 text-[80px] font-black text-white/[0.03] leading-none select-none pointer-events-none tracking-tighter truncate z-0">
                            {solvency.ratio !== null ? `${(solvency.ratio * 100).toFixed(0)}` : '∞'}
                        </div>
                        <div className="relative z-10 flex flex-col items-start">
                            <h4 className={`text-[32px] font-bold tracking-tighter leading-none mb-1 ${isSolvent ? 'text-emerald-400' : 'text-red-400'}`}>
                                {solvency.ratio !== null ? `${(solvency.ratio * 100).toFixed(0)}%` : '∞'}
                            </h4>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{isSolvent ? 'Coverage Ratio' : 'Under-collateralized'}</p>
                        </div>
                    </div>

                    {/* Stat Block 4 */}
                    <div className="relative group p-4 border border-white/5 bg-white/[0.02] rounded-[24px] hover:bg-white/[0.04] transition-colors overflow-hidden flex flex-col justify-end min-h-[140px]">
                        <div className="relative z-10 flex flex-col items-start mt-auto">
                            <h4 className="text-lg font-bold text-white tracking-tight leading-snug mb-1 truncate w-full">{lastProof}</h4>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Last ZK Audit</p>
                        </div>
                    </div>
                </div>

                {/* Commodity Backing — from UPMA */}
                {upmaRates && upmaRates.goldSpot !== null && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                        <div className="p-4 border border-white/5 bg-white/[0.02] rounded-[24px]">
                            <p className="text-[#c9a84c] text-[10px] font-bold uppercase tracking-widest mb-1">Gold Spot</p>
                            <h4 className="text-xl font-bold text-white tracking-tight">${upmaRates.goldSpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                            <p className="text-gray-500 text-[10px]">per troy ounce</p>
                        </div>
                        {upmaRates.silverSpot !== null && (
                            <div className="p-4 border border-white/5 bg-white/[0.02] rounded-[24px]">
                                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Silver Spot</p>
                                <h4 className="text-xl font-bold text-white tracking-tight">${upmaRates.silverSpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                                <p className="text-gray-500 text-[10px]">per troy ounce</p>
                            </div>
                        )}
                        {upmaRates.goldbackRate !== null && (
                            <div className="p-4 border border-white/5 bg-white/[0.02] rounded-[24px]">
                                <p className="text-[#c9a84c] text-[10px] font-bold uppercase tracking-widest mb-1">Reserve Value</p>
                                <h4 className="text-xl font-bold text-white tracking-tight">
                                    ${(onChain.provenReserves * upmaRates.goldbackRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </h4>
                                <p className="text-gray-500 text-[10px]">{onChain.provenReserves} GB x ${upmaRates.goldbackRate.toFixed(2)}</p>
                            </div>
                        )}
                        <div className="col-span-full flex items-center gap-1.5 px-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                UPMA Live {upmaRates.dayOfRate ? `\u00B7 ${upmaRates.dayOfRate}` : ''}
                            </span>
                        </div>
                    </div>
                )}

                {/* Footer: Merkle Root & Explorer Link */}
                <div className="mt-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-[24px]">
                    <div className="flex flex-col">
                        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Current Merkle Root</span>
                        <code className="text-gray-300 font-mono text-sm tracking-tight w-full md:w-auto overflow-hidden text-ellipsis whitespace-nowrap md:max-w-md">
                            {onChain.currentMerkleRoot}
                        </code>
                    </div>
                    <a
                        href="https://solscan.io/account/CWYNiviNYPEApbGjjhDPZ8vmxRTMJiHsJto8JRZNPG8s?cluster=devnet"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#c9a84c]/20 transition-all flex items-center gap-2"
                    >
                        View On-Chain State
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
