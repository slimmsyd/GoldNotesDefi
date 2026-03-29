import 'server-only';

import prisma from '@/lib/prisma';
import { getCurrentGoldbackRate } from '@/lib/goldback-scraper';
import { getUPMAGoldbackRate } from '@/lib/upma-client';
import { calculateLamportsPrice, getSolPriceUsd } from '@/lib/sol-price';
import { getOnChainPriceLamports, getPriceSyncErrorContext, syncOnChainPrice } from '@/lib/price-sync';

const DEFAULT_GOLDBACK_RATE = 9.02;
const DEFAULT_MAX_DRIFT_PERCENT = 5;
const DEFAULT_SYNC_SLA_MINUTES = 1440;
const PRICE_HISTORY_RETENTION_HOURS = 48;
const ALERT_THROTTLE_MS = 5 * 60 * 1000;
const SYNC_ATTEMPT_COOLDOWN_MS = 60 * 60 * 1000;

export interface PriceSyncMetrics {
  successCount: number;
  failureCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastErrorCode: string | null;
  lastDriftPercent: number | null;
}

export interface PricingHealthSnapshot {
  healthy: boolean;
  effectiveHealthy: boolean;
  bypassed: boolean;
  bypassReason: string | null;
  reasons: string[];
  checks: {
    onChainPriceSet: boolean;
    driftWithinThreshold: boolean;
    withinSyncSla: boolean;
    requiredEnvPresent: boolean;
  };
  thresholds: {
    maxDriftPercent: number;
    slaMinutes: number;
  };
  data: {
    dbRate: number;
    dbUpdatedAt: string | null;
    minutesSinceLastSync: number | null;
    onChainLamports: number | null;
    suggestedLamports: number | null;
    driftPercent: number | null;
    solPriceUsd: number | null;
  };
  metrics: PriceSyncMetrics;
}

export interface AuthoritativePriceSyncResult {
  success: true;
  trigger: string;
  rateUsd: number;
  solPriceUsd: number;
  targetLamports: number;
  onChainBefore: number | null;
  onChainAfter: number | null;
  driftPercentAfter: number | null;
  tx: string | null;
  mode: 'noop' | 'operator' | 'admin_override';
  durationMs: number;
  dbUpdatedAt: string;
}

type InternalMetricsState = {
  successCount: number;
  failureCount: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastErrorCode: string | null;
  lastDriftPercent: number | null;
};

type GlobalState = {
  metrics: InternalMetricsState;
  startupGuardExecuted: boolean;
  lastAlertAt: number | null;
  lastAutoSyncAttemptAt: number | null;
};

const globalForPricing = globalThis as unknown as {
  __wgbPricingState?: GlobalState;
};

function getState(): GlobalState {
  if (!globalForPricing.__wgbPricingState) {
    globalForPricing.__wgbPricingState = {
      metrics: {
        successCount: 0,
        failureCount: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastDurationMs: null,
        lastError: null,
        lastErrorCode: null,
        lastDriftPercent: null,
      },
      startupGuardExecuted: false,
      lastAlertAt: null,
      lastAutoSyncAttemptAt: null,
    };
  }
  return globalForPricing.__wgbPricingState;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getMaxDriftPercent(): number {
  return parsePositiveNumber(process.env.PRICE_SYNC_MAX_DRIFT_PERCENT, DEFAULT_MAX_DRIFT_PERCENT);
}

function getSyncSlaMinutes(): number {
  return parsePositiveNumber(process.env.PRICE_SYNC_SLA_MINUTES, DEFAULT_SYNC_SLA_MINUTES);
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function allowAdminOverrideByEnv(): boolean {
  return isTruthyEnv(process.env.PRICE_SYNC_ALLOW_ADMIN_OVERRIDE);
}

function isLocalPricingBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return isTruthyEnv(process.env.PRICE_HEALTH_BYPASS_LOCAL);
}

function requiredEnvPresent(): boolean {
  return Boolean(process.env.PROTOCOL_AUTHORITY_KEYPAIR && process.env.CRON_SECRET);
}

function computeMinutesSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60));
}

function computeDriftPercent(onChainLamports: number | null, suggestedLamports: number | null): number | null {
  if (!onChainLamports || onChainLamports <= 0 || !suggestedLamports || suggestedLamports <= 0) return null;
  return Math.round((Math.abs(suggestedLamports - onChainLamports) / onChainLamports) * 10000) / 100;
}

async function persistPrice(rateUsd: number): Promise<Date> {
  const settings = await prisma.siteSettings.upsert({
    where: { id: 'main' },
    update: { goldbackRatePer1GB: rateUsd },
    create: { id: 'main', goldbackRatePer1GB: rateUsd },
  });

  try {
    await prisma.goldbackPriceHistory.create({
      data: { price: rateUsd, timestamp: new Date() },
    });

    const cutoff = new Date(Date.now() - PRICE_HISTORY_RETENTION_HOURS * 60 * 60 * 1000);
    await prisma.goldbackPriceHistory.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
  } catch (historyErr) {
    console.warn('[price-cohesion] Price history write failed (non-blocking):', historyErr);
  }

  return settings.updatedAt;
}

