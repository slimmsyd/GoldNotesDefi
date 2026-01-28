/**
 * Gold Price Service
 * 
 * Fetches gold spot price from GoldAPI.io with server-side caching.
 * Uses a 6-hour cache TTL to stay within the free tier (100 requests/month).
 */

import {
  GOLD_PRICE_CACHE_TTL_MS,
  FALLBACK_GOLD_PRICE_PER_OZ,
} from '@/config/gold-pricing-config';

interface GoldApiResponse {
  timestamp: number;
  metal: string;
  currency: string;
  exchange: string;
  symbol: string;
  prev_close_price: number;
  open_price: number;
  low_price: number;
  high_price: number;
  open_time: number;
  price: number;
  ch: number;
  chp: number;
  ask: number;
  bid: number;
  price_gram_24k: number;
  price_gram_22k: number;
  price_gram_21k: number;
  price_gram_20k: number;
  price_gram_18k: number;
  price_gram_16k: number;
  price_gram_14k: number;
  price_gram_10k: number;
}

interface CachedGoldPrice {
  pricePerOz: number;
  timestamp: number;
  source: 'api' | 'fallback';
}

// In-memory cache for gold price (server-side singleton)
let cachedGoldPrice: CachedGoldPrice | null = null;

/**
 * Fetch the current gold spot price per troy ounce
 * Uses cached value if within TTL, otherwise fetches from API
 */
export async function getGoldSpotPrice(): Promise<CachedGoldPrice> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (cachedGoldPrice && (now - cachedGoldPrice.timestamp) < GOLD_PRICE_CACHE_TTL_MS) {
    console.log('[GoldPrice] Using cached price:', cachedGoldPrice.pricePerOz);
    return cachedGoldPrice;
  }
  
  // Fetch fresh price from API
  try {
    const apiKey = process.env.GOLDAPI_API_KEY;
    
    if (!apiKey) {
      console.warn('[GoldPrice] No API key found, using fallback price');
      return useFallbackPrice();
    }
    
    console.log('[GoldPrice] Fetching fresh price from GoldAPI.io...');
    
    const response = await fetch('https://www.goldapi.io/api/XAU/USD', {
      headers: {
        'x-access-token': apiKey,
        'Content-Type': 'application/json',
      },
      // Don't cache at the fetch level, we manage our own cache
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error('[GoldPrice] API error:', response.status, response.statusText);
      return useFallbackPrice();
    }
    
    const data: GoldApiResponse = await response.json();
    
    cachedGoldPrice = {
      pricePerOz: data.price,
      timestamp: now,
      source: 'api',
    };
    
    console.log('[GoldPrice] Fresh price fetched:', data.price, '$/oz');
    return cachedGoldPrice;
    
  } catch (error) {
    console.error('[GoldPrice] Failed to fetch gold price:', error);
    return useFallbackPrice();
  }
}

/**
 * Use fallback price when API is unavailable
 */
function useFallbackPrice(): CachedGoldPrice {
  // If we have a previous cached value, use it even if expired (better than fallback)
  if (cachedGoldPrice) {
    console.log('[GoldPrice] Using expired cache as fallback:', cachedGoldPrice.pricePerOz);
    return cachedGoldPrice;
  }
  
  // Use hardcoded fallback
  cachedGoldPrice = {
    pricePerOz: FALLBACK_GOLD_PRICE_PER_OZ,
    timestamp: Date.now(),
    source: 'fallback',
  };
  
  console.log('[GoldPrice] Using hardcoded fallback:', FALLBACK_GOLD_PRICE_PER_OZ);
  return cachedGoldPrice;
}

/**
 * Get formatted gold price info for display
 */
export async function getGoldPriceInfo(): Promise<{
  pricePerOz: number;
  formattedPrice: string;
  lastUpdated: string;
  source: 'api' | 'fallback';
}> {
  const priceData = await getGoldSpotPrice();
  
  const hoursAgo = Math.round((Date.now() - priceData.timestamp) / (1000 * 60 * 60));
  const lastUpdated = hoursAgo === 0 
    ? 'Just now' 
    : hoursAgo === 1 
      ? '1 hour ago' 
      : `${hoursAgo} hours ago`;
  
  return {
    pricePerOz: priceData.pricePerOz,
    formattedPrice: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(priceData.pricePerOz),
    lastUpdated,
    source: priceData.source,
  };
}

/**
 * Clear the gold price cache (admin use)
 * Forces the next getGoldSpotPrice call to fetch fresh data
 */
export function clearGoldPriceCache(): void {
  console.log('[GoldPrice] Cache cleared by admin');
  cachedGoldPrice = null;
}
