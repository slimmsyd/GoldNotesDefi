import { NextResponse } from 'next/server';
import {
  assertMyAppSecurityEnv,
  authenticateAutoVerifyRequest,
  validateCronAuthorization,
} from '@/lib/admin-auth';
import {
  ensureStartupPricingGuard,
  runAuthoritativePriceSync,
} from '@/lib/price-cohesion';
import { getPriceSyncErrorContext } from '@/lib/price-sync';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  assertMyAppSecurityEnv();

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const cronAuthorized = validateCronAuthorization(request);
  if (!cronAuthorized) {
    const auth = authenticateAutoVerifyRequest(request, body);
    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'AUTH_FAILED',
          errorMessage: auth.reason || 'Unauthorized',
          error: auth.reason || 'Unauthorized',
          stage: 'AUTH_FAILED',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }
  }

  try {
    const startupGuard = await ensureStartupPricingGuard();
    const result = await runAuthoritativePriceSync({
      trigger: cronAuthorized ? 'cron_or_internal' : 'admin_manual',
    });

    return NextResponse.json({
      success: true,
      startupGuard,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorContext = getPriceSyncErrorContext(error);
    console.error('[api/admin/price/sync] failed:', errorContext);
    return NextResponse.json(
      {
        success: false,
        errorCode: errorContext.code,
        errorMessage: errorContext.message,
        error: errorContext.message,
        stage: errorContext.stage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
