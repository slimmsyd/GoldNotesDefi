'use client';

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, ChangeEvent, useEffect } from "react";
import { createGoldPackage, deleteGoldPackage, updateGoldPackage } from "@/app/shop-gold-backs/actions";
import { forceRefreshGoldPrice, updateGoldbackRate } from "@/app/shop-gold-backs/settings-actions";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { supabase } from "@/lib/supabase";
import { useWallet } from '@solana/wallet-adapter-react';
import { ProductReviews } from "@/components/reviews/ProductReviews";

const ALLOWED_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "").split(",").map(w => w.trim()).filter(Boolean);

// Define the interface here or import from a shared type file if available.
// Since we are using Prisma, we could import from @prisma/client, but for now matching the existing interface is fine.
// Actually, let's try to match the Prisma generated type if possible, but for simplicity I'll stick to the interface 
// and ensure it matches the data passed from server.
interface GoldPackage {
    id: string;
    name: string;
    price: string;
    description: string;
    features: string[];
    image: string;
    stock: number;
    isPopular?: boolean;
    minQty?: number;
}

interface GoldPriceInfo {
    pricePerOz: number;
    formattedPrice: string;
    lastUpdated: string;
    source: 'api' | 'fallback';
}

interface ShopGoldBacksContentProps {
    initialPackages: GoldPackage[];
    goldPriceInfo: GoldPriceInfo;
    goldbackRate: number; // Direct rate per 1 GB (e.g., $9.02)
}

/**
 * Extract gold content denomination from features (1, 5, 10, etc.)
 * Matches patterns like "1/1000th oz" and returns the numerator
 */
