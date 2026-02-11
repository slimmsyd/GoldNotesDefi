/**
 * SOL/USD Price Fetcher
 * 
 * Fetches the current price of SOL in USD from free public APIs.
 * Uses Jupiter Price API (Solana-native) with CoinGecko as fallback.
 */

const SOL_PRICE_CACHE_TTL_MS = 60_000; // Cache SOL price for 1 minute

let cachedSolPrice: { price: number; fetchedAt: number } | null = null;

/**
 * Fetch SOL/USD price from Jupiter Price API v2
 * https://docs.jup.ag/docs/apis/price-api-v2
 */
async function fetchFromJupiter(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112',
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data?.data?.['So11111111111111111111111111111111111111112']?.price);
    return isNaN(price) || price <= 0 ? null : price;
  } catch {
    return null;
  }
}

/**
 * Fetch SOL/USD price from CoinGecko free API (fallback)
 */
async function fetchFromCoinGecko(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.solana?.usd;
    return typeof price === 'number' && price > 0 ? price : null;
  } catch {
    return null;
  }
}

/**
 * Get the current SOL/USD price with caching and fallback.
 * Returns null if all sources fail.
 */
export async function getSolPriceUsd(): Promise<number | null> {
  // Return cached value if fresh
  if (cachedSolPrice && Date.now() - cachedSolPrice.fetchedAt < SOL_PRICE_CACHE_TTL_MS) {
    return cachedSolPrice.price;
  }

  // Try Jupiter first (Solana-native, faster)
  let price = await fetchFromJupiter();

  // Fallback to CoinGecko
  if (price === null) {
    console.warn('[sol-price] Jupiter failed, trying CoinGecko...');
    price = await fetchFromCoinGecko();
  }

  if (price !== null) {
    cachedSolPrice = { price, fetchedAt: Date.now() };
    return price;
  }

  console.error('[sol-price] All price sources failed');
  return cachedSolPrice?.price ?? null; // Return stale cache if available
}

/**
 * Calculate the W3B price in lamports given:
 * - goldbackRateUsd: price of 1 Goldback in USD
 * - solPriceUsd: price of 1 SOL in USD
 * 
 * Formula: (goldback_usd / sol_usd) × 1,000,000,000 lamports
 */
export function calculateLamportsPrice(goldbackRateUsd: number, solPriceUsd: number): number {
  if (solPriceUsd <= 0) throw new Error('SOL price must be > 0');
  if (goldbackRateUsd <= 0) throw new Error('Goldback rate must be > 0');
  
  const priceInSol = goldbackRateUsd / solPriceUsd;
  const lamports = Math.round(priceInSol * 1_000_000_000);
  
  return lamports;
}
