'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Default Goldback rate per 1 GB (fallback if DB fails)
const DEFAULT_GOLDBACK_RATE = 9.02;

/**
 * Get site settings from database
 * Creates default settings if they don't exist
 */
export async function getSiteSettings() {
  try {
    let settings = await prisma.siteSettings.findUnique({
      where: { id: 'main' },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.siteSettings.create({
        data: {
          id: 'main',
          goldbackRatePer1GB: DEFAULT_GOLDBACK_RATE,
        },
      });
    }

    return settings;
  } catch (error) {
    console.error('Failed to get site settings:', error);
    // Return default if database fails
    return {
      id: 'main',
      goldbackRatePer1GB: DEFAULT_GOLDBACK_RATE,
      updatedAt: new Date(),
    };
  }
}

/**
 * Update the Goldback rate per 1 GB (admin only)
 * @param newRate - The new rate in USD (e.g., 9.02 for $9.02 per 1 GB)
 */
export async function updateGoldbackRate(newRate: number) {
  try {
    if (newRate <= 0 || newRate > 100) {
      return { success: false, error: 'Rate must be between $0.01 and $100' };
    }

    const settings = await prisma.siteSettings.upsert({
      where: { id: 'main' },
      update: { goldbackRatePer1GB: newRate },
      create: {
        id: 'main',
        goldbackRatePer1GB: newRate,
      },
    });

    revalidatePath('/shop-gold-backs');
    return { success: true, data: settings };
  } catch (error) {
    console.error('Failed to update goldback rate:', error);
    return { success: false, error: 'Failed to update rate' };
  }
}

/**
 * Force refresh the gold price from API (clears cache)
 */
export async function forceRefreshGoldPrice() {
  try {
    // Clear the cache in the gold-price service
    const { clearGoldPriceCache } = await import('@/lib/gold-price');
    clearGoldPriceCache();
    
    revalidatePath('/shop-gold-backs');
    return { success: true, message: 'Gold price cache cleared. Will refresh on next page load.' };
  } catch (error) {
    console.error('Failed to refresh gold price:', error);
    return { success: false, error: 'Failed to refresh gold price' };
  }
}
