'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { StarRating } from './StarRating';

interface ReviewImage {
    id: string;
    url: string;
}

interface Review {
    id: string;
    rating: number;
    comment: string | null;
    userName: string | null;
    userWallet: string | null;
    createdAt: Date | string;
    images: ReviewImage[];
}

interface ReviewListProps {
    reviews: Review[];
    isAdmin?: boolean;
    onDelete?: (reviewId: string) => void;
}

export function ReviewList({ reviews, isAdmin = false, onDelete }: ReviewListProps) {
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    if (reviews.length === 0) {
        return (
            <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No reviews yet. Be the first to review this product!</p>
            </div>
        );
    }

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const truncateWallet = (wallet: string) => {
        return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
    };

    return (
        <>
            <div className="space-y-6">
                {reviews.map((review, index) => (
                    <motion.div
                        key={review.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border-b border-neutral-100 pb-6 last:border-0"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-xs font-bold uppercase">
                                        {(review.userName || 'A')[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-neutral-900">
                                                {review.userName || 'Anonymous'}
                                            </span>
                                            {review.userWallet && (
                                                <span className="text-[10px] text-neutral-400 font-mono">
                                                    ({truncateWallet(review.userWallet)})
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StarRating rating={review.rating} readonly size="sm" />
                                            <span className="text-xs text-neutral-400">
                                                {formatDate(review.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Comment */}
                                {review.comment && (
                                    <p className="text-sm text-neutral-600 leading-relaxed mt-3">
                                        {review.comment}
                                    </p>
                                )}

                                {/* Images */}
                                {review.images.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {review.images.map((image) => (
                                            <button
                                                key={image.id}
                                                onClick={() => setExpandedImage(image.url)}
                                                className="relative w-16 h-16 overflow-hidden rounded hover:opacity-80 transition-opacity cursor-pointer"
                                            >
                                                <Image
                                                    src={image.url}
                                                    alt="Review image"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Admin Delete */}
                            {isAdmin && onDelete && (
                                <button
                                    onClick={() => onDelete(review.id)}
                                    className="p-2 text-neutral-300 hover:text-red-500 transition-colors cursor-pointer"
                                    title="Delete review"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Image Lightbox */}
            <AnimatePresence>
                {expandedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setExpandedImage(null)}
                        className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative max-w-4xl max-h-[90vh] w-full h-full"
                        >
                            <Image
                                src={expandedImage}
                                alt="Review image"
                                fill
                                className="object-contain"
                            />
                            <button
                                onClick={() => setExpandedImage(null)}
                                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors cursor-pointer"
                            >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
