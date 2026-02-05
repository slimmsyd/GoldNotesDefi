import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const DEFAULT_GOLDBACK_RATE = 9.02;
const STALE_THRESHOLD_MINUTES = 30;

export async function GET() {
    try {
        // Fetch current rate from SiteSettings
        const settings = await prisma.siteSettings.findUnique({
            where: { id: 'main' }
        });

        const rate = settings?.goldbackRatePer1GB ?? DEFAULT_GOLDBACK_RATE;
        const updatedAt = settings?.updatedAt ?? null;

        // Calculate staleness
        let isStale = true; // Default to stale if no updatedAt
        let minutesSinceUpdate = null;

        if (updatedAt) {
            const now = new Date();
            const diffMs = now.getTime() - updatedAt.getTime();
            minutesSinceUpdate = Math.floor(diffMs / (1000 * 60));
            isStale = minutesSinceUpdate > STALE_THRESHOLD_MINUTES;
        }

        // Fetch price from 24 hours ago for change calculation
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

        // Calculate 24h change percentage
        const previousRate = historicalPrice?.price ?? null;
        let change24h = null;

        if (previousRate !== null && previousRate > 0) {
            change24h = ((rate - previousRate) / previousRate) * 100;
        }

        return NextResponse.json({
            success: true,
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
            success: false,
            rate: DEFAULT_GOLDBACK_RATE,
            updatedAt: null,
            previousRate: null,
            change24h: null,
            isStale: true,
            minutesSinceUpdate: null,
            error: 'Failed to fetch rate',
        });
    }
}