function getGoldDenomination(features: string[]): number | null {
    const regex = /(\d+)\/1000(?:th)?\s*oz/i;
    for (const feature of features) {
        const match = feature.match(regex);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    return null;
}

/**
 * Calculate display price based on denomination and Goldback rate
 * price = goldbackRate × denomination (e.g., $9.02 × 5 = $45.10)
 */
function getDisplayPrice(pkg: GoldPackage, goldbackRate: number): string {
    const denomination = getGoldDenomination(pkg.features);
    if (denomination) {
        const price = goldbackRate * denomination;
        return `$${price.toFixed(2)}`;
    }
    // Fallback to stored price if no gold content found
    return pkg.price;
}

export function ShopGoldBacksContent({ initialPackages, goldPriceInfo, goldbackRate }: ShopGoldBacksContentProps) {


    // State for admin controls
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [editingRate, setEditingRate] = useState(false);
    const [newRate, setNewRate] = useState(goldbackRate.toString());

    // We can use the prop directly if we rely on router.refresh(), 
    // but keeping local state allows for optimistic updates or just simple state management as before.
    // However, to sync with server, it's better to rely on props.
    // Let's use local state initialized from props, but update it when props change.
    const [packages, setPackages] = useState<GoldPackage[]>(initialPackages);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GoldPackage | null>(null);
    const [viewingImage, setViewingImage] = useState<GoldPackage | null>(null);
    const router = useRouter();
    const { addToCart, cartItems } = useCart();
    const { showToast } = useToast();
    const { publicKey } = useWallet();
    const isAdmin = publicKey && ALLOWED_WALLETS.includes(publicKey.toBase58());

    useEffect(() => {
        setPackages(initialPackages);
    }, [initialPackages]);

    // Form State
    const [newItem, setNewItem] = useState<Partial<GoldPackage>>({
        name: "",
        price: "",
        description: "",
        features: [],
        stock: 0,
        minQty: 3,
    });
    const [featureInput, setFeatureInput] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setImagePreview(url);
            setImageFile(file);
            setNewItem(prev => ({ ...prev, image: url }));
        }
    };

    const addFeature = () => {
        if (featureInput.trim()) {
            setNewItem(prev => ({
                ...prev,
                features: [...(prev.features || []), featureInput.trim()]
            }));
            setFeatureInput("");
        }
    };

    const handleSubmit = async () => {
        if (newItem.name && newItem.price && newItem.description) {
            setIsSubmitting(true);
            try {
                let imageUrl = imagePreview || "";

                if (imageFile) {
                    try {
                        const fileExt = imageFile.name.split('.').pop();
                        const fileName = `${Math.random()}.${fileExt}`;
                        const filePath = `${fileName}`;

                        const { error: uploadError } = await supabase.storage
                            .from('product-images')
                            .upload(filePath, imageFile);

                        if (uploadError) {
                            throw uploadError;
                        }

                        const { data: { publicUrl } } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(filePath);

                        imageUrl = publicUrl;
                    } catch (error) {
                        console.error('Error uploading image:', error);
                        showToast("Failed to upload image", 'error');
                        return;
                    }
                }

                const pkgData = {
                    name: newItem.name!,
                    price: newItem.price!,
                    description: newItem.description!,
                    features: newItem.features || [],
                    image: imageUrl,
                    stock: newItem.stock || 0,
                    minQty: newItem.minQty || 3,
                    isPopular: false,
                };



                // Determine if we're editing or creating
                const result = editingItem
                    ? await updateGoldPackage(editingItem.id, pkgData)
                    : await createGoldPackage(pkgData);

                if (result.success) {
                    setIsModalOpen(false);
                    setNewItem({ name: "", price: "", description: "", features: [], stock: 0, minQty: 3 });
                    setEditingItem(null);
                    setImagePreview(null);
                    setImageFile(null);
                    setFeatureInput("");
                    // Refresh the page to fetch updated data from server
                    router.refresh();
                    showToast(editingItem ? "Package updated successfully!" : "Package created successfully!", 'success');
                } else {
                    showToast(editingItem ? "Failed to update package" : "Failed to create package", 'error');
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                showToast("An unexpected error occurred", 'error');
            } finally {
                setIsSubmitting(false);
            }
        } else {
            showToast("Please fill all required fields (Name, Price, Description)", 'error');
        }
    };

    const MINIMUM_QUANTITY = 3; // Minimum 3 per denomination

    const handleAddToCart = (pkg: GoldPackage) => {
        const currentInCart = cartItems.find(item => item.id === pkg.id)?.quantity || 0;
        const MINIMUM_QUANTITY = pkg.minQty || 3; // Use package specific minQty or default to 3

        // If first time adding this item, add minimum quantity
        // Otherwise add 1 more
        const quantityToAdd = currentInCart === 0 ? MINIMUM_QUANTITY : 1;

        if (currentInCart + quantityToAdd > pkg.stock) {
            showToast(`Cannot add. ${pkg.stock < MINIMUM_QUANTITY ? 'Not enough stock.' : 'Stock limit reached.'}`, 'error');
            return;
        }

        addToCart({
            id: pkg.id,
            name: pkg.name,
            price: getDisplayPrice(pkg, goldbackRate),
            image: pkg.image,
            quantity: quantityToAdd,
            source: "direct", // Direct inventory from your stock
        });

        if (currentInCart === 0) {
            showToast(`Added ${MINIMUM_QUANTITY} to cart (minimum order)`, 'success');
        } else {
            showToast("Added to cart!", 'success');
        }
    };

    return (
        <main className="pt-32 pb-24">
            {/* Hero Section */}
            <section className="relative py-24 px-6 md:px-12 lg:px-24 text-center">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-4xl md:text-6xl font-light tracking-widest uppercase mb-6"
                >
                    The Gold Collection
                </motion.h1>
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="w-24 h-0.5 bg-neutral-900 mx-auto mb-8"
                />
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                    className="text-lg text-neutral-500 max-w-2xl mx-auto leading-relaxed font-light"
                >
                    Timeless assets for the discerning investor.
                </motion.p>

                {/* Gold Price & Rate Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="mt-8 flex flex-col items-center gap-2"
                >
                    {/* Gold Spot Price */}


                    {/* Goldback Rate */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
                        <span className="text-xs text-amber-700 font-medium tracking-wide">
                            Goldback Rate: ${goldbackRate.toFixed(2)}/GB
                        </span>
                        {/* Admin Rate Editor */}
                        {isAdmin && (
                            <div className="flex items-center gap-1 ml-2">
                                {editingRate ? (
                                    <>
                                        <span className="text-[10px] text-amber-600">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={newRate}
                                            onChange={(e) => setNewRate(e.target.value)}
                                            className="w-16 px-1 py-0.5 text-xs border border-amber-300 rounded bg-white"
                                            placeholder="9.02"
                                        />
                                        <button
                                            onClick={async () => {
                                                const rate = parseFloat(newRate);
                                                if (isNaN(rate) || rate <= 0) {
                                                    showToast('Invalid rate', 'error');
                                                    return;
                                                }
                                                const result = await updateGoldbackRate(rate);
                                                if (result.success) {
                                                    showToast('Rate updated!', 'success');
                                                    router.refresh();
                                                } else {
                                                    showToast('Failed to update', 'error');
                                                }
                                                setEditingRate(false);
                                            }}
                                            className="text-green-600 hover:text-green-800 cursor-pointer"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingRate(false);
                                                setNewRate(goldbackRate.toString());
                                            }}
                                            className="text-red-600 hover:text-red-800 cursor-pointer"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={async () => {
                                                setIsRefreshing(true);
                                                try {
                                                    const response = await fetch('https://www.w3bs.fun/api/cron/update-rate');
                                                    const data = await response.json();
                                                    if (data.success) {
                                                        showToast(`Rate updated: $${data.oldRate.toFixed(2)} → $${data.newRate.toFixed(2)}`, 'success');
                                                        router.refresh();
                                                    } else {
                                                        showToast('Failed to fetch latest rate', 'error');
                                                    }
                                                } catch (error) {
                                                    showToast('Error fetching rate', 'error');
                                                }
                                                setIsRefreshing(false);
                                            }}
                                            disabled={isRefreshing}
                                            className="ml-1 px-2 py-0.5 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer font-medium disabled:opacity-50 flex items-center gap-1"
                                            title="Fetch latest rate from goldback.com"
                                        >
                                            <svg className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            {isRefreshing ? 'Fetching...' : 'Fetch Latest'}
                                        </button>
                                        <button
                                            onClick={() => setEditingRate(true)}
                                            className="ml-1 px-2 py-0.5 text-[10px] bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer font-medium"
                                            title="Edit Goldback Rate"
                                        >
                                            Edit
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </section>

            {/* Toolbar / Actions */}
            {isAdmin && (
                <section className="px-6 md:px-12 lg:px-24 mb-12 flex justify-end max-w-7xl mx-auto">
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setNewItem({ name: "", price: "", description: "", features: [], stock: 0, minQty: 3 });
                            setImagePreview(null);
                            setImageFile(null);
                            setFeatureInput("");
                            setIsModalOpen(true);
                        }}
                        className="px-6 cursor-pointer py-3 border border-neutral-200 text-neutral-600 text-xs font-bold uppercase tracking-[0.15em] hover:border-neutral-900 hover:text-neutral-900 transition-colors duration-300 cursor-pointer"
                    >
                        + List Item
                    </button>
                </section>
            )}

            {/* Products Grid */}
            <section className="px-6 md:px-12 lg:px-24">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-16">
                    {packages.map((pkg, index) => {
                        return (
                            <motion.div
                                key={pkg.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="group flex flex-col"
                            >
                                <div className="relative aspect-[4/5] w-full mb-8 bg-neutral-50 overflow-hidden">
                                    {pkg.image && !pkg.image.startsWith('/') ? (
                                        // For uploaded images (blob URLs) - Note: Blob URLs won't persist across sessions for other users
                                        // In a real app, we'd upload to storage. For now, we are storing the blob URL string in DB which is not ideal but matches current logic.
                                        // Wait, storing blob URL in DB won't work for other users. 
                                        // But the user asked to "ensure you are pulling from the backend".
                                        // I will proceed with this limitation for now as image upload wasn't explicitly requested to be fixed, just data fetching.
                                        <Image src={pkg.image} alt={pkg.name} fill className="object-cover" />
                                    ) : (
                                        // Placeholder or static images
                                        pkg.image ? (
                                            <Image src={pkg.image} alt={pkg.name} fill className="object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-neutral-200 bg-neutral-50 group-hover:bg-neutral-100 transition-colors duration-500">
                                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                            </div>
                                        )
                                    )}

                                    {pkg.isPopular && (
                                        <div className="absolute top-4 left-4 text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-900 z-10">
                                            Best Seller
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-center text-center flex-grow">
                                    <h3 className="text-lg font-medium tracking-wide text-neutral-900 mb-2 uppercase">{pkg.name}</h3>
                                    <div className="text-neutral-900 text-xl font-medium mb-1">{getDisplayPrice(pkg, goldbackRate)}</div>
                                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-6">{pkg.stock} in stock</p>
                                    <p className="text-sm text-neutral-500 mb-8 leading-relaxed max-w-xs mx-auto">{pkg.description}</p>

                                    <ul className="space-y-2 mb-8 border-t border-b border-neutral-100 py-6 w-full">
                                        {pkg.features.map((feature, i) => (
                                            <li key={i} className="text-xs text-neutral-400 uppercase tracking-wider">
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="w-full cursor-pointer space-y-3 mt-auto">
                                        <button
                                            onClick={() => setViewingImage(pkg)}
                                            className="w-full cursor-pointer py-4 bg-white border border-neutral-900 text-neutral-900 text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-900 hover:text-white transition-all duration-300"
                                        >
                                            View Details
                                        </button>
                                        <button
                                            onClick={() => handleAddToCart(pkg)}
                                            className="w-full cursor-pointer py-4 bg-[#9945FF] border border-[#9945FF] text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#7c37cf] transition-all duration-300 flex items-center justify-center gap-2"
                                        >
                                            <span>Add to Cart</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </section>

            {/* Upload Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-white/90 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-5xl bg-white border border-neutral-200 shadow-2xl p-8 md:p-12 overflow-y-auto max-h-[90vh]"
                        >
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-6 right-6 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <h2 className="text-2xl font-light tracking-widest uppercase mb-8 text-center">{editingItem ? 'Edit Item' : 'Manage Collection'}</h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                {/* Create New Item Section */}
                                <div className="space-y-8">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900 border-b border-neutral-100 pb-4">{editingItem ? 'Edit Item' : 'New Acquisition'}</h3>

                                    {/* Image Upload */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="relative aspect-[4/3] w-full border border-dashed border-neutral-300 hover:border-neutral-900 transition-colors cursor-pointer flex flex-col items-center justify-center bg-neutral-50 group"
                                    >
                                        {imagePreview ? (
                                            <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                                        ) : (
                                            <div className="text-center p-6">
                                                <span className="block text-neutral-400 text-sm uppercase tracking-widest mb-2 group-hover:text-neutral-900 transition-colors">Upload Imagery</span>
                                                <span className="text-xs text-neutral-300">Click to select file</span>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Item Name</label>
                                            <input
                                                type="text"
                                                value={newItem.name}
                                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                                className="w-full border-b border-neutral-200 py-2 text-lg font-medium focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200"
                                                placeholder="E.g. The Royal Reserve"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Price</label>
                                            <input
                                                type="text"
                                                value={newItem.price}
                                                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                                className="w-full border-b border-neutral-200 py-2 text-lg font-medium focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200"
                                                placeholder="E.g. $12,500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Stock</label>
                                            <input
                                                type="number"
                                                value={newItem.stock}
                                                onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                                                className="w-full border-b border-neutral-200 py-2 text-lg font-medium focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200"
                                                placeholder="E.g. 10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Min Order Qty</label>
                                            <input
                                                type="number"
                                                value={newItem.minQty}
                                                onChange={(e) => setNewItem({ ...newItem, minQty: parseInt(e.target.value) || 1 })}
                                                className="w-full border-b border-neutral-200 py-2 text-lg font-medium focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200"
                                                placeholder="E.g. 3"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Description</label>
                                        <textarea
                                            value={newItem.description}
                                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                            rows={3}
                                            className="w-full border-b border-neutral-200 py-2 text-sm leading-relaxed focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200 resize-none"
                                            placeholder="Describe the asset details and value proposition..."
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Features</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={featureInput}
                                                onChange={(e) => setFeatureInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                                                className="flex-grow border-b border-neutral-200 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200"
                                                placeholder="Add a feature (Press Enter)"
                                            />
                                            <button
                                                onClick={addFeature}
                                                className="text-xs font-bold uppercase tracking-wider text-neutral-900 hover:text-neutral-500 cursor-pointer"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {newItem.features?.map((feat, i) => (
                                                <span key={i} className="inline-flex items-center px-3 py-1 bg-neutral-100 text-[10px] uppercase tracking-wider text-neutral-600">
                                                    {feat}
                                                    <button
                                                        onClick={() => setNewItem(prev => ({ ...prev, features: prev.features?.filter((_, idx) => idx !== i) }))}
                                                        className="ml-2 text-neutral-400 hover:text-neutral-900 cursor-pointer"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-8 flex gap-4">
                                        {editingItem && (
                                            <button
                                                onClick={() => {
                                                    setEditingItem(null);
                                                    setNewItem({ name: "", price: "", description: "", features: [], stock: 0, minQty: 3 });
                                                    setImagePreview(null);
                                                    setImageFile(null);
                                                    setFeatureInput("");
                                                }}
                                                className="flex-1 cursor-pointer py-4 bg-white border border-neutral-300 text-neutral-600 text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-50 transition-colors"
                                            >
                                                Cancel Edit
                                            </button>
                                        )}
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isSubmitting}
                                            className={`flex-1 cursor-pointer py-4 bg-neutral-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isSubmitting ? 'Processing...' : (editingItem ? 'Update Item' : 'Create Listing')}
                                        </button>
                                    </div>
                                </div>

                                {/* Existing Items List */}
                                <div className="space-y-8 border-t lg:border-t-0 lg:border-l border-neutral-100 pt-8 lg:pt-0 lg:pl-12">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900 border-b border-neutral-100 pb-4">Existing Inventory</h3>

                                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {packages.map((pkg) => (
                                            <div key={pkg.id} className="flex items-start gap-4 p-4 border border-neutral-100 hover:border-neutral-200 transition-colors group">
                                                <div className="relative w-16 h-16 bg-neutral-50 flex-shrink-0">
                                                    {pkg.image ? (
                                                        <Image src={pkg.image} alt={pkg.name} fill className="object-cover" />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center text-neutral-200">
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <h4 className="text-sm font-medium text-neutral-900 truncate">{pkg.name}</h4>
                                                    <p className="text-xs text-neutral-500 mb-1">{pkg.price}</p>
                                                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider">{pkg.stock} in stock</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingItem(pkg);
                                                            setNewItem({
                                                                name: pkg.name,
                                                                price: pkg.price,
                                                                description: pkg.description,
                                                                features: pkg.features,
                                                                stock: pkg.stock,
                                                                minQty: pkg.minQty || 3,
                                                            });
                                                            setImagePreview(pkg.image);
                                                        }}
                                                        className="p-2 text-neutral-300 hover:text-blue-600 transition-colors cursor-pointer"
                                                        title="Edit Item"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('Are you sure you want to delete this item?')) {
                                                                const result = await deleteGoldPackage(pkg.id);
                                                                if (result.success) {
                                                                    router.refresh();
                                                                    showToast("Package deleted successfully!", 'success');
                                                                } else {
                                                                    showToast('Failed to delete item', 'error');
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 text-neutral-300 hover:text-red-600 transition-colors cursor-pointer"
                                                        title="Delete Item"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {packages.length === 0 && (
                                            <div className="text-center py-12 text-neutral-400 text-sm">
                                                No items in inventory.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Image Zoom/Gallery Modal */}
            <AnimatePresence>
                {
                    viewingImage && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setViewingImage(null)}
                                className="absolute inset-0 bg-black/95 backdrop-blur-md"
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", duration: 0.5 }}
                                className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl rounded-lg"
                            >
                                {/* Close Button */}
                                <button
                                    onClick={() => setViewingImage(null)}
                                    className="absolute top-4 right-4 z-10 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-2 bg-white/80 rounded-full"
                                    aria-label="Close"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start p-8 md:p-12">
                                    {/* Image Container */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="relative aspect-square w-full bg-neutral-50 border border-neutral-100 rounded-lg overflow-hidden"
                                    >
                                        {viewingImage.image ? (
                                            <Image
                                                src={viewingImage.image}
                                                alt={viewingImage.name}
                                                fill
                                                className="object-contain p-8"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
                                                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                    </motion.div>

                                    {/* Product Details */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="space-y-6"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {viewingImage.isPopular && (
                                            <div className="inline-block px-3 py-1 bg-neutral-100 text-neutral-900 border border-neutral-200 text-[10px] font-bold tracking-[0.2em] uppercase">
                                                Best Seller
                                            </div>
                                        )}

                                        <h2 className="text-3xl md:text-4xl font-light tracking-widest uppercase text-neutral-900">
                                            {viewingImage.name}
                                        </h2>

                                        <div className="flex items-center gap-4">
                                            <div className="text-3xl font-light text-neutral-900">{getDisplayPrice(viewingImage, goldbackRate)}</div>
                                            <div className="text-sm text-neutral-500 uppercase tracking-wider">
                                                {viewingImage.stock} in stock
                                            </div>
                                        </div>

                                        <div className="w-16 h-px bg-neutral-200" />

                                        <p className="text-neutral-600 leading-relaxed text-lg font-light">
                                            {viewingImage.description}
                                        </p>

                                        {viewingImage.features.length > 0 && (
                                            <div className="space-y-4 pt-4">
                                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                                                    Features & Specifications
                                                </h3>
                                                <ul className="space-y-2">
                                                    {viewingImage.features.map((feature, i) => (
                                                        <li key={i} className="flex items-start gap-3 text-neutral-500">
                                                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span className="text-sm uppercase tracking-wide">{feature}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="pt-8 space-y-3">
                                            <button
                                                onClick={() => {
                                                    handleAddToCart(viewingImage);
                                                    setViewingImage(null);
                                                }}
                                                className="w-full cursor-pointer py-4 bg-neutral-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-all duration-300 shadow-lg hover:shadow-xl"
                                            >
                                                Add to Cart
                                            </button>
                                            <button
                                                onClick={() => setViewingImage(null)}
                                                className="w-full cursor-pointer py-4 border border-white/30 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-all duration-300"
                                            >
                                                Close
                                            </button>
                                        </div>

                                        {/* Product Reviews */}
                                        <ProductReviews
                                            productId={viewingImage.id}
                                            productName={viewingImage.name}
                                            isAdmin={!!isAdmin}
                                        />
                                    </motion.div>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >
        </main >
    );
}
