import { NextResponse } from 'next/server';
import { getPricingHealthSnapshot, ensurePriceFreshness } from '@/lib/price-cohesion';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensurePriceFreshness();
    const snapshot = await getPricingHealthSnapshot();
    return NextResponse.json(
      {
        success: true,
        healthy: snapshot.healthy,
        effectiveHealthy: snapshot.effectiveHealthy,
        bypassed: snapshot.bypassed,
        bypassReason: snapshot.bypassReason,
        data: snapshot,
        timestamp: new Date().toISOString(),
      },
      { status: snapshot.effectiveHealthy ? 200 : 503 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        healthy: false,
        effectiveHealthy: false,
        bypassed: false,
        bypassReason: null,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
