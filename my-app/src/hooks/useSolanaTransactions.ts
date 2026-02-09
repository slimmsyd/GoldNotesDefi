'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

/* ─── Types ─── */

/** Real network stats from Solana RPC */
export interface NetworkStats {
  tps: number;
  totalTransactions: number;
  w3bTxCount: number;
  lastUpdated: number;
  isConnected: boolean;
}

/** A feed event backed by real data */
export interface FeedEvent {
  id: string;
  type: 'tps_update' | 'w3b_tx';
  message: string;
  detail: string;
  timestamp: number;
}

/* ─── Constants ─── */
const TPS_POLL_INTERVAL_MS = 10_000;
const MAX_FEED_ITEMS = 5;

/* ─── Hook ─── */

export function useSolanaTransactions() {
  // ── Real data: network stats ──
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    tps: 0,
    totalTransactions: 0,
    w3bTxCount: 0,
    lastUpdated: 0,
    isConnected: false,
  });

  // ── Feed events ──
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);

  // Refs
  const connectionRef = useRef<Connection | null>(null);
  const subIdRef = useRef<number | null>(null);
  const cumulativeTxRef = useRef(0);
  const mountedRef = useRef(true);

  /** Add a feed event */
  const addFeedEvent = useCallback((type: FeedEvent['type'], message: string, detail: string) => {
    const event: FeedEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      message,
      detail,
      timestamp: Date.now(),
    };
    setFeedEvents((prev) => [event, ...prev].slice(0, MAX_FEED_ITEMS));
  }, []);

  /** Fetch real TPS via getRecentPerformanceSamples */
  const fetchTps = useCallback(async (connection: Connection) => {
    try {
      const samples = await connection.getRecentPerformanceSamples(1);
      if (!mountedRef.current || samples.length === 0) return;

      const sample = samples[0];
      const tps = Math.round(sample.numTransactions / sample.samplePeriodSecs);

      cumulativeTxRef.current += sample.numTransactions;

      setNetworkStats((prev) => ({
        ...prev,
        tps,
        totalTransactions: cumulativeTxRef.current,
        lastUpdated: Date.now(),
        isConnected: true,
      }));

      addFeedEvent(
        'tps_update',
        `${tps.toLocaleString()} tx/s`,
        `Solana Network ${PROTOCOL_CONFIG.networkDisplay}`
      );
    } catch (err) {
      console.warn('[Solana] getRecentPerformanceSamples failed:', err);
      if (mountedRef.current) {
        setNetworkStats((prev) => ({ ...prev, isConnected: false }));
      }
    }
  }, [addFeedEvent]);

  /** Main effect: connect to Helius RPC, poll TPS, subscribe to W3B logs */
  useEffect(() => {
    mountedRef.current = true;
    let tpsInterval: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        const rpcEndpoint = PROTOCOL_CONFIG.rpcEndpoint;
        const wsUrl = rpcEndpoint
          .replace('https://', 'wss://')
          .replace('http://', 'ws://');

        const connection = new Connection(rpcEndpoint, {
          commitment: 'confirmed',
          wsEndpoint: wsUrl,
        });
        connectionRef.current = connection;

        await fetchTps(connection);
        tpsInterval = setInterval(() => {
          if (mountedRef.current && connectionRef.current) {
            fetchTps(connectionRef.current);
          }
        }, TPS_POLL_INTERVAL_MS);

        try {
          const programId = new PublicKey(PROTOCOL_CONFIG.programId);
          const subId = connection.onLogs(
            programId,
            (logs) => {
              if (!mountedRef.current || logs.err) return;

              setNetworkStats((prev) => ({
                ...prev,
                w3bTxCount: prev.w3bTxCount + 1,
              }));

              const shortSig = logs.signature.slice(0, 8) + '...' + logs.signature.slice(-4);
              addFeedEvent('w3b_tx', 'W3B Transfer confirmed', shortSig);
            },
            'confirmed'
          );
          subIdRef.current = subId;
        } catch (wsErr) {
          console.warn('[Solana] WebSocket subscription failed:', wsErr);
        }
      } catch (err) {
        console.warn('[Solana] Connection failed:', err);
        if (mountedRef.current) {
          setNetworkStats((prev) => ({ ...prev, isConnected: false }));
        }
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      if (tpsInterval) clearInterval(tpsInterval);
      if (subIdRef.current !== null && connectionRef.current) {
        connectionRef.current.removeOnLogsListener(subIdRef.current).catch(() => {});
      }
    };
  }, [fetchTps, addFeedEvent]);

  return {
    networkStats,
    feedEvents,
  };
}
