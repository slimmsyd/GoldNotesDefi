'use server';

import prisma from '@/lib/prisma';
import type { AmazonGoldBack } from '@prisma/client';

/**
 * Amazon Actions for Server-Side Operations
 * 
 * Note: With the new "Browse & Paste" flow, most Amazon functionality
 * is handled client-side. These server actions are kept for potential
 * future use (e.g., tracking user-submitted products).
 */

/**
 * Get all Amazon GoldBack products from the database
 * Only returns in-stock items, sorted by price
 */
export async function getAmazonGoldBacks(): Promise<AmazonGoldBack[]> {
  try {
    const products = await prisma.amazonGoldBack.findMany({
      where: { inStock: true },
      orderBy: { price: 'asc' },
    });
    return products;
  } catch (error) {
    console.error('Failed to fetch Amazon GoldBacks:', error);
    return [];
  }
}

/**
 * Save a user-submitted Amazon product URL
 * This can be used for analytics/tracking of popular products
 */
export async function saveUserSubmittedProduct(
  asin: string,
  amazonUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.amazonGoldBack.upsert({
      where: { asin },
      update: {
        amazonUrl,
        updatedAt: new Date(),
      },
      create: {
        asin,
        amazonUrl,
        title: 'Amazon GoldBack Product',
        price: 0, // Price determined at SP3ND checkout
        imageUrl: null,
        inStock: true,
        lastScraped: new Date(),
      },
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to save Amazon product:', error);
    return { success: false, error: 'Failed to save product' };
  }
}
