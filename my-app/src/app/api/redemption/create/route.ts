import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '@/lib/protocol-constants';

/**
 * POST /api/redemption/create
 * Stores shipping details for an on-chain burn_w3b redemption.
 * Called from the frontend after the burn transaction confirms.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_wallet,
      request_id,
      amount,
      burn_tx_hash,
      shipping_name,
      shipping_address,
      shipping_city,
      shipping_state,
      shipping_zip,
      shipping_country,
    } = body;

    if (!user_wallet || request_id === undefined || !amount) {
      return NextResponse.json(
        { success: false, error: 'user_wallet, request_id, and amount are required.' },
        { status: 400 }
      );
    }

    // Use the service role key if available, otherwise anon key
    const supabaseUrl = process.env.NEXT_PUBLIC_W3B_SUPABASE_URL || SUPABASE_CONFIG.url;
    const supabaseKey = process.env.W3B_SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_W3B_SUPABASE_ANON_KEY;

    if (!supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase key not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('redemption_requests')
      .upsert(
        {
          user_wallet,
          request_id,
          amount,
          status: 0,
          burn_tx_hash: burn_tx_hash || null,
          shipping_name: shipping_name || null,
          shipping_address: shipping_address || null,
          shipping_city: shipping_city || null,
          shipping_state: shipping_state || null,
          shipping_zip: shipping_zip || null,
          shipping_country: shipping_country || 'US',
        },
        { onConflict: 'user_wallet,request_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[API /redemption/create] Supabase error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, redemption: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[API /redemption/create] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