async function sendOpsAlert(payload: Record<string, unknown>): Promise<void> {
  const webhook = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!webhook) return;

  const state = getState();
  const now = Date.now();
  if (state.lastAlertAt && now - state.lastAlertAt < ALERT_THROTTLE_MS) return;

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    state.lastAlertAt = now;
  } catch (err) {
    console.warn('[price-cohesion] Failed to send ops alert:', err);
  }
}

function exportMetrics(): PriceSyncMetrics {
  const metrics = getState().metrics;
  return {
    successCount: metrics.successCount,
    failureCount: metrics.failureCount,
    lastSuccessAt: metrics.lastSuccessAt ? new Date(metrics.lastSuccessAt).toISOString() : null,
    lastFailureAt: metrics.lastFailureAt ? new Date(metrics.lastFailureAt).toISOString() : null,
    lastDurationMs: metrics.lastDurationMs,
    lastError: metrics.lastError,
    lastErrorCode: metrics.lastErrorCode,
    lastDriftPercent: metrics.lastDriftPercent,
  };
}

export function getPriceSyncMetrics(): PriceSyncMetrics {
  return exportMetrics();
}

export async function runAuthoritativePriceSync(params: {
  trigger: string;
  allowAdminOverride?: boolean;
}): Promise<AuthoritativePriceSyncResult> {
  const startedAt = Date.now();
  const state = getState();

  try {
    // UPMA is the authoritative source; fall back to scraper if unavailable
    const upmaRate = await getUPMAGoldbackRate();
    const scrape = upmaRate ?? await getCurrentGoldbackRate();
    if (!scrape?.rate || scrape.rate <= 0) {
      throw new Error('Failed to fetch fresh Goldback USD rate (UPMA + scraper both failed)');
    }

    const solPriceUsd = await getSolPriceUsd();
    if (!solPriceUsd || solPriceUsd <= 0) {
      throw new Error('Failed to fetch SOL/USD price');
    }

    const targetLamports = calculateLamportsPrice(scrape.rate, solPriceUsd);
    const onChainBefore = await getOnChainPriceLamports();
    const syncResult = await syncOnChainPrice(targetLamports, {
      allowAdminOverride:
        params.allowAdminOverride ?? allowAdminOverrideByEnv(),
    });
    const onChainAfter = await getOnChainPriceLamports();

    if (!onChainAfter || onChainAfter <= 0) {
      throw new Error('On-chain price remained unset after sync');
    }

    const dbUpdatedAt = await persistPrice(scrape.rate);
    const driftPercentAfter = computeDriftPercent(onChainAfter, targetLamports);
    const durationMs = Date.now() - startedAt;

    state.metrics.successCount += 1;
    state.metrics.lastSuccessAt = Date.now();
    state.metrics.lastDurationMs = durationMs;
    state.metrics.lastError = null;
    state.metrics.lastErrorCode = null;
    state.metrics.lastDriftPercent = driftPercentAfter;

    return {
      success: true,
      trigger: params.trigger,
      rateUsd: scrape.rate,
      solPriceUsd,
      targetLamports,
      onChainBefore,
      onChainAfter,
      driftPercentAfter,
      tx: syncResult.tx,
      mode: syncResult.mode,
      durationMs,
      dbUpdatedAt: dbUpdatedAt.toISOString(),
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorContext = getPriceSyncErrorContext(err);
    state.metrics.failureCount += 1;
    state.metrics.lastFailureAt = Date.now();
    state.metrics.lastDurationMs = durationMs;
    state.metrics.lastError = errorContext.message;
    state.metrics.lastErrorCode = errorContext.code;

    await sendOpsAlert({
      type: 'pricing_sync_failure',
      trigger: params.trigger,
      error: errorContext.message,
      errorCode: errorContext.code,
      stage: errorContext.stage,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    throw err;
  }
}

export async function ensureStartupPricingGuard(): Promise<{
  checked: boolean;
  triggered: boolean;
  result: AuthoritativePriceSyncResult | null;
}> {
  const state = getState();
  if (state.startupGuardExecuted) {
    return { checked: false, triggered: false, result: null };
  }
  state.startupGuardExecuted = true;

  const onChain = await getOnChainPriceLamports();

  if (!onChain || onChain <= 0) {
    const result = await runAuthoritativePriceSync({ trigger: 'startup_guard' });
    return { checked: true, triggered: true, result };
  }

  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    if (settings?.updatedAt) {
      const minutesSinceUpdate = (Date.now() - settings.updatedAt.getTime()) / (1000 * 60);
      if (minutesSinceUpdate > getSyncSlaMinutes()) {
        const result = await runAuthoritativePriceSync({ trigger: 'startup_guard_stale' });
        return { checked: true, triggered: true, result };
      }
    } else {
      const result = await runAuthoritativePriceSync({ trigger: 'startup_guard_no_db' });
      return { checked: true, triggered: true, result };
    }
  } catch (err) {
    console.warn('[price-cohesion] Startup guard stale check failed:', err);
  }

  return { checked: true, triggered: false, result: null };
}

export async function ensurePriceFreshness(): Promise<{
  synced: boolean;
  trigger: string | null;
  error: string | null;
}> {
  const state = getState();
  const now = Date.now();

  if (state.lastAutoSyncAttemptAt && (now - state.lastAutoSyncAttemptAt) < SYNC_ATTEMPT_COOLDOWN_MS) {
    return { synced: false, trigger: null, error: null };
  }

  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    const updatedAt = settings?.updatedAt ?? null;

    let isStale = true;
    if (updatedAt) {
      const minutesSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60);
      isStale = minutesSinceUpdate > getSyncSlaMinutes();
    }

    if (!isStale) {
      return { synced: false, trigger: null, error: null };
    }

    state.lastAutoSyncAttemptAt = now;

    const result = await runAuthoritativePriceSync({ trigger: 'auto_freshness' });

    return { synced: true, trigger: 'auto_freshness', error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[price-cohesion] Auto-freshness sync failed:', message);

    return { synced: false, trigger: 'auto_freshness', error: message };
  }
}

export async function getPricingHealthSnapshot(): Promise<PricingHealthSnapshot> {
  const maxDriftPercent = getMaxDriftPercent();
  const slaMinutes = getSyncSlaMinutes();

  let dbRate = DEFAULT_GOLDBACK_RATE;
  let dbUpdatedAt: Date | null = null;

  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    if (settings?.goldbackRatePer1GB && settings.goldbackRatePer1GB > 0) {
      dbRate = settings.goldbackRatePer1GB;
      dbUpdatedAt = settings.updatedAt;
    }
  } catch (err) {
    console.warn('[price-cohesion] Failed reading SiteSettings:', err);
  }

  const [onChainLamports, solPriceUsd] = await Promise.all([
    getOnChainPriceLamports(),
    getSolPriceUsd(),
  ]);

  let suggestedLamports: number | null = null;
  if (solPriceUsd && solPriceUsd > 0) {
    try {
      suggestedLamports = calculateLamportsPrice(dbRate, solPriceUsd);
    } catch {
      suggestedLamports = null;
    }
  }

  const driftPercent = computeDriftPercent(onChainLamports, suggestedLamports);
  const minutesSinceLastSync = computeMinutesSince(dbUpdatedAt);

  const checks = {
    onChainPriceSet: Boolean(onChainLamports && onChainLamports > 0),
    driftWithinThreshold:
      driftPercent !== null ? driftPercent <= maxDriftPercent : false,
    withinSyncSla:
      minutesSinceLastSync !== null ? minutesSinceLastSync <= slaMinutes : false,
    requiredEnvPresent: requiredEnvPresent(),
  };

  const reasons: string[] = [];
  if (!checks.onChainPriceSet) reasons.push('on_chain_price_unset');
  if (!checks.driftWithinThreshold) reasons.push('price_drift_exceeds_threshold_or_unknown');
  if (!checks.withinSyncSla) reasons.push('last_sync_stale_or_unknown');
  if (!checks.requiredEnvPresent) reasons.push('required_env_missing');

  const healthy = checks.onChainPriceSet &&
    checks.driftWithinThreshold &&
    checks.withinSyncSla &&
    checks.requiredEnvPresent;
  const bypassed = !healthy && isLocalPricingBypassEnabled();
  const effectiveHealthy = healthy || bypassed;
  const bypassReason = bypassed
    ? 'local_pricing_bypass_enabled'
    : null;

  const snapshot: PricingHealthSnapshot = {
    healthy,
    effectiveHealthy,
    bypassed,
    bypassReason,
    reasons,
    checks,
    thresholds: {
      maxDriftPercent,
      slaMinutes,
    },
    data: {
      dbRate,
      dbUpdatedAt: dbUpdatedAt?.toISOString() ?? null,
      minutesSinceLastSync,
      onChainLamports,
      suggestedLamports,
      driftPercent,
      solPriceUsd,
    },
    metrics: exportMetrics(),
  };

  if (!snapshot.healthy) {
    await sendOpsAlert({
      type: 'pricing_health_unhealthy',
      bypassed: snapshot.bypassed,
      bypassReason: snapshot.bypassReason,
      reasons: snapshot.reasons,
      checks: snapshot.checks,
      data: snapshot.data,
      timestamp: new Date().toISOString(),
    });
  }

  return snapshot;
}
