'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ============================================
// Types
// ============================================

export type CartItemSource = "direct" | "amazon";

export interface CartItem {
    id: string;
    name: string;
    price: string; // Keeping as string to match GoldPackage, but will parse for total
    image: string;
    quantity: number;
    source: CartItemSource; // NEW: "direct" for your inventory, "amazon" for SP3ND
    amazonUrl?: string;     // NEW: Amazon product URL for SP3ND items
    asin?: string;          // NEW: Amazon Standard Identification Number
}

interface CartContextType {
    cartItems: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (itemId: string) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    clearCart: () => void;
    clearDirectItems: () => void;
    clearAmazonItems: () => void;
    loadSavedCart: (savedCart: CartItem[]) => void;
    setCartItems: (items: CartItem[]) => void;
    cartTotal: number;
    cartCount: number;
    // NEW: Separate totals and counts by source
    directTotal: number;
    amazonTotal: number;
    directCount: number;
    amazonCount: number;
    directItems: CartItem[];
    amazonItems: CartItem[];
    hasDirectItems: boolean;
    hasAmazonItems: boolean;
    hasMixedCart: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

export function CartProvider({ children }: { children: ReactNode }) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [cartTotal, setCartTotal] = useState(0);
    const [directTotal, setDirectTotal] = useState(0);
    const [amazonTotal, setAmazonTotal] = useState(0);

    // Load cart from local storage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('goldback_cart');
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                // Migration: Add source field to old cart items if missing
                const migratedItems = parsed.map((item: CartItem) => ({
                    ...item,
                    source: item.source || "direct", // Default to direct for old items
                }));
                setCartItems(migratedItems);
            } catch (e) {
                console.error("Failed to parse cart from local storage", e);
            }
        }
    }, []);

    // Save cart to local storage and calculate totals whenever cart changes
    useEffect(() => {
        localStorage.setItem('goldback_cart', JSON.stringify(cartItems));

        // Calculate totals by source
        let direct = 0;
        let amazon = 0;

        cartItems.forEach(item => {
            const price = parseFloat(item.price.replace(/[^0-9.]/g, ""));
            const itemTotal = isNaN(price) ? 0 : price * item.quantity;

            if (item.source === "amazon") {
                amazon += itemTotal;
            } else {
                direct += itemTotal;
            }
        });

        setDirectTotal(direct);
        setAmazonTotal(amazon);
        setCartTotal(direct + amazon);
    }, [cartItems]);

    // ----------------------------------------
    // Cart Operations
    // ----------------------------------------

    const addToCart = (item: CartItem) => {
        // Ensure source is set (default to direct)
        const itemWithSource: CartItem = {
            ...item,
            source: item.source || "direct",
        };

        setCartItems(prev => {
            const existing = prev.find(i => i.id === itemWithSource.id);
            if (existing) {
                return prev.map(i =>
                    i.id === itemWithSource.id
                        ? { ...i, quantity: i.quantity + itemWithSource.quantity }
                        : i
                );
            }
            return [...prev, itemWithSource];
        });
    };

    const removeFromCart = (itemId: string) => {
        setCartItems(prev => prev.filter(i => i.id !== itemId));
    };

    const updateQuantity = (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(itemId);
            return;
        }
        setCartItems(prev =>
            prev.map(i => (i.id === itemId ? { ...i, quantity } : i))
        );
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const clearDirectItems = () => {
        setCartItems(prev => prev.filter(item => item.source !== "direct"));
    };

    const clearAmazonItems = () => {
        setCartItems(prev => prev.filter(item => item.source !== "amazon"));
    };

    const loadSavedCart = (savedCart: CartItem[]) => {
        // Replace current cart with saved cart items
        // Ensure all items have a source field
        const itemsWithSource = savedCart.map(item => ({
            ...item,
            source: item.source || "direct" as CartItemSource,
        }));
        setCartItems(itemsWithSource);
    };

    // ----------------------------------------
    // Computed Values
    // ----------------------------------------

    const directItems = cartItems.filter(item => item.source === "direct");
    const amazonItems = cartItems.filter(item => item.source === "amazon");

    const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
    const directCount = directItems.reduce((acc, item) => acc + item.quantity, 0);
    const amazonCount = amazonItems.reduce((acc, item) => acc + item.quantity, 0);

    const hasDirectItems = directItems.length > 0;
    const hasAmazonItems = amazonItems.length > 0;
    const hasMixedCart = hasDirectItems && hasAmazonItems;

    // ----------------------------------------
    // Provider
    // ----------------------------------------

    return (
        <CartContext.Provider
            value={{
                cartItems,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                clearDirectItems,
                clearAmazonItems,
                loadSavedCart,
                setCartItems,
                cartTotal,
                cartCount,
                directTotal,
                amazonTotal,
                directCount,
                amazonCount,
                directItems,
                amazonItems,
                hasDirectItems,
                hasAmazonItems,
                hasMixedCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

// ============================================
// Hook
// ============================================

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
