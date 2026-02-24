import { NextRequest, NextResponse } from 'next/server';
import { fetchUserRedemptions } from '@/lib/supabase-protocol';
import { resolveAuthenticatedRequest } from '@/lib/mobile-auth';

/**
 * GET /api/redemption/status?wallet=<pubkey>
 * Returns redemption requests for the authenticated wallet.
 * Optional wallet query must match authenticated wallet.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedRequest(request);
    const authedWallet = auth.context?.walletAddress;
    if (!authedWallet) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const requestedWallet = request.nextUrl.searchParams.get('wallet') || authedWallet;
    if (requestedWallet !== authedWallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet mismatch for redemption status query' },
        { status: 403 }
      );
    }

    const requests = await fetchUserRedemptions(requestedWallet);
    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
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
