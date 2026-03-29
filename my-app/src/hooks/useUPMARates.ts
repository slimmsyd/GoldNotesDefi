'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UPMARatesData {
  goldbackRate: number | null;
  goldbackOfficialPrice: number | null;
  goldbackBuyBack: number | null;
  goldbackSpread: number | null;
  goldbackRateChange: number | null;
  goldbackPreviousRate: number | null;
  goldSpot: number | null;
  goldRate: number | null;
  goldRateChange: number | null;
  goldBullionRate: number | null;
  silverSpot: number | null;
  silverRate: number | null;
  silverRateChange: number | null;
  dayOfRate: string | null;
  source: string | null;
  fetchedAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

const INITIAL: UPMARatesData = {
  goldbackRate: null,
  goldbackOfficialPrice: null,
  goldbackBuyBack: null,
  goldbackSpread: null,
  goldbackRateChange: null,
  goldbackPreviousRate: null,
  goldSpot: null,
  goldRate: null,
  goldRateChange: null,
  goldBullionRate: null,
  silverSpot: null,
  silverRate: null,
  silverRateChange: null,
  dayOfRate: null,
  source: null,
  fetchedAt: null,
  isLoading: true,
  error: null,
};

/**
 * Client-side hook for UPMA rates data.
 * Calls /api/goldback-rate and extracts the `upma` sub-object.
 */
export function useUPMARates(refreshInterval = 60_000): UPMARatesData {
  const [data, setData] = useState<UPMARatesData>(INITIAL);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/goldback-rate');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const upma = json.upma;
      if (upma) {
        setData({
          goldbackRate: upma.goldbackRate ?? null,
          goldbackOfficialPrice: upma.goldbackOfficialPrice ?? null,
          goldbackBuyBack: upma.goldbackBuyBack ?? null,
          goldbackSpread: upma.goldbackSpread ?? null,
          goldbackRateChange: upma.goldbackRateChange ?? null,
          goldbackPreviousRate: upma.goldbackPreviousRate ?? null,
          goldSpot: upma.goldSpot ?? null,
          goldRate: upma.goldRate ?? null,
          goldRateChange: upma.goldRateChange ?? null,
          goldBullionRate: upma.goldBullionRate ?? null,
          silverSpot: upma.silverSpot ?? null,
          silverRate: upma.silverRate ?? null,
          silverRateChange: upma.silverRateChange ?? null,
          dayOfRate: upma.dayOfRate ?? null,
          source: upma.source ?? null,
          fetchedAt: upma.fetchedAt ? new Date(upma.fetchedAt) : null,
          isLoading: false,
          error: null,
        });
      } else {
        // UPMA unavailable — use base rate data as fallback
        setData(prev => ({
          ...prev,
          goldbackRate: json.rate ?? null,
          goldbackRateChange: json.change24h ?? null,
          goldbackPreviousRate: json.previousRate ?? null,
          source: json.source ?? null,
          isLoading: false,
          error: null,
        }));
      }
    } catch (err) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch rates',
      }));
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const id = setInterval(fetchRates, refreshInterval);
    return () => clearInterval(id);
  }, [fetchRates, refreshInterval]);

  return data;
}
