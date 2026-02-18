import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveAuthenticatedRequest } from '@/lib/mobile-auth';

export const runtime = 'nodejs';

/**
 * GET /api/loyalty/balance
 * Requires X-Wallet-Address header
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedRequest(request);
    const walletAddress = auth.context?.walletAddress;
    if (!walletAddress) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 });
    }

    const sum = await prisma.loyaltyPointsEvent.aggregate({
      where: { walletAddress },
      _sum: { points: true },
    });

    const events = await prisma.loyaltyPointsEvent.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      walletAddress,
      balance: sum._sum.points ?? 0,
      lastUpdated: new Date().toISOString(),
      events: events.map((e) => ({
        id: e.id,
        source: e.source,
        points: e.points,
        createdAt: e.createdAt.toISOString(),
        sourceRef: e.sourceRef,
        orderId: e.orderId,
      })),
    });
  } catch (error) {
    console.error('Loyalty balance error:', error);
    return NextResponse.json({ error: 'Failed to fetch loyalty balance' }, { status: 500 });
  }
}
