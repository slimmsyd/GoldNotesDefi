'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { StarRating } from './StarRating';
import { createReview } from '@/app/shop-gold-backs/review-actions';
import { useToast } from '@/context/ToastContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/lib/supabase';

interface ReviewFormProps {
    productId: string;
    onSuccess?: () => void;
    onClose?: () => void;
}

export function ReviewForm({ productId, onSuccess, onClose }: ReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [userName, setUserName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();
    const { publicKey } = useWallet();

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files);
            // Limit to 4 images
            const remainingSlots = 4 - imageFiles.length;
            const filesToAdd = newFiles.slice(0, remainingSlots);

            setImageFiles(prev => [...prev, ...filesToAdd]);
            filesToAdd.forEach(file => {
                const url = URL.createObjectURL(file);
                setImagePreviews(prev => [...prev, url]);
            });
        }
    };

    const removeImage = (index: number) => {
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
        setImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (rating === 0) {
            showToast('Please select a rating', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload images to Supabase
            const uploadedImageUrls: string[] = [];
            for (const file of imageFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `reviews/${Date.now()}-${Math.random()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, file);

                if (uploadError) {
                    console.error('Image upload error:', uploadError);
                    continue;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);

                uploadedImageUrls.push(publicUrl);
            }

            const result = await createReview({
                productId,
                rating,
                comment: comment.trim() || undefined,
                userName: userName.trim() || undefined,
                userWallet: publicKey?.toBase58(),
                images: uploadedImageUrls,
            });

            if (result.success) {
                showToast('Review submitted successfully!', 'success');
                setRating(0);
                setComment('');
                setUserName('');
                setImagePreviews([]);
                setImageFiles([]);
                onSuccess?.();
            } else {
                showToast('Failed to submit review', 'error');
            }
        } catch (error) {
            console.error('Review submission error:', error);
            showToast('An error occurred', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="space-y-6"
        >
            {/* Rating */}
            <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500">
                    Your Rating *
                </label>
                <StarRating rating={rating} onRatingChange={setRating} size="lg" />
            </div>

            {/* Name */}
            <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500">
                    Your Name (optional)
                </label>
                <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Anonymous"
                    className="w-full px-4 py-3 border border-neutral-200 rounded-none focus:outline-none focus:border-neutral-900 transition-colors text-sm"
                />
            </div>

            {/* Comment */}
            <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500">
                    Your Review
                </label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience with this product..."
                    rows={4}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-none focus:outline-none focus:border-neutral-900 transition-colors text-sm resize-none"
                />
            </div>

            {/* Image Upload */}
            <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500">
                    Add Photos (optional, max 4)
                </label>

                <div className="flex flex-wrap gap-3">
                    {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative w-20 h-20">
                            <Image
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                fill
                                className="object-cover rounded"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 cursor-pointer"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {imageFiles.length < 4 && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-20 h-20 border-2 border-dashed border-neutral-300 hover:border-neutral-400 flex items-center justify-center text-neutral-400 hover:text-neutral-500 transition-colors cursor-pointer"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 border border-neutral-200 text-neutral-600 text-xs font-bold uppercase tracking-widest hover:border-neutral-400 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting || rating === 0}
                    className="flex-1 py-3 bg-neutral-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
            </div>
        </motion.form>
    );
}
