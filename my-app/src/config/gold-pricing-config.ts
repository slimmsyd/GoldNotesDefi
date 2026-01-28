/**
 * Gold Pricing Configuration
 * 
 * Configures caching, API settings, and pricing formulas for dynamic gold pricing.
 */

// Cache TTL: 6 hours = 4 API calls/day × 30 days = ~120 calls/month (under 100 limit with buffer)
export const GOLD_PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Fallback gold price if API fails (updated manually as backup)
// Last updated: January 2026
export const FALLBACK_GOLD_PRICE_PER_OZ = 4600.00;

// Regex to extract gold content from product features
// Matches patterns like "1/1000th oz", "5/1000th oz", "10/1000th oz", etc.
export const GOLD_CONTENT_REGEX = /(\d+)\/1000(?:th)?\s*oz/i;

// Goldback Rate Multiplier
// The official Goldback rate is approximately 3.34x the raw gold value
// This accounts for production costs, anti-counterfeiting tech, and market premium
// Formula: Goldback Rate ≈ (Gold Spot Price × Gold Content) × 3.34
// Example: $2,700/oz × 0.001 oz × 3.34 = $9.02 (matches official rate)
export const GOLDBACK_RATE_MULTIPLIER = 3.34;

/**
 * Calculate the gold content in ounces from a product's features array
 * Looks for patterns like "24K Gold Content (1/1000th oz)"
 */
export function extractGoldContentOz(features: string[]): number | null {
  for (const feature of features) {
    const match = feature.match(GOLD_CONTENT_REGEX);
    if (match) {
      const numerator = parseInt(match[1], 10);
      return numerator / 1000; // Convert to oz (e.g., 1/1000 = 0.001 oz)
    }
  }
  return null;
}

/**
 * Calculate the dynamic price for a goldback based on gold spot price
 * Uses the Goldback Rate Multiplier to match official Goldback pricing
 * 
 * Formula: (goldSpotPrice × goldContentOz) × GOLDBACK_RATE_MULTIPLIER
 * 
 * @param goldSpotPricePerOz - Current gold spot price per troy oz
 * @param goldContentOz - Gold content in the product (in oz)
 * @returns Calculated price in USD (Goldback rate)
 */
export function calculateDynamicPrice(
  goldSpotPricePerOz: number,
  goldContentOz: number
): number {
  const rawGoldValue = goldSpotPricePerOz * goldContentOz;
  const goldbackRate = rawGoldValue * GOLDBACK_RATE_MULTIPLIER;
  return Math.round(goldbackRate * 100) / 100; // Round to 2 decimals
}
