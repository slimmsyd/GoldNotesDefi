'use client';

import { motion } from 'framer-motion';
import { ProtocolData } from '@/lib/protocol-constants';

interface PortfolioHeroProps {
    data: ProtocolData | null;
    isLoading: boolean;
}

export function PortfolioHero({ data, isLoading }: PortfolioHeroProps) {
    if (isLoading || !data) {
        return (
            <div className="py-8 animate-pulse text-center">
                <div className="w-32 h-4 bg-gray-800 mx-auto mb-4 rounded" />
                <div className="w-64 h-16 bg-gray-800 mx-auto rounded-lg" />
            </div>
        );
    }

    // Determine user balance (For now we use treasuryBalance as a placeholder/example)
    // In a real Robinhood app, this would be the user's connected wallet balance.
    // Since we want to show a large number, we'll display the W3B Price cleanly if no user balance is assumed, 
    // or a mock user balance if we want to simulate the "Portfolio" feel.

    // Here we'll display the W3B price as the primary highlight, as "1 W3B = $x.xx" 
    // Since 1 W3B = 1 Goldback, we highlight the value of the asset.
    const w3bPrice = data.goldbackPrice ?? 0;
    const isPositive = (data.goldbackPrice24hChange ?? 0) >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="py-10 text-center flex flex-col items-center justify-center"
        >
            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-gray-400 font-medium mb-2 uppercase tracking-widest text-sm"
            >
                W3B Asset Price
            </motion.p>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-6xl md:text-7xl font-bold text-white tracking-tighter mb-4"
            >
                ${w3bPrice.toFixed(2)}
            </motion.h1>

            {data.goldbackPrice24hChange !== null && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2"
                >
                    <span className={`flex items-center gap-1 font-medium px-3 py-1 rounded-full text-sm ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        <svg
                            className={`w-4 h-4 ${isPositive ? '' : 'rotate-180'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        ${Math.abs((w3bPrice * (data.goldbackPrice24hChange / 100))).toFixed(2)} ({Math.abs(data.goldbackPrice24hChange).toFixed(2)}%)
                    </span>
                    <span className="text-gray-500 text-sm">Today</span>
                </motion.div>
            )}
        </motion.div>
    );
}
