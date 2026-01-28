'use client';

import { motion } from "framer-motion";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";

// Amazon search URL for GoldBacks
const AMAZON_GOLDBACKS_URL = "https://www.amazon.com/goldbacks-currency/s?k=goldbacks+currency";

/**
 * Extract ASIN from Amazon URL
 * Supports /dp/ASIN and /gp/product/ASIN patterns
 */
function extractAsin(url: string): string | null {
    // Match /dp/ASIN pattern (case insensitive for the ASIN)
    const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
    if (dpMatch) return dpMatch[1].toUpperCase();

    // Match /gp/product/ASIN pattern
    const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (gpMatch) return gpMatch[1].toUpperCase();

    return null;
}

/**
 * Validate if URL is a valid Amazon product URL
 */
function isValidAmazonUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.hostname.includes('amazon.com') && extractAsin(url) !== null;
    } catch {
        return false;
    }
}

export function AmazonGoldBacksSection() {
    const [amazonUrl, setAmazonUrl] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const { addToCart } = useCart();
    const { showToast } = useToast();

    const handleBrowseAmazon = () => {
        window.open(AMAZON_GOLDBACKS_URL, '_blank', 'noopener,noreferrer');
    };

    const handleAddToCart = async () => {
        const trimmedUrl = amazonUrl.trim();
        
        if (!trimmedUrl) {
            showToast("Please paste an Amazon product URL", 'error');
            return;
        }

        if (!isValidAmazonUrl(trimmedUrl)) {
            showToast("Invalid Amazon URL. Please paste a valid product link.", 'error');
            return;
        }

        const asin = extractAsin(trimmedUrl);
        if (!asin) {
            showToast("Could not extract product ID from URL", 'error');
            return;
        }

        setIsAdding(true);

        try {
            // Create a cart item from the URL
            // Price will be determined at SP3ND checkout
            addToCart({
                id: `amazon-${asin}`,
                name: `Amazon GoldBack Product`,
                price: "Price at checkout",
                image: '/placeholder-goldback.png',
                quantity: 1,
                source: "amazon",
                amazonUrl: `https://www.amazon.com/dp/${asin}`,
                asin: asin,
            });

            showToast("Added to cart! Price will be confirmed at checkout.", 'success');
            setAmazonUrl(""); // Clear the input
        } catch (error) {
            console.error("Error adding to cart:", error);
            showToast("Failed to add item to cart", 'error');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <section className="px-6 md:px-12 lg:px-24 mt-24">
            <div className="max-w-4xl mx-auto">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-2xl font-light tracking-widest uppercase mb-4">
                        Amazon GoldBacks via SP3ND
                    </h2>
                    <p className="text-sm text-neutral-500 max-w-xl mx-auto">
                        Browse GoldBacks on Amazon, then paste the product URL below to checkout with USDC through SP3ND.
                    </p>
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="bg-white border border-neutral-200 rounded-lg overflow-hidden"
                >
                    {/* Step 1: Browse Amazon */}
                    <div className="p-8 border-b border-neutral-100">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-amber-700 font-bold text-sm">1</span>
                            </div>
                            <div className="flex-grow">
                                <h3 className="text-sm font-medium text-neutral-900 mb-2">
                                    Browse GoldBacks on Amazon
                                </h3>
                                <p className="text-xs text-neutral-500 mb-4">
                                    Click below to open Amazon and find the GoldBack product you want to purchase.
                                </p>
                                <button
                                    onClick={handleBrowseAmazon}
                                    className="inline-flex cursor-pointer items-center gap-2 px-6 py-3 bg-[#FF9900] text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-[#e88a00] transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Browse GoldBacks on Amazon
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Paste URL */}
                    <div className="p-8 border-b border-neutral-100">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-amber-700 font-bold text-sm">2</span>
                            </div>
                            <div className="flex-grow">
                                <h3 className="text-sm font-medium text-neutral-900 mb-2">
                                    Paste the Product URL
                                </h3>
                                <p className="text-xs text-neutral-500 mb-4">
                                    Copy the URL from your browser and paste it below.
                                </p>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={amazonUrl}
                                        onChange={(e) => setAmazonUrl(e.target.value)}
                                        placeholder="https://www.amazon.com/dp/B0XXXXXXXXX..."
                                        className="flex-grow px-4 py-3 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-neutral-400"
                                    />
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={isAdding || !amazonUrl.trim()}
                                        className="px-6 py-3 bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                                    >
                                        {isAdding ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                Add to Cart
                                            </>
                                        )}
                                    </button>
                                </div>
                                {amazonUrl && !isValidAmazonUrl(amazonUrl) && amazonUrl.length > 10 && (
                                    <p className="mt-2 text-xs text-red-500">
                                        Please enter a valid Amazon product URL (e.g., amazon.com/dp/...)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Checkout Info */}
                    <div className="p-8 bg-neutral-50">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-amber-700 font-bold text-sm">3</span>
                            </div>
                            <div className="flex-grow">
                                <h3 className="text-sm font-medium text-neutral-900 mb-2">
                                    Checkout with USDC
                                </h3>
                                <p className="text-xs text-neutral-500">
                                    Once added to cart, proceed to checkout. SP3ND will handle the Amazon purchase and ship directly to you. 
                                    Pay with USDC on Solana.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* SP3ND Info */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-lg"
                >
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm text-amber-800 font-medium">Powered by SP3ND</p>
                            <p className="text-xs text-amber-700 mt-1">
                                SP3ND enables crypto payments for Amazon products. The final price including fees and shipping 
                                will be calculated at checkout. Products ship directly from Amazon to your address.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
