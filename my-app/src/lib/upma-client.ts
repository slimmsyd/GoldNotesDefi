/**
 * UPMA Public Rates API Client
 *
 * Fetches authoritative Goldback, gold, and silver rates from the
 * United Precious Metals Association (UPMA) public API.
 *
 * Endpoint: GET https://api.upma.org/api/public/rates
 * No authentication required.
 */

// Raw response from UPMA — all values are formatted strings
interface UPMARawResponse {
  day_of_rate: string;
  previous_day_of_rate: string;
  gold_spot: string;
  gold_rate: string;
  gold_previous_rate: string;
  gold_rate_change: string;
  gold_buy_back: string;
  gold_bullion_spot: string;
  gold_bullion_rate: string;
  gold_bullion_previous_rate: string;
  gold_bullion_rate_change: string;
  gold_bullion_buy_back: string;
  silver_spot: string;
  silver_rate: string;
  silver_previous_rate: string;
  silver_rate_change: string;
  silver_buy_back: string;
  silver_bullion_spot: string;
  silver_bullion_rate: string;
  silver_bullion_previous_rate: string;
  silver_bullion_rate_change: string;
  silver_bullion_buy_back: string;
  goldback_rate: string;
  goldback_previous_rate: string;
  goldback_rate_change: string;
  goldback_buy_back: string;
  goldback_official_price: string;
}

// Parsed, typed rates ready for application use
export interface ParsedUPMARates {
  // Goldback
  goldbackRate: number;
  goldbackOfficialPrice: number;
  goldbackBuyBack: number;
  goldbackRateChange: number;
  goldbackPreviousRate: number;
  // Gold
  goldSpot: number;
  goldRate: number;
  goldBuyBack: number;
  goldRateChange: number;
  goldBullionRate: number;
  goldBullionBuyBack: number;
  // Silver
  silverSpot: number;
  silverRate: number;
  silverBuyBack: number;
  silverRateChange: number;
  // Meta
  dayOfRate: string;
  previousDayOfRate: string;
  fetchedAt: number;
  source: 'upma' | 'upma_qa';
}

// ─── Cache ───

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedRates: ParsedUPMARates | null = null;
let cachedAt = 0;

// ─── Parsing ───

/** Strip $, commas, and % from UPMA formatted strings. Returns NaN on failure. */
export function parseUPMAString(value: string | undefined | null): number {
  if (!value || typeof value !== 'string') return NaN;
  const cleaned = value.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return NaN;
  return parseFloat(cleaned);
}

function parseRaw(raw: UPMARawResponse, source: 'upma' | 'upma_qa'): ParsedUPMARates | null {
  const goldbackRate = parseUPMAString(raw.goldback_rate);
  const goldSpot = parseUPMAString(raw.gold_spot);

  // Minimum validation: goldback rate and gold spot must be valid numbers
  if (isNaN(goldbackRate) || goldbackRate <= 0) return null;
  if (isNaN(goldSpot) || goldSpot <= 0) return null;

  return {
    goldbackRate,
    goldbackOfficialPrice: parseUPMAString(raw.goldback_official_price) || goldbackRate,
    goldbackBuyBack: parseUPMAString(raw.goldback_buy_back) || 0,
    goldbackRateChange: parseUPMAString(raw.goldback_rate_change) || 0,
    goldbackPreviousRate: parseUPMAString(raw.goldback_previous_rate) || 0,
    goldSpot,
    goldRate: parseUPMAString(raw.gold_rate) || 0,
    goldBuyBack: parseUPMAString(raw.gold_buy_back) || 0,
    goldRateChange: parseUPMAString(raw.gold_rate_change) || 0,
    goldBullionRate: parseUPMAString(raw.gold_bullion_rate) || 0,
    goldBullionBuyBack: parseUPMAString(raw.gold_bullion_buy_back) || 0,
    silverSpot: parseUPMAString(raw.silver_spot) || 0,
    silverRate: parseUPMAString(raw.silver_rate) || 0,
    silverBuyBack: parseUPMAString(raw.silver_buy_back) || 0,
    silverRateChange: parseUPMAString(raw.silver_rate_change) || 0,
    dayOfRate: raw.day_of_rate || '',
    previousDayOfRate: raw.previous_day_of_rate || '',
    fetchedAt: Date.now(),
    source,
  };
}

// ─── Fetching ───

const BASE_URL = process.env.UPMA_API_BASE_URL || 'https://api.upma.org';

/**
 * Fetch and parse UPMA rates. Returns cached data if within TTL.
 * Returns null if the fetch or parse fails.
 */
export async function fetchUPMARates(): Promise<ParsedUPMARates | null> {
  // Return cached if fresh
  if (cachedRates && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  const source: 'upma' | 'upma_qa' = BASE_URL.includes('qa.') ? 'upma_qa' : 'upma';

  try {
    const response = await fetch(`${BASE_URL}/api/public/rates`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[upma-client] HTTP ${response.status}: ${response.statusText}`);
      return cachedRates; // Return stale cache if available
    }

    const raw: UPMARawResponse = await response.json();
    const parsed = parseRaw(raw, source);

    if (!parsed) {
      console.error('[upma-client] Failed to parse UPMA response');
      return cachedRates;
    }

    // Update cache
    cachedRates = parsed;
    cachedAt = Date.now();

    return parsed;
  } catch (error) {
    console.error('[upma-client] Fetch failed:', error);
    return cachedRates; // Return stale cache on error
  }
}

/**
 * Adapter matching the shape of getCurrentGoldbackRate() from goldback-scraper.ts.
 * Drop-in replacement for the scraper in price-cohesion.ts.
 */
export async function getUPMAGoldbackRate(): Promise<{ rate: number; timestamp: number } | null> {
  const rates = await fetchUPMARates();
  if (!rates) return null;

  return {
    rate: rates.goldbackRate,
    timestamp: rates.fetchedAt,
  };
}
