
import { NextResponse } from 'next/server';
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

        return NextResponse.json({
            success: true,
            oldRate,
            newRate,
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
