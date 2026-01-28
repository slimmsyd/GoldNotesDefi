'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Input validation schema
const CreateReviewSchema = z.object({
  productId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  userName: z.string().optional(),
  userWallet: z.string().optional(),
  images: z.array(z.string()).optional(), // Array of image URLs
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

/**
 * Create a new product review
 */
export async function createReview(input: CreateReviewInput) {
  try {
    const validatedData = CreateReviewSchema.parse(input);

    const review = await prisma.review.create({
      data: {
        productId: validatedData.productId,
        rating: validatedData.rating,
        comment: validatedData.comment,
        userName: validatedData.userName || "Anonymous",
        userWallet: validatedData.userWallet,
        status: "APPROVED", // Default to approved for now, as discussed
        // Create related images if any provided
        images: {
          create: validatedData.images?.map(url => ({ url })) || [],
        },
      },
      include: {
        images: true,
      },
    });

    revalidatePath(`/shop-gold-backs`);
    return { success: true, data: review };
  } catch (error) {
    console.error('Failed to create review:', error);
    return { success: false, error: 'Failed to submit review' };
  }
}

/**
 * Get reviews for a specific product
 */
export async function getProductReviews(productId: string) {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        productId: productId,
        status: "APPROVED",
      },
      include: {
        images: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { success: true, data: reviews };
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return { success: false, data: [] };
  }
}

/**
 * Get review statistics for a product (average rating, count)
 */
export async function getProductReviewStats(productId: string) {
  try {
    const aggregations = await prisma.review.aggregate({
      where: {
        productId: productId,
        status: "APPROVED",
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return {
      averageRating: aggregations._avg.rating || 0,
      totalReviews: aggregations._count.rating || 0,
    };
  } catch (error) {
    console.error('Failed to fetch review stats:', error);
    return { averageRating: 0, totalReviews: 0 };
  }
}

/**
 * Delete a review (Admin only)
 */
export async function deleteReview(reviewId: string) {
  try {
    await prisma.review.delete({
      where: {
        id: reviewId,
      },
    });

    revalidatePath(`/shop-gold-backs`);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete review:', error);
    return { success: false, error: 'Failed to delete review' };
  }
}
