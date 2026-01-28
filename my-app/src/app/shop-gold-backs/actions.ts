'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getGoldPackages() {
  try {
    const packages = await prisma.goldPackage.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });
    

    
    return packages;
  } catch (error) {
    console.error('Failed to fetch gold packages:', error);
    return [];
  }
}

export async function createGoldPackage(data: {
  name: string;
  price: string;
  description: string;
  features: string[];
  image: string;
  stock: number;
  minQty: number;
  isPopular?: boolean;
}) {
  try {

    
    const newPackage = await prisma.goldPackage.create({
      data: {
        id: Date.now().toString(), // Simple ID generation for now, matching previous frontend logic
        ...data,
      },
    });
    

    
    revalidatePath('/shop-gold-backs');
    return { success: true, data: newPackage };
  } catch (error) {
    console.error('Failed to create gold package:', error);
    return { success: false, error: 'Failed to create package' };
  }
}

export async function deleteGoldPackage(id: string) {
  try {
    await prisma.goldPackage.delete({
      where: {
        id: id,
      },
    });
    
    revalidatePath('/shop-gold-backs');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete gold package:', error);
    return { success: false, error: 'Failed to delete package' };
  }
}

export async function updateGoldPackage(id: string, data: {
  name?: string;
  price?: string;
  description?: string;
  features?: string[];
  image?: string;
  stock?: number;
  minQty?: number;
  isPopular?: boolean;
}) {
  try {

    
    const updatedPackage = await prisma.goldPackage.update({
      where: {
        id: id,
      },
      data: data,
    });
    

    
    revalidatePath('/shop-gold-backs');
    return { success: true, data: updatedPackage };
  } catch (error) {
    console.error('Failed to update gold package:', error);
    return { success: false, error: 'Failed to update package' };
  }
}

/**
 * Atomically decrement stock for multiple items after a successful purchase.
 * Uses Prisma transaction to ensure all updates succeed or all fail.
 */
export async function decrementStock(items: { id: string; quantity: number }[]) {
  try {

    
    // Use transaction to ensure atomicity
    const results = await prisma.$transaction(
      items.map(item => 
        prisma.goldPackage.update({
          where: { id: item.id },
          data: { stock: { decrement: item.quantity } }
        })
      )
    );
    

    
    revalidatePath('/shop-gold-backs');
    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to decrement stock:', error);
    return { success: false, error: 'Failed to update stock' };
  }
}
