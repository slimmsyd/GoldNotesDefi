/**
 * Amazon GoldBack URL Service
 *
 * This service handles Amazon product URL parsing and validation
 * for the "Browse & Paste" user flow. Users browse Amazon manually,
 * paste the product URL, and checkout via SP3ND.
 *
 * Note: Scraping has been removed. Products are added by user-submitted URLs.
 */

import prisma from "@/lib/prisma";
import type { AmazonGoldBack } from "@prisma/client";

// ============================================
// Types
// ============================================

export interface AmazonProductFromUrl {
  asin: string;
  amazonUrl: string;
  title: string;
  inStock: boolean;
}

// ============================================
// URL Parsing Functions
// ============================================

/**
 * Extract ASIN from Amazon URL
 * Supports multiple URL patterns:
 * - /dp/ASIN
 * - /gp/product/ASIN
 * - /gp/aw/d/ASIN (mobile)
 */
export function extractAsin(url: string): string | null {
  // Match /dp/ASIN pattern
  const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  if (dpMatch) return dpMatch[1].toUpperCase();

  // Match /gp/product/ASIN pattern
  const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (gpMatch) return gpMatch[1].toUpperCase();

  // Match /gp/aw/d/ASIN pattern (mobile)
  const mobileMatch = url.match(/\/gp\/aw\/d\/([A-Z0-9]{10})/i);
  if (mobileMatch) return mobileMatch[1].toUpperCase();

  return null;
}

/**
 * Validate if a URL is a valid Amazon product URL
 */
export function isValidAmazonProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isAmazonDomain = parsed.hostname.includes('amazon.com') || 
                           parsed.hostname.includes('amazon.co.') ||
                           parsed.hostname.includes('amzn.com');
    return isAmazonDomain && extractAsin(url) !== null;
  } catch {
    return false;
  }
}

/**
 * Create a normalized Amazon product URL from ASIN
 */
export function createAmazonUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}`;
}

// ============================================
// Product Creation from URL
// ============================================

/**
 * Create a product entry from a user-submitted Amazon URL
 * This creates a minimal record that SP3ND will use for checkout
 */
export function createProductFromUrl(amazonUrl: string): AmazonProductFromUrl | null {
  const asin = extractAsin(amazonUrl);
  if (!asin) return null;

  return {
    asin,
    amazonUrl: createAmazonUrl(asin),
    title: "Amazon GoldBack Product", // Generic title - actual product info comes from SP3ND
    inStock: true, // Assume in stock - SP3ND will verify at checkout
  };
}

// ============================================
// Database Access Functions
// ============================================

/**
 * Get all Amazon GoldBack products from database
 * Note: With the new flow, this may return few/no products
 * since we're no longer auto-populating from scraping
 */
export async function getAmazonGoldBacks(): Promise<AmazonGoldBack[]> {
  return prisma.amazonGoldBack.findMany({
    where: { inStock: true },
    orderBy: { price: "asc" },
  });
}

/**
 * Get a single Amazon GoldBack by ASIN
 */
export async function getAmazonGoldBackByAsin(asin: string): Promise<AmazonGoldBack | null> {
  return prisma.amazonGoldBack.findUnique({
    where: { asin },
  });
}

/**
 * Get the last time a product was added/updated
 */
export async function getLastUpdateTime(): Promise<Date | null> {
  const latest = await prisma.amazonGoldBack.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return latest?.updatedAt || null;
}

/**
 * Save or update an Amazon product by ASIN
 * Called when user adds a product URL to cart (optional - for tracking)
 */
export async function saveAmazonProduct(
  asin: string,
  amazonUrl: string,
  title?: string
): Promise<AmazonGoldBack> {
  return prisma.amazonGoldBack.upsert({
    where: { asin },
    update: {
      amazonUrl,
      title: title || "Amazon GoldBack Product",
      updatedAt: new Date(),
    },
    create: {
      asin,
      amazonUrl,
      title: title || "Amazon GoldBack Product",
      price: 0, // Price determined at SP3ND checkout
      imageUrl: null,
      inStock: true,
      lastScraped: new Date(),
    },
  });
}

export default {
  extractAsin,
  isValidAmazonProductUrl,
  createAmazonUrl,
  createProductFromUrl,
  getAmazonGoldBacks,
  getAmazonGoldBackByAsin,
  getLastUpdateTime,
  saveAmazonProduct,
};
