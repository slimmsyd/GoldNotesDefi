'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

// TEST MODE: Using $0.05 for devnet testing (production would be ~$4.00)
const GOLDBACK_PRICE_USD = 0.05;

export function QuickSwap() {
  const [amount, setAmount] = useState('');

  const w3bAmount = amount ? (parseFloat(amount) / GOLDBACK_PRICE_USD).toFixed(4) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Quick Swap</h3>
        <Link href="/app/swap" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
          Advanced →
        </Link>
      </div>

      <div className="space-y-3">
        {/* Input */}
        <div className="bg-gray-950 rounded-xl p-3 border border-gray-800">
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-xl font-medium text-white w-full outline-none placeholder-gray-600"
            />
            <div className="bg-gray-800 rounded-full px-2 py-1 flex items-center gap-1.5 flex-shrink-0 text-sm">
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                $
              </div>
              <span className="text-white">USDC</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="bg-gray-800 p-1.5 rounded-lg">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Output */}
        <div className="bg-gray-950 rounded-xl p-3 border border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-xl font-medium text-white">{w3bAmount}</span>
            <div className="bg-gray-800 rounded-full px-2 py-1 flex items-center gap-1.5 flex-shrink-0 text-sm">
              <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[8px] text-black font-bold">
                G
              </div>
              <span className="text-white">W3B</span>
            </div>
          </div>
        </div>

        <Link
          href="/app/swap"
          className="block w-full text-center bg-amber-500 text-black font-bold py-3 rounded-xl hover:bg-amber-400 transition-colors"
        >
          Swap Now
        </Link>
      </div>
    </motion.div>
  );
}
