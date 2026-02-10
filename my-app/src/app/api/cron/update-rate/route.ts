import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getCurrentGoldbackRate } from '@/lib/goldback-scraper';

export const dynamic = 'force-dynamic'; // Prevent static caching

export async function GET(request: Request) {
    try {
        // Optional: Check for CRON_SECRET if you want to secure this endpoint
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new NextResponse('Unauthorized', { status: 401 });
        // }

        // 1. Scrape the current rate
        const scrapeResult = await getCurrentGoldbackRate();
        
        if (!scrapeResult) {
            return NextResponse.json(
                { error: 'Failed to scrape or validate Goldback rate' },
                { status: 500 }
            );
        }

        const { rate: newRate } = scrapeResult;

        // 2. Fetch current rate for comparison (Validation Layer)
        const currentSettings = await prisma.siteSettings.findUnique({
            where: { id: 'main' }
        });

        const oldRate = currentSettings?.goldbackRatePer1GB || 0;

        // 3. Validation Logic
        // Alert if the difference is massive (e.g. > 20% swing).
        // We still update, but we log a loud warning. OR we could block it.
        // For now, let's block updates that look like errors (e.g. < $1.00 when it's $9.00)
        
        if (oldRate > 0) {
            const percentDiff = Math.abs((newRate - oldRate) / oldRate) * 100;
            if (percentDiff > 20) {
                console.warn(`WARNING: Goldback rate changed by ${percentDiff.toFixed(2)}% (Old: ${oldRate}, New: ${newRate}). Update proceeding but requires attention.`);
            }
        }

        // 4. Update Prisma (The Source of Truth)
        const updatedSettings = await prisma.siteSettings.upsert({
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

        // 5. Store in price history for 24h change tracking (non-blocking)
        try {
            await prisma.goldbackPriceHistory.create({
                data: {
                    price: newRate,
                    timestamp: new Date(),
                },
            });

            // 6. Clean up old price history (keep last 48 hours only)
            const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
            await prisma.goldbackPriceHistory.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate,
                    },
                },
            });
        } catch (historyErr) {
            console.warn('[cron/update-rate] Price history write failed (table may not exist):', historyErr);
        }

        // 7. Revalidate page caches so users see the new price
        revalidatePath('/shop-gold-backs');
        revalidatePath('/app');

        return NextResponse.json({
            success: true,
            oldRate,
            newRate,
            updatedAt: updatedSettings.updatedAt.toISOString(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
