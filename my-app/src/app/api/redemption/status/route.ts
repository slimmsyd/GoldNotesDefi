import { NextRequest, NextResponse } from 'next/server';
import { fetchUserRedemptions, fetchPendingRedemptions } from '@/lib/supabase-protocol';

/**
 * GET /api/redemption/status?wallet=<pubkey>
 * Returns redemption requests for a given wallet.
 * If no wallet is provided, returns all pending requests (for fulfillers).
 */
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');

    if (wallet) {
      // User-specific: fetch all their redemptions
      const requests = await fetchUserRedemptions(wallet);
      return NextResponse.json({
        success: true,
        count: requests.length,
        requests,
      });
    }

    // No wallet: fetch pending orders for fulfiller marketplace
    const pending = await fetchPendingRedemptions();
    return NextResponse.json({
      success: true,
      count: pending.length,
      requests: pending,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API /redemption/status] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
