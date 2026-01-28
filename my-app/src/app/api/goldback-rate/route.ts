import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const DEFAULT_GOLDBACK_RATE = 9.02;

export async function GET() {
    try {
        const settings = await prisma.siteSettings.findUnique({
            where: { id: 'main' }
        });

        const rate = settings?.goldbackRatePer1GB ?? DEFAULT_GOLDBACK_RATE;

        return NextResponse.json({
            success: true,
            rate,
            updatedAt: settings?.updatedAt?.toISOString() ?? null
        });
    } catch (error) {
        console.error('Failed to fetch Goldback rate:', error);
        return NextResponse.json({
            success: true,
            rate: DEFAULT_GOLDBACK_RATE,
            updatedAt: null
        });
    }
}
