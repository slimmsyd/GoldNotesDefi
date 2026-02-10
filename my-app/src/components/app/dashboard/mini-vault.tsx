'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { fetchRecentSerials } from '@/lib/supabase-protocol';
import { GoldbackSerialRecord } from '@/lib/protocol-constants';

export function MiniVault() {
  const [serials, setSerials] = useState<GoldbackSerialRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchRecentSerials(5);
        setSerials(data);
      } catch (e) {
        console.error('Failed to load mini vault', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/app/vault">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gray-900/50 border border-gray-800 p-6 hover:border-gray-700 transition-colors cursor-pointer group"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-[#c9a84c] animate-pulse" />
            Live Vault
          </h3>
          <span className="text-gray-600 text-xs group-hover:text-gray-400 transition-colors">
            View all →
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {serials.slice(0, 5).map((serial, index) => (
                <motion.div
                  key={serial.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between bg-gray-800/50 p-3 border border-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-7 bg-[#c9a84c]/20 border border-[#c9a84c]/50 flex items-center justify-center">
                      <span className="text-[#c9a84c] text-[8px] font-bold">$1</span>
                    </div>
                    <span className="text-[#e8d48b] font-mono text-xs">
                      {serial.serial_number}
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {!isLoading && serials.length === 0 && (
          <div className="text-center text-gray-600 py-8">
            No serials yet
          </div>
        )}
      </motion.div>
    </Link>
  );
}
