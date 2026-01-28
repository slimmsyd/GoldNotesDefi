'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StarRating } from './StarRating';
import { ReviewForm } from './ReviewForm';
import { ReviewList } from './ReviewList';
import { getProductReviews, getProductReviewStats, deleteReview } from '@/app/shop-gold-backs/review-actions';
import { useToast } from '@/context/ToastContext';
import { useWallet } from '@solana/wallet-adapter-react';

interface ProductReviewsProps {
    productId: string;
    productName: string;
    isAdmin?: boolean;
}

interface ReviewStats {
    averageRating: number;
    totalReviews: number;
}

export function ProductReviews({ productId, productName, isAdmin = false }: ProductReviewsProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [reviews, setReviews] = useState<any[]>([]);
    const [stats, setStats] = useState<ReviewStats>({ averageRating: 0, totalReviews: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();
    const { publicKey } = useWallet();

    const isConnected = !!publicKey;

    const fetchReviews = async () => {
        setIsLoading(true);
        try {
            const [reviewsResult, statsResult] = await Promise.all([
                getProductReviews(productId),
                getProductReviewStats(productId),
            ]);

            if (reviewsResult.success) {
                setReviews(reviewsResult.data);
            }
            setStats(statsResult);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [productId]);

    const handleReviewSuccess = () => {
        setIsFormOpen(false);
        fetchReviews();
    };

    const handleDeleteReview = async (reviewId: string) => {
        if (!confirm('Are you sure you want to delete this review?')) return;

        const result = await deleteReview(reviewId);
        if (result.success) {
            showToast('Review deleted', 'success');
            fetchReviews();
        } else {
            showToast('Failed to delete review', 'error');
        }
    };

    // Rating distribution for the bar chart
    const getRatingDistribution = () => {
        const distribution = [0, 0, 0, 0, 0]; // 1-5 stars
        reviews.forEach(review => {
            if (review.rating >= 1 && review.rating <= 5) {
                distribution[review.rating - 1]++;
            }
        });
        return distribution;
    };

    const ratingDistribution = getRatingDistribution();
    const maxCount = Math.max(...ratingDistribution, 1);

    return (
        <div className="mt-8 pt-8 border-t border-neutral-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-light tracking-widest uppercase text-neutral-900">
                    Reviews
                </h3>
                {isConnected ? (
                    <button
                        onClick={() => setIsFormOpen(!isFormOpen)}
                        className="px-4 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 text-xs font-bold uppercase tracking-widest transition-colors border border-neutral-200 cursor-pointer"
                    >
                        {isFormOpen ? 'Cancel' : 'Write a Review'}
                    </button>
                ) : (
                    <span className="px-4 py-2 text-neutral-400 text-xs font-bold uppercase tracking-widest border border-neutral-100">
                        Connect Wallet to Review
                    </span>
                )}
            </div>

            {/* Stats Summary */}
            {stats.totalReviews > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-neutral-50 border border-neutral-100">
                    {/* Average Rating */}
                    <div className="text-center md:text-left">
                        <div className="text-5xl font-light text-neutral-900 mb-2">
                            {stats.averageRating.toFixed(1)}
                        </div>
                        <StarRating rating={Math.round(stats.averageRating)} readonly size="md" />
                        <p className="text-sm text-neutral-500 mt-2">
                            Based on {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {/* Rating Distribution */}
                    <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((stars) => {
                            const count = ratingDistribution[stars - 1];
                            const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                            return (
                                <div key={stars} className="flex items-center gap-2 text-sm">
                                    <span className="text-neutral-400 w-3">{stars}</span>
                                    <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                    <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-400 transition-all duration-300"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <span className="text-neutral-400 w-8 text-right">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Review Form */}
            <AnimatePresence>
                {isFormOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-8 p-6 bg-neutral-50 border border-neutral-100 rounded-lg"
                    >
                        <h4 className="text-lg font-medium text-neutral-900 mb-4">
                            Write a Review for {productName}
                        </h4>
                        <ReviewForm
                            productId={productId}
                            onSuccess={handleReviewSuccess}
                            onClose={() => setIsFormOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reviews List */}
            {isLoading ? (
                <div className="text-center py-12 text-neutral-400">
                    <div className="animate-spin w-8 h-8 border-2 border-neutral-200 border-t-neutral-600 rounded-full mx-auto mb-4" />
                    <p className="text-sm">Loading reviews...</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg">
                    <ReviewList
                        reviews={reviews}
                        isAdmin={isAdmin}
                        onDelete={isAdmin ? handleDeleteReview : undefined}
                    />
                </div>
            )}
        </div>
    );
}
