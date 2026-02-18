import { NextRequest, NextResponse } from 'next/server';
import { calculateShippingMethod, getAvailableShippingMethods } from '@/config/shipping-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subtotalRaw = searchParams.get('subtotalUsd');
    const internationalRaw = searchParams.get('isInternational');

    if (subtotalRaw === null) {
      return NextResponse.json({ error: 'subtotalUsd is required' }, { status: 400 });
    }

    const subtotalUsd = Number(subtotalRaw);
    if (!Number.isFinite(subtotalUsd) || subtotalUsd < 0) {
      return NextResponse.json({ error: 'subtotalUsd must be a valid non-negative number' }, { status: 400 });
    }

    const isInternational =
      internationalRaw === 'true' || internationalRaw === '1' || internationalRaw === 'yes';

    const requiredMethod = calculateShippingMethod(subtotalUsd, isInternational);
    const availableMethods = getAvailableShippingMethods(subtotalUsd, isInternational);

    return NextResponse.json({
      success: true,
      requiredMethod,
      availableMethods,
      shippingUsdDefault: requiredMethod.cost,
    });
  } catch (error) {
    console.error('[api/checkout/shipping-options] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to resolve shipping options',
      },
      { status: 500 }
    );
  }
}
