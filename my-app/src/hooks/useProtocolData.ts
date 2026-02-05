'use client';

/**
 * useProtocolData Hook
 * Fetches and combines on-chain (Solana) and off-chain (Supabase) protocol data
 */

import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { ProtocolData, MerkleRootRecord, PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import {
  fetchProtocolStateRaw,
  merkleRootToHex,
  timestampToDate,
  calculateSolvency,
} from '@/lib/solana-program';
import {
  fetchLatestMerkleRoot,
  fetchBatchCount,
} from '@/lib/supabase-protocol';

interface UseProtocolDataOptions {
  /** Auto-refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
}

interface UseProtocolDataReturn {
  data: ProtocolData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_OPTIONS: UseProtocolDataOptions = {
  refreshInterval: 30000, // 30 seconds
  fetchOnMount: true,
};

/**
 * Fetch treasury token account balance
 */
async function fetchTreasuryBalance(): Promise<number> {
  try {
    const connection = new Connection(PROTOCOL_CONFIG.rpcEndpoint, 'confirmed');
    const treasury = new PublicKey(PROTOCOL_CONFIG.treasury);
    const accountInfo = await connection.getTokenAccountBalance(treasury);
    return accountInfo.value.uiAmount || 0;
  } catch (err) {
    console.error('Failed to fetch treasury balance:', err);
    return 0;
  }
}

/**
 * Goldback price data from API
 */
interface GoldbackPriceData {
  rate: number;
  updatedAt: string | null;
  change24h: number | null;
  isStale: boolean;
}

/**
 * Fetch Goldback/W3B price from API
 */
async function fetchGoldbackPrice(): Promise<GoldbackPriceData | null> {
  try {
    const response = await fetch('/api/goldback-rate');
    if (!response.ok) {
      throw new Error('Failed to fetch goldback rate');
    }
    const data = await response.json();
    return {
      rate: data.rate,
      updatedAt: data.updatedAt,
      change24h: data.change24h,
      isStale: data.isStale,
    };
  } catch (err) {
    console.error('Failed to fetch goldback price:', err);
    return null;
  }
}

export function useProtocolData(
  options: UseProtocolDataOptions = {}
): UseProtocolDataReturn {
  const { refreshInterval, fetchOnMount } = { ...DEFAULT_OPTIONS, ...options };

  const [data, setData] = useState<ProtocolData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch on-chain and off-chain data in parallel
      const [protocolState, latestMerkleRoot, batchCount, treasuryBalance, goldbackPrice] = await Promise.all([
        fetchProtocolStateRaw(),
        fetchLatestMerkleRoot(),
        fetchBatchCount(),
        fetchTreasuryBalance(),
        fetchGoldbackPrice(),
      ]);

      if (!protocolState) {
        throw new Error('Protocol state not found on-chain');
      }

      const { isSolvent, ratio } = calculateSolvency(
        protocolState.totalSupply,
        protocolState.provenReserves
      );

      const protocolData: ProtocolData = {
        // On-chain data
        totalSupply: protocolState.totalSupply,
        provenReserves: protocolState.provenReserves,
        lastProofTimestamp: timestampToDate(protocolState.lastProofTimestamp),
        currentMerkleRoot: merkleRootToHex(protocolState.currentMerkleRoot),
        isPaused: protocolState.isPaused,
        treasuryBalance,

        // Derived
        isSolvent,
        solvencyRatio: ratio,

        // Off-chain data
        lastAuditRecord: latestMerkleRoot,
        totalBatches: batchCount,

        // Goldback/W3B Price
        goldbackPrice: goldbackPrice?.rate ?? null,
        goldbackPriceUpdatedAt: goldbackPrice?.updatedAt ? new Date(goldbackPrice.updatedAt) : null,
        goldbackPrice24hChange: goldbackPrice?.change24h ?? null,
        isGoldbackPriceStale: goldbackPrice?.isStale ?? true,

        // Meta
        lastFetched: new Date(),
        isLoading: false,
        error: null,
      };

      setData(protocolData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching protocol data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    if (fetchOnMount) {
      fetchData();
    }
  }, [fetchData, fetchOnMount]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchData, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchData, refreshInterval]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
}

/**
 * Lightweight hook for just the solvency status
 * Useful for header badges or quick status checks
 */
export function useSolvencyStatus(): {
  isSolvent: boolean | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useProtocolData({ refreshInterval: 60000 });

  return {
    isSolvent: data?.isSolvent ?? null,
    isLoading,
  };
}
