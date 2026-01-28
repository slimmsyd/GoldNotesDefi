'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

export function SolvencyBadge() {
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
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="h-8 bg-gray-700 rounded w-48 mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-32"></div>
            </div>
        );
    }

    if (error || !status) {
        return (
            <div className="bg-red-900/20 border border-red-800 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-400 font-semibold">Unable to verify on-chain status</span>
                </div>
                <p className="text-red-400/70 text-sm mt-2">{error}</p>
                <button
                    onClick={fetchStatus}
                    className="mt-4 text-sm text-red-400 hover:text-red-300 underline"
                >
                    Retry
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl p-6 ${isSolvent
                ? 'bg-gradient-to-br from-emerald-900/30 to-gray-900 border border-emerald-700/50'
                : 'bg-gradient-to-br from-red-900/30 to-gray-900 border border-red-700/50'
                }`}
        >
            {/* Animated glow effect */}
            <div className={`absolute inset-0 ${isSolvent ? 'bg-emerald-500/5' : 'bg-red-500/5'} blur-3xl`}></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className={`w-4 h-4 rounded-full ${isSolvent ? 'bg-emerald-500' : 'bg-red-500'}`}
                        ></motion.div>
                        <h3 className="text-xl font-bold text-white">
                            {isSolvent ? '✅ Verified Solvent' : '❌ Insolvency Detected'}
                        </h3>
                    </div>
                    <button
                        onClick={fetchStatus}
                        className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Proven Reserves</p>
                        <p className="text-2xl font-bold text-white">{onChain.provenReserves.toLocaleString()}</p>
                        <p className="text-emerald-400 text-xs">Goldbacks</p>
                    </div>

                    <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Token Supply</p>
                        <p className="text-2xl font-bold text-white">{onChain.totalSupply.toLocaleString()}</p>
                        <p className="text-amber-400 text-xs">W3B</p>
                    </div>

                    <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Coverage Ratio</p>
                        <p className={`text-2xl font-bold ${isSolvent ? 'text-emerald-400' : 'text-red-400'}`}>
                            {solvency.ratio !== null ? `${(solvency.ratio * 100).toFixed(0)}%` : '∞'}
                        </p>
                        <p className="text-gray-500 text-xs">{isSolvent ? 'Fully Backed' : 'Under-collateralized'}</p>
                    </div>

                    <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Last Audit</p>
                        <p className="text-lg font-medium text-white truncate">{lastProof}</p>
                        <p className="text-gray-500 text-xs">ZK Verified</p>
                    </div>
                </div>

                {/* Merkle Root */}
                <div className="mt-4 bg-black/20 rounded-lg p-3 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider">Current Merkle Root</p>
                        <p className="text-gray-300 font-mono text-sm truncate max-w-xs md:max-w-md">
                            {onChain.currentMerkleRoot}
                        </p>
                    </div>
                    <a
                        href="https://solscan.io/account/CWYNiviNYPEApbGjjhDPZ8vmxRTMJiHsJto8JRZNPG8s?cluster=devnet"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1"
                    >
                        View Protocol State
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
