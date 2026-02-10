import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentGoldbackRate } from '@/lib/goldback-scraper';

const DEFAULT_GOLDBACK_RATE = 9.02;
const STALE_THRESHOLD_MINUTES = 30;

export async function GET() {
    try {
        // 1. Fetch current rate from SiteSettings
        let settings = await prisma.siteSettings.findUnique({
            where: { id: 'main' }
        });

        let rate = settings?.goldbackRatePer1GB ?? DEFAULT_GOLDBACK_RATE;
        let updatedAt = settings?.updatedAt ?? null;

        // 2. Calculate staleness
        let isStale = true;
        let minutesSinceUpdate: number | null = null;

        if (updatedAt) {
            const now = new Date();
            const diffMs = now.getTime() - updatedAt.getTime();
            minutesSinceUpdate = Math.floor(diffMs / (1000 * 60));
            isStale = minutesSinceUpdate > STALE_THRESHOLD_MINUTES;
        }

        // 3. Self-healing: if stale, scrape a fresh rate inline
        if (isStale) {
            console.log('[goldback-rate] DB rate is stale, scraping fresh rate...');
            const scrapeResult = await getCurrentGoldbackRate();

            if (scrapeResult) {
                const newRate = scrapeResult.rate;

                // Update the DB with the fresh rate
                settings = await prisma.siteSettings.upsert({
                    where: { id: 'main' },
                    update: {
                        goldbackRatePer1GB: newRate,
                        updatedAt: new Date(),
                    },
                    create: {
                        id: 'main',
                        goldbackRatePer1GB: newRate,
                    },
                });

                // Store in price history (non-blocking — table may not exist yet)
                try {
                    await prisma.goldbackPriceHistory.create({
                        data: {
                            price: newRate,
                            timestamp: new Date(),
                        },
                    });

                    // Clean up old price history (keep last 48 hours)
                    const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
                    await prisma.goldbackPriceHistory.deleteMany({
                        where: { timestamp: { lt: cutoffDate } },
                    });
                } catch (historyErr) {
                    console.warn('[goldback-rate] Price history write failed (table may not exist):', historyErr);
                }

                rate = newRate;
                updatedAt = settings.updatedAt;
                minutesSinceUpdate = 0;
                isStale = false;
                console.log(`[goldback-rate] Fresh rate scraped and saved: $${newRate}`);
            } else {
                console.warn('[goldback-rate] Scrape failed, returning existing DB rate');
            }
        }

        // 4. Fetch price from 24 hours ago for change calculation (non-blocking)
        let previousRate: number | null = null;
        let change24h: number | null = null;

        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const historicalPrice = await prisma.goldbackPriceHistory.findFirst({
                where: {
                    timestamp: {
                        lte: twentyFourHoursAgo,
                    },
                },
                orderBy: {
                    timestamp: 'desc',
                },
            });

            previousRate = historicalPrice?.price ?? null;

            if (previousRate !== null && previousRate > 0) {
                change24h = ((rate - previousRate) / previousRate) * 100;
            }
        } catch (historyReadErr) {
            console.warn('[goldback-rate] Price history read failed (table may not exist):', historyReadErr);
        }

        return NextResponse.json({
            success: true,
            source: 'database' as const,
            rate,
            updatedAt: updatedAt?.toISOString() ?? null,
            previousRate,
            change24h,
            isStale,
            minutesSinceUpdate,
        });
    } catch (error) {
        console.error('Failed to fetch Goldback rate:', error);
        return NextResponse.json({
            success: true,
            source: 'fallback' as const,
            rate: DEFAULT_GOLDBACK_RATE,
            updatedAt: null,
            previousRate: null,
            change24h: null,
            isStale: true,
            minutesSinceUpdate: null,
        });
    }
}
