'use client';

import { motion } from 'framer-motion';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { PublicKey } from '@solana/web3.js';

const TREASURY = new PublicKey(PROTOCOL_CONFIG.treasury);

interface TreasuryBalanceProps {
    treasuryBalance: number | null;
    isLoading: boolean;
    onRefresh?: () => void;
}

export function TreasuryBalance({ treasuryBalance, isLoading, onRefresh }: TreasuryBalanceProps) {
    if (isLoading) {
        return (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-32 mb-3"></div>
                <div className="h-10 bg-gray-700 rounded w-24"></div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-amber-900/20 to-gray-900 border border-amber-700/30 rounded-2xl p-6 relative overflow-hidden"
        >
            {/* Animated gold shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent animate-shimmer"></div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                            <span className="text-black font-bold text-sm">G</span>
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Treasury Vault</h3>
                            <p className="text-gray-500 text-xs">Available for Purchase</p>
                        </div>
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Refresh"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-amber-400">
                        {treasuryBalance?.toLocaleString() ?? '—'}
                    </span>
                    <span className="text-gray-400 text-lg">W3B</span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Treasury Address</span>
                    <a
                        href={`https://solscan.io/account/${TREASURY.toBase58()}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
                    >
                        {TREASURY.toBase58().slice(0, 4)}...{TREASURY.toBase58().slice(-4)}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
            </div>
        </motion.div>
    );
}

