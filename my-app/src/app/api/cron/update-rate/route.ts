import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertMyAppSecurityEnv, validateCronAuthorization } from '@/lib/admin-auth';
import { runAuthoritativePriceSync } from '@/lib/price-cohesion';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  assertMyAppSecurityEnv();

  try {
    if (!validateCronAuthorization(request)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const result = await runAuthoritativePriceSync({
      trigger: 'cron_update_rate',
    });

    revalidatePath('/shop-gold-backs');
    revalidatePath('/app');

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[cron/update-rate] failed:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
