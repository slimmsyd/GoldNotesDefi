import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPricingHealthSnapshot } from '@/lib/price-cohesion';
import { fetchUPMARates } from '@/lib/upma-client';

const DEFAULT_GOLDBACK_RATE = 9.02;

export async function GET() {
  try {
    const [settings, health, upmaRates] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { id: 'main' } }),
      getPricingHealthSnapshot(),
      fetchUPMARates(),
    ]);

    const rate = settings?.goldbackRatePer1GB ?? DEFAULT_GOLDBACK_RATE;
    const updatedAt = settings?.updatedAt ?? null;
    const minutesSinceUpdate = updatedAt
      ? Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60))
      : null;

    let previousRate: number | null = null;
    let change24h: number | null = null;

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const historicalPrice = await prisma.goldbackPriceHistory.findFirst({
        where: { timestamp: { lte: twentyFourHoursAgo } },
        orderBy: { timestamp: 'desc' },
      });
      previousRate = historicalPrice?.price ?? null;
      if (previousRate !== null && previousRate > 0) {
        change24h = ((rate - previousRate) / previousRate) * 100;
      }
    } catch (historyErr) {
      console.warn('[goldback-rate] Price history read failed (table may not exist):', historyErr);
    }

    // Fall back to UPMA 24h change if DB history is unavailable
    if (change24h === null && upmaRates) {
      change24h = upmaRates.goldbackRateChange;
      previousRate = upmaRates.goldbackPreviousRate;
    }

    // Build UPMA sub-object (null if UPMA fetch failed)
    const upma = upmaRates
      ? {
          goldbackRate: upmaRates.goldbackRate,
          goldbackOfficialPrice: upmaRates.goldbackOfficialPrice,
          goldbackBuyBack: upmaRates.goldbackBuyBack,
          goldbackSpread: +(upmaRates.goldbackOfficialPrice - upmaRates.goldbackBuyBack).toFixed(2),
          goldbackRateChange: upmaRates.goldbackRateChange,
          goldbackPreviousRate: upmaRates.goldbackPreviousRate,
          goldSpot: upmaRates.goldSpot,
          goldRate: upmaRates.goldRate,
          goldRateChange: upmaRates.goldRateChange,
          goldBullionRate: upmaRates.goldBullionRate,
          silverSpot: upmaRates.silverSpot,
          silverRate: upmaRates.silverRate,
          silverRateChange: upmaRates.silverRateChange,
          dayOfRate: upmaRates.dayOfRate,
          source: upmaRates.source,
          fetchedAt: new Date(upmaRates.fetchedAt).toISOString(),
        }
      : null;

    return NextResponse.json({
      success: true,
      source: settings ? 'database' : 'fallback',
      rate,
      updatedAt: updatedAt?.toISOString() ?? null,
      previousRate,
      change24h,
      isStale: minutesSinceUpdate !== null ? minutesSinceUpdate > 1440 : true,
      minutesSinceUpdate,
      health,
      priceSync: {
        onChainLamports: health.data.onChainLamports,
        suggestedLamports: health.data.suggestedLamports,
        solPriceUsd: health.data.solPriceUsd,
        priceDriftPercent: health.data.driftPercent,
        syncedRecently: health.checks.withinSyncSla,
      },
      upma,
    });
  } catch (error) {
    console.error('[goldback-rate] Failed to fetch Goldback rate:', error);
    return NextResponse.json({
      success: true,
      source: 'fallback',
      rate: DEFAULT_GOLDBACK_RATE,
      updatedAt: null,
      previousRate: null,
      change24h: null,
      isStale: true,
      minutesSinceUpdate: null,
      health: null,
      priceSync: null,
      upma: null,
    });
  }
}
