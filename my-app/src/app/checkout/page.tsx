'use client';

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from "@solana/spl-token";

import { createMemoInstruction } from "@solana/spl-memo";
import PaymentErrorModal from "@/components/payment-error-modal";
import PaymentSuccessModal from "@/components/payment-success-modal";
import { OnrampButton } from "@/components/coinbase/onramp-button";
import { calculateShippingMethod, getAvailableShippingMethods } from "@/config/shipping-config";
import { MixedCartBlocker } from "@/components/checkout/mixed-cart-blocker";
import { AmazonCheckout } from "@/components/checkout/amazon-checkout";
import { PrivatePaymentFlow } from "@/components/checkout/private-payment-flow";

import { ShippingMethod } from "@/types/shipping-types";
import { decrementStock } from "@/app/shop-gold-backs/actions";
import { PROTOCOL_CONFIG } from "@/lib/protocol-constants";
import { validateNetworkConnection } from "@/lib/network-utils";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/context/ToastContext";

// Checkout modes for auto-routing
type CheckoutMode = 'auto' | 'direct' | 'amazon';

type DirectCheckoutCurrency = 'SOL' | 'USDC';

interface DirectCheckoutCreateResponse {
    success: boolean;
    orderId?: string;
    memo?: string;
    merchantWallet?: string;
    currency?: DirectCheckoutCurrency;
    expectedLamports?: string | null;
    expectedUsdcBaseUnits?: string | null;
    subtotalUsd?: number;
    shippingUsd?: number;
    totalUsd?: number;
    pointsPreview?: number;
    error?: string;
}

interface DirectCheckoutConfirmResponse {
    success: boolean;
    status?: string;
    walletAddress?: string;
    pointsAwarded?: number;
    newBalance?: number;
    txSignature?: string;
    error?: string;
}

export default function CheckoutPage() {
    const {
        cartItems,
        cartTotal,
        removeFromCart,
        clearCart,
        clearDirectItems,
        directItems,
        amazonItems,
        directTotal,
        amazonTotal,
        hasDirectItems,
        hasAmazonItems,
        hasMixedCart,
    } = useCart();

    // Checkout mode for auto-routing (direct, amazon, or auto to detect)
    const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>('auto');
    const [step, setStep] = useState<'cart' | 'details' | 'payment'>('cart');
    const [checkoutData, setCheckoutData] = useState({
        name: "",
        email: "",
        address: ""
    });
    const [isInternational, setIsInternational] = useState(false);
    const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
    const [shippingCost, setShippingCost] = useState(0);
    const { connection } = useConnection();
    const { publicKey, sendTransaction, wallet, connect, connecting, connected } = useWallet();
    const { profile, updateProfile, hasShippingAddress } = useUserProfile();
    const { showToast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [saveShippingForLater, setSaveShippingForLater] = useState(false);
    const [isSavingShipping, setIsSavingShipping] = useState(false);
    const [shippingPreFilled, setShippingPreFilled] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

    // Success Modal State
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successSignature, setSuccessSignature] = useState("");
    const [successAmount, setSuccessAmount] = useState<number>(0);
    const [successCurrency, setSuccessCurrency] = useState<'USDC' | 'SOL'>('USDC');

    const [paymentMethod, setPaymentMethod] = useState<'USDC' | 'SOL' | 'PRIVATE'>('USDC');
    const [isPrivatePaymentActive, setIsPrivatePaymentActive] = useState(false);
    const [solPrice, setSolPrice] = useState<number | null>(null);
    const [isFetchingPrice, setIsFetchingPrice] = useState(false);
    const [networkValidated, setNetworkValidated] = useState(false);
    const [isValidatingNetwork, setIsValidatingNetwork] = useState(false);

    // Determine which items to show based on checkout mode
    const displayItems = checkoutMode === 'direct' ? directItems :
        checkoutMode === 'amazon' ? amazonItems :
            cartItems;
    const displayTotal = checkoutMode === 'direct' ? directTotal :
        checkoutMode === 'amazon' ? amazonTotal :
            cartTotal;

    useEffect(() => {
        if (wallet?.adapter) {
            wallet.adapter.on('error', (err) => {
                console.error("Wallet error:", err);
                setError(err.message);
                setIsErrorModalOpen(true);
            });
        }
    }, [wallet]);

    // Pre-fill shipping from saved profile (only once when profile loads)
    useEffect(() => {
        if (profile && hasShippingAddress && !shippingPreFilled) {
            const fullAddress = [
                profile.shippingAddress,
                profile.shippingCity,
                profile.shippingState,
                profile.shippingZip
            ].filter(Boolean).join(', ');

            setCheckoutData(prev => ({
                ...prev,
                name: profile.shippingName || prev.name,
                email: profile.email || prev.email,
                address: fullAddress || prev.address,
            }));
            setIsInternational(profile.isInternational || false);
            setShippingPreFilled(true);
        }
    }, [profile, hasShippingAddress, shippingPreFilled]);


    useEffect(() => {
        if (cartItems.length === 0 && step !== 'payment') {
            setStep('cart');
        }
    }, [cartItems, step]);

    // Auto-calculate shipping method based on display total and international flag
    useEffect(() => {
        if (displayTotal > 0) {
            const method = calculateShippingMethod(displayTotal, isInternational);
            setSelectedShippingMethod(method);
            setShippingCost(method.cost);
        }
    }, [displayTotal, isInternational]);

    // Validate network connection when wallet connects
    useEffect(() => {
        const validateNetwork = async () => {
            if (!publicKey || networkValidated) return;

            setIsValidatingNetwork(true);
            try {
                const result = await validateNetworkConnection(connection);
                if (!result.isValid) {
                    setError(result.errorMessage || 'Network validation failed');
                    setIsErrorModalOpen(true);
                    console.warn('Network validation failed:', result);
                } else {
                    setNetworkValidated(true);
                    console.log(`Network validated: ${result.appNetwork}`);
                }
            } catch (err) {
                console.error('Network validation error:', err);
            } finally {
                setIsValidatingNetwork(false);
            }
        };

        validateNetwork();
    }, [publicKey, connection, networkValidated]);

    // Fetch SOL price when SOL payment is selected (via server-side API to avoid CORS)
    useEffect(() => {
        const fetchSolPrice = async () => {
            if (paymentMethod === 'SOL' && !solPrice) {
                setIsFetchingPrice(true);
                try {
                    // Use our own API route to avoid CORS issues in production
                    const response = await fetch('/api/sol-price');
                    const data = await response.json();

                    if (data.success && data.price) {
                        setSolPrice(data.price);
                        console.log(`SOL price loaded: $${data.price} (source: ${data.source})`);
                    } else {
                        throw new Error(data.error || 'Failed to fetch price');
                    }
                } catch (err) {
                    console.error("Failed to fetch SOL price:", err);
                    setError("Unable to fetch SOL price. Please try again or use USDC.");
                    setIsErrorModalOpen(true);
                    setPaymentMethod('USDC');
                } finally {
                    setIsFetchingPrice(false);
                }
            }
        };
        fetchSolPrice();
    }, [paymentMethod, solPrice]);

    // Resume a pending direct checkout finalize step (mobile state loss recovery).
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!connected || !publicKey) return;
        if (isProcessing) return;

        const raw = window.localStorage.getItem('directCheckoutPending');
        if (!raw) return;

        try {
            const pending = JSON.parse(raw) as { orderId?: string; txSignature?: string };
            if (!pending?.orderId || !pending?.txSignature) return;

            (async () => {
                try {
                    setIsProcessing(true);
                    setStatusMessage('Finalizing previous order...');
                    const res = await fetch('/api/checkout/direct/confirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: pending.orderId, txSignature: pending.txSignature }),
                    });
                    const data = (await res.json()) as DirectCheckoutConfirmResponse;
                    if (!res.ok || !data.success) {
                        throw new Error(data.error || 'Failed to finalize previous order');
                    }
                    window.localStorage.removeItem('directCheckoutPending');
                    showToast(`Order finalized: +${data.pointsAwarded || 0} points`, 'success');
                } catch (err: any) {
                    console.warn('Pending order finalize failed:', err);
                } finally {
                    setIsProcessing(false);
                    setStatusMessage('');
                }
            })();
        } catch {
            // If the value is malformed, just clear it.
            window.localStorage.removeItem('directCheckoutPending');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, publicKey]);

    const handleProceedToDetails = () => {
        if (displayItems.length > 0) {
            setStep('details');
        }
    };

    const handleProceedToPayment = async () => {
        if (checkoutData.name && checkoutData.email && checkoutData.address) {
            // Save shipping for later if checkbox is checked and wallet is connected
            if (saveShippingForLater && connected && publicKey) {
                await handleSaveShipping();
            }
            setStep('payment');
        } else {
            alert("Please fill in all fields.");
        }
    };

    const handleSaveShipping = async () => {
        if (!connected || !publicKey) {
            showToast('Connect wallet to save shipping info', 'error');
            return;
        }

        setIsSavingShipping(true);
        try {
            // Parse address - simple split by comma
            const addressParts = checkoutData.address.split(',').map(s => s.trim());
            const shippingAddress = addressParts[0] || '';
            const shippingCity = addressParts[1] || '';
            const stateZip = addressParts.slice(2).join(' ').trim();
            const stateMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5})?/i);
            const shippingState = stateMatch ? stateMatch[1].toUpperCase() : '';
            const shippingZip = stateMatch ? (stateMatch[2] || '') : stateZip.replace(/[^0-9]/g, '').slice(0, 5);

            const success = await updateProfile({
                shippingName: checkoutData.name,
                shippingAddress,
                shippingCity,
                shippingState,
                shippingZip,
                isInternational,
                email: checkoutData.email,
            });

            if (success) {
                showToast('Shipping info saved to your profile', 'success');
            } else {
                showToast('Failed to save shipping info', 'error');
            }
        } catch {
            showToast('Failed to save shipping info', 'error');
        } finally {
            setIsSavingShipping(false);
        }
    };

    const finalTotal = displayTotal + shippingCost;

    // Check if we should show mixed cart blocker
    const shouldShowMixedBlocker = checkoutMode === 'auto' && hasMixedCart;

    // Auto-route to Amazon checkout when only Amazon items are in cart
    const shouldAutoRouteToAmazon = checkoutMode === 'auto' && hasAmazonItems && !hasDirectItems;

    // Calculate SOL amount based on USD price
    const solAmount = solPrice ? finalTotal / solPrice : 0;

    // Manual refresh SOL price (clears cache to trigger refetch)
    const refreshSolPrice = () => {
        setSolPrice(null);
    };

    const handlePayment = async () => {
        if (!publicKey) return;

        // CRITICAL: Capture cart data BEFORE payment to prevent mobile state loss
        // (Mobile browsers like Phantom on iOS lose React state when switching apps)
        const itemsSnapshot = displayItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            source: item.source
        }));
        const subtotalSnapshot = displayTotal;
        const totalSnapshot = finalTotal;
        const shippingMethodSnapshot = selectedShippingMethod;
        const shippingCostSnapshot = shippingCost;

        // Validate cart has items before proceeding
        if (itemsSnapshot.length === 0) {
            setError("Your cart appears to be empty. Please add items before checkout.");
            setIsErrorModalOpen(true);
            return;
        }

        setIsProcessing(true);
        setStatusMessage("Creating order...");

        try {
            // Create server-side order (canonical totals + stable memo) before switching to wallet UI.
            const createResp = await fetch('/api/checkout/direct/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: itemsSnapshot.map((it) => ({ id: it.id, quantity: it.quantity })),
                    customerName: checkoutData.name,
                    customerEmail: checkoutData.email,
                    shippingAddress: checkoutData.address,
                    isInternational,
                    shippingMethodId: selectedShippingMethod?.id || null,
                    currency: paymentMethod as DirectCheckoutCurrency,
                }),
            });

            const created = (await createResp.json()) as DirectCheckoutCreateResponse;
            if (!createResp.ok || !created.success || !created.orderId || !created.memo || !created.merchantWallet) {
                throw new Error(created.error || 'Failed to create order');
            }

            // Validate network before proceeding
            setStatusMessage("Validating network connection...");
            const networkValidation = await validateNetworkConnection(connection);
            if (!networkValidation.isValid) {
                setError(`Network Error: ${networkValidation.errorMessage}\n\n${networkValidation.userInstructions || ''}`);
                setIsErrorModalOpen(true);
                setIsProcessing(false);
                return;
            }

            setStatusMessage("Verifying wallet balance...");

            const merchantWallet = new PublicKey(created.merchantWallet);
            const transaction = new Transaction();

            // Minimum SOL required for transaction fees (0.005 SOL as buffer)
            const MIN_SOL_FOR_FEES = 0.005 * LAMPORTS_PER_SOL;

            // Get SOL balance (needed for both payment methods - fees always paid in SOL)
            const solBalance = await connection.getBalance(publicKey);

            if (paymentMethod === 'SOL') {
                // ============ SOL PAYMENT FLOW ============

                if (!created.expectedLamports) {
                    throw new Error('Order quote missing expectedLamports');
                }

                const solPaymentAmountLamports = Number(created.expectedLamports);
                const totalSolNeeded = solPaymentAmountLamports + MIN_SOL_FOR_FEES;

                // Check if user has enough SOL for payment + fees
                if (solBalance < totalSolNeeded) {
                    const solNeeded = (totalSolNeeded - solBalance) / LAMPORTS_PER_SOL;
                    const currentBalance = solBalance / LAMPORTS_PER_SOL;
                    setError(`Insufficient SOL balance. You have ${currentBalance.toFixed(4)} SOL but need ~${(totalSolNeeded / LAMPORTS_PER_SOL).toFixed(4)} SOL (${(solPaymentAmountLamports / LAMPORTS_PER_SOL).toFixed(4)} payment + ~0.005 fees). Please add ${solNeeded.toFixed(4)} more SOL.`);
                    setIsErrorModalOpen(true);
                    setIsProcessing(false);
                    return;
                }

                setStatusMessage("Requesting Signature...");

                // Get latest blockhash
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = publicKey;

                // Add Memo Instruction
                transaction.add(
                    createMemoInstruction(
                        created.memo,
                        [publicKey]
                    )
                );

                // Add SOL transfer instruction
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: merchantWallet,
                        lamports: solPaymentAmountLamports,
                    })
                );

                const signature = await sendTransaction(transaction, connection);
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem('directCheckoutPending', JSON.stringify({ orderId: created.orderId, txSignature: signature }));
                }
                await handleTransactionConfirmation(created.orderId, signature, blockhash, lastValidBlockHeight, 'SOL', solPaymentAmountLamports / LAMPORTS_PER_SOL, {
                    items: itemsSnapshot,
                    subtotal: subtotalSnapshot,
                    total: totalSnapshot,
                    shippingMethod: shippingMethodSnapshot,
                    shippingCost: shippingCostSnapshot
                });

            } else {
                // ============ USDC PAYMENT FLOW ============

                // Use network-specific USDC mint address from config
                const USDC_MINT = new PublicKey(PROTOCOL_CONFIG.usdcMint);
                if (!created.expectedUsdcBaseUnits) {
                    throw new Error('Order quote missing expectedUsdcBaseUnits');
                }
                const amountUSDC = BigInt(created.expectedUsdcBaseUnits);

                // Check SOL balance for transaction fees
                if (solBalance < MIN_SOL_FOR_FEES) {
                    const solNeeded = (MIN_SOL_FOR_FEES - solBalance) / LAMPORTS_PER_SOL;
                    setError(`Insufficient SOL for transaction fees. You need at least ${solNeeded.toFixed(4)} more SOL to cover network fees.`);
                    setIsErrorModalOpen(true);
                    setIsProcessing(false);
                    return;
                }

                // Get sender's USDC token account
                const senderTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);

                // Check if sender has a USDC token account
                const senderAccountInfo = await connection.getAccountInfo(senderTokenAccount);
                if (!senderAccountInfo) {
                    setError("You don't have a USDC token account. Please add USDC to your wallet first.");
                    setIsErrorModalOpen(true);
                    setIsProcessing(false);
                    return;
                }

                // Check USDC balance
                const tokenBalance = await connection.getTokenAccountBalance(senderTokenAccount);
                const userUsdcBalance = BigInt(tokenBalance.value.amount);

                if (userUsdcBalance < amountUSDC) {
                    const USDC_DECIMALS = 6;
                    const usdcNeeded = Number(amountUSDC - userUsdcBalance) / Math.pow(10, USDC_DECIMALS);
                    const currentBalance = Number(userUsdcBalance) / Math.pow(10, USDC_DECIMALS);
                    setError(`Insufficient USDC balance. You have ${currentBalance.toFixed(2)} USDC but need ${Number(created.totalUsd ?? finalTotal).toFixed(2)} USDC. Please add ${usdcNeeded.toFixed(2)} more USDC to your wallet.`);
                    setIsErrorModalOpen(true);
                    setIsProcessing(false);
                    return;
                }

                setStatusMessage("Requesting Signature...");

                // Get latest blockhash
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = publicKey;

                // Add Memo Instruction
                transaction.add(
                    createMemoInstruction(
                        created.memo,
                        [publicKey]
                    )
                );

                // Get receiver's USDC token account
                const receiverTokenAccount = await getAssociatedTokenAddress(USDC_MINT, merchantWallet);

                // Check if receiver's token account exists, if not create it
                const receiverAccountInfo = await connection.getAccountInfo(receiverTokenAccount);
                if (!receiverAccountInfo) {
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            publicKey,
                            receiverTokenAccount,
                            merchantWallet,
                            USDC_MINT
                        )
                    );
                }

                // Add USDC transfer instruction
                transaction.add(
                    createTransferInstruction(
                        senderTokenAccount,
                        receiverTokenAccount,
                        publicKey,
                        amountUSDC
                    )
                );

                const signature = await sendTransaction(transaction, connection);
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem('directCheckoutPending', JSON.stringify({ orderId: created.orderId, txSignature: signature }));
                }
                await handleTransactionConfirmation(created.orderId, signature, blockhash, lastValidBlockHeight, 'USDC', Number(created.totalUsd ?? finalTotal), {
                    items: itemsSnapshot,
                    subtotal: subtotalSnapshot,
                    total: totalSnapshot,
                    shippingMethod: shippingMethodSnapshot,
                    shippingCost: shippingCostSnapshot
                });
            }

        } catch (error: any) {
            console.error("Payment failed:", error);
            setError(error.message || "Payment failed");
            setIsErrorModalOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Shared transaction confirmation and post-payment logic
    const handleTransactionConfirmation = async (
        orderId: string,
        signature: string,
        blockhash: string,
        lastValidBlockHeight: number,
        currency: 'SOL' | 'USDC',
        amount: number,
        orderSnapshot: {
            items: typeof displayItems;
            subtotal: number;
            total: number;
            shippingMethod: ShippingMethod | null;
            shippingCost: number;
        }
    ) => {
        setStatusMessage("Confirming Transaction...");

        const statusMessages = [
            { delay: 3000, message: "Waiting for network confirmation..." },
            { delay: 6000, message: "Almost there, verifying on blockchain..." },
            { delay: 10000, message: "Still processing, please wait..." },
            { delay: 15000, message: "Taking longer than usual, hang tight..." },
        ];

        const statusTimeouts = statusMessages.map(({ delay, message }) =>
            setTimeout(() => setStatusMessage(message), delay)
        );

        try {
            await connection.confirmTransaction({
                blockhash,
                lastValidBlockHeight,
                signature
            }, 'confirmed');
        } catch (confirmError) {
            console.warn("Confirmation timed out, checking signature status...", confirmError);
            setStatusMessage("Verifying transaction status...");
            const status = await connection.getSignatureStatus(signature);
            if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
                console.log("Transaction actually succeeded despite timeout error");
            } else {
                throw confirmError;
            }
        } finally {
            statusTimeouts.forEach(timeout => clearTimeout(timeout));
        }

        setStatusMessage("Finalizing order...");
        const confirmResp = await fetch('/api/checkout/direct/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, txSignature: signature }),
        });

        const confirmData = (await confirmResp.json()) as DirectCheckoutConfirmResponse;
        if (!confirmResp.ok || !confirmData.success) {
            throw new Error(confirmData.error || 'Order finalization failed');
        }

        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('directCheckoutPending');
        }

        if (typeof confirmData.pointsAwarded === 'number') {
            showToast(`+${confirmData.pointsAwarded} points earned`, 'success');
        }

        // Store the success details BEFORE clearing the cart
        setSuccessSignature(signature);
        setSuccessAmount(amount);
        setSuccessCurrency(currency);
        setIsSuccessModalOpen(true);

        // Clear only the items that were just purchased
        if (checkoutMode === 'direct') {
            clearDirectItems();
            // If there are still Amazon items, reset to auto mode
            if (amazonItems.length > 0) {
                setCheckoutMode('auto');
            }
        } else {
            clearCart();
        }
    };

    if (cartItems.length === 0 && step !== 'payment') {
        return (
            <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24 min-h-screen flex flex-col items-center justify-center text-center">
                <h1 className="text-2xl font-light tracking-widest uppercase mb-4">Your Cart is Empty</h1>
                <p className="text-neutral-500 mb-8">Add some timeless assets to your collection.</p>
                <Link href="/shop-gold-backs" className="px-8 py-3 bg-neutral-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-colors">
                    Return to Shop
                </Link>

                {/* Temporary Success Modal for Testing */}
                <PaymentSuccessModal
                    isOpen={isSuccessModalOpen}
                    onClose={() => setIsSuccessModalOpen(false)}
                    signature={successSignature || "53dGCcqdi5SR5fnk4pyWmzZQei6KoANzq8miHVTAEcmWjDGujHFBR7ZrkgY9jsDj1pt6hqvzeD9nNo6mD5ivfezH"}
                    amount={123.45}
                    currency="USDC"
                />
            </main>
        );
    }

    // Show mixed cart blocker if user has items from both sources
    if (shouldShowMixedBlocker) {
        return (
            <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24 min-h-screen">
                <div className="max-w-4xl mx-auto relative">
                    <Link href="/" className="absolute top-0 left-0 text-xs text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Home
                    </Link>

                    <h1 className="text-3xl md:text-4xl font-light tracking-widest uppercase mb-12 text-center">Checkout</h1>

                    <MixedCartBlocker
                        onCheckoutDirect={() => setCheckoutMode('direct')}
                        onCheckoutAmazon={() => setCheckoutMode('amazon')}
                    />
                </div>
            </main>
        );
    }

    // If in Amazon mode OR auto-detected as Amazon-only cart, show Amazon checkout
    if (checkoutMode === 'amazon' || shouldAutoRouteToAmazon) {
        return (
            <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24 min-h-screen">
                <div className="max-w-4xl mx-auto relative">
                    <Link href="/" className="absolute top-0 left-0 text-xs text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Home
                    </Link>

                    <h1 className="text-3xl md:text-4xl font-light tracking-widest uppercase mb-12 text-center">
                        Amazon Checkout
                        <span className="block text-sm font-normal tracking-normal text-amber-600 mt-2">via SP3ND</span>
                    </h1>

                    <AmazonCheckout
                        onBack={() => setCheckoutMode('auto')}
                        onSuccess={(orderNumber) => {
                            console.log('SP3ND order placed:', orderNumber);
                        }}
                    />
                </div>
            </main>
        );
    }

    return (
        <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24 min-h-screen">
            <PaymentSuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                signature={successSignature || "53dGCcqdi5SR5fnk4pyWmzZQei6KoANzq8miHVTAEcmWjDGujHFBR7ZrkgY9jsDj1pt6hqvzeD9nNo6mD5ivfezH"}
                amount={successAmount}
                currency={successCurrency}
            />

            <div className="max-w-4xl mx-auto relative">
                <Link href="/" className="absolute top-0 left-0 text-xs text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Home
                </Link>

                <h1 className="text-3xl md:text-4xl font-light tracking-widest uppercase mb-12 text-center">Checkout</h1>

                {/* Progress Steps */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
                        {/* CART - clickable from details/payment steps */}
                        <button
                            onClick={() => step !== 'cart' && setStep('cart')}
                            disabled={step === 'cart'}
                            className={`transition-colors ${step === 'cart'
                                    ? 'text-neutral-900 cursor-default'
                                    : 'text-neutral-400 hover:text-neutral-900 hover:underline cursor-pointer'
                                }`}
                        >
                            1. CART
                        </button>
                        <span className="text-neutral-300">/</span>
                        {/* DETAILS - clickable from payment step */}
                        <button
                            onClick={() => step === 'payment' && setStep('details')}
                            disabled={step === 'details' || step === 'cart'}
                            className={`transition-colors ${step === 'details'
                                    ? 'text-neutral-900 cursor-default'
                                    : step === 'payment'
                                        ? 'text-neutral-400 hover:text-neutral-900 hover:underline cursor-pointer'
                                        : 'text-neutral-400 cursor-default opacity-50'
                                }`}
                        >
                            2. DETAILS
                        </button>
                        <span className="text-neutral-300">/</span>
                        {/* PAYMENT - current step only, no going back FROM payment */}
                        <span className={`${step === 'payment' ? 'text-neutral-900' : 'text-neutral-400 opacity-50'}`}>
                            3. PAYMENT
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Main Content Area */}
                    <div className="lg:col-span-2 space-y-8">
                        <AnimatePresence mode="wait">
                            {step === 'cart' && (
                                <motion.div
                                    key="cart"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-6"
                                >
                                    {/* Mode indicator when filtering items */}
                                    {checkoutMode === 'direct' && hasAmazonItems && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <div>
                                                    <p className="text-sm font-medium text-amber-800">Direct Checkout Mode</p>
                                                    <p className="text-xs text-amber-600">{amazonItems.length} Amazon item{amazonItems.length !== 1 ? 's' : ''} held (${amazonTotal.toFixed(2)})</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setCheckoutMode('auto')}
                                                className="text-xs text-amber-700 hover:text-amber-900 underline"
                                            >
                                                View All
                                            </button>
                                        </div>
                                    )}
                                    {displayItems.map((item) => (
                                        <div key={item.id} className="flex gap-6 p-4 border border-neutral-100 items-center">
                                            <div className="relative w-20 h-20 bg-neutral-50 flex-shrink-0">
                                                {item.image ? (
                                                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-neutral-200">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-grow">
                                                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900">{item.name}</h3>
                                                <p className="text-xs text-neutral-500">{item.price}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm font-medium">x{item.quantity}</span>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="text-neutral-300 hover:text-red-500 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {step === 'details' && (
                                <motion.div
                                    key="details"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-6"
                                >
                                    {/* Pre-filled indicator */}
                                    {shippingPreFilled && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-sm text-green-700">
                                                Pre-filled from your saved profile
                                            </span>
                                            <Link href="/settings" className="ml-auto text-xs text-green-600 hover:text-green-800 underline">
                                                Edit in Settings
                                            </Link>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Full Name</label>
                                        <input
                                            type="text"
                                            value={checkoutData.name}
                                            onChange={(e) => setCheckoutData({ ...checkoutData, name: e.target.value })}
                                            className="w-full border-b border-neutral-200 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Email Address</label>
                                        <input
                                            type="email"
                                            value={checkoutData.email}
                                            onChange={(e) => setCheckoutData({ ...checkoutData, email: e.target.value })}
                                            className="w-full border-b border-neutral-200 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Shipping Address</label>
                                        <textarea
                                            value={checkoutData.address}
                                            onChange={(e) => setCheckoutData({ ...checkoutData, address: e.target.value })}
                                            rows={3}
                                            className="w-full border-b border-neutral-200 py-2 text-sm leading-relaxed focus:outline-none focus:border-neutral-900 transition-colors bg-transparent placeholder-neutral-200 resize-none"
                                            placeholder="123 Gold St, New York, NY 10001"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 pt-4">
                                        <input
                                            type="checkbox"
                                            id="international"
                                            checked={isInternational}
                                            onChange={(e) => setIsInternational(e.target.checked)}
                                            className="w-4 h-4 border-neutral-300 rounded focus:ring-neutral-900"
                                        />
                                        <label htmlFor="international" className="text-sm text-neutral-700 cursor-pointer">
                                            International Shipping
                                        </label>
                                    </div>

                                    {/* Save shipping for later (only show if wallet connected and not already pre-filled) */}
                                    {connected && !shippingPreFilled && (
                                        <div className="flex items-center gap-3 pt-2 pb-2 border-t border-neutral-100">
                                            <input
                                                type="checkbox"
                                                id="saveShipping"
                                                checked={saveShippingForLater}
                                                onChange={(e) => setSaveShippingForLater(e.target.checked)}
                                                className="w-4 h-4 border-neutral-300 rounded focus:ring-neutral-900"
                                            />
                                            <label htmlFor="saveShipping" className="text-sm text-neutral-700 cursor-pointer flex items-center gap-2">
                                                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                                </svg>
                                                Save shipping info for future orders
                                            </label>
                                        </div>
                                    )}

                                    {/* Prompt to connect wallet to save */}
                                    {!connected && (
                                        <div className="flex items-center gap-2 pt-2 pb-2 border-t border-neutral-100 text-sm text-neutral-500">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Connect wallet to save shipping info for future orders
                                        </div>
                                    )}

                                    {selectedShippingMethod && (
                                        <div className="mt-6 p-4 bg-neutral-50 border border-neutral-200">
                                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">Shipping Method</h4>
                                            <div className="space-y-2">
                                                {getAvailableShippingMethods(cartTotal, isInternational).map((method) => (
                                                    <label
                                                        key={method.id}
                                                        className="flex items-start gap-3 cursor-pointer group"
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="shipping"
                                                            checked={selectedShippingMethod.id === method.id}
                                                            onChange={() => {
                                                                setSelectedShippingMethod(method);
                                                                setShippingCost(method.cost);
                                                            }}
                                                            className="mt-1 w-4 h-4 border-neutral-300 focus:ring-neutral-900"
                                                        />
                                                        <div className="flex-grow">
                                                            <div className="flex justify-between items-baseline">
                                                                <span className="text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
                                                                    {method.name}
                                                                </span>
                                                                <span className="text-sm font-bold">${method.cost.toFixed(2)}</span>
                                                            </div>
                                                            <div className="text-xs text-neutral-500 mt-1">
                                                                Insurance: ${method.insurance.toLocaleString()}
                                                                {method.requiresSignature && " • Signature Required"}
                                                            </div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {step === 'payment' && (
                                <motion.div
                                    key="payment"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex flex-col items-center text-center"
                                >
                                    <h2 className="text-xl font-light tracking-widest uppercase mb-2">Complete Payment</h2>
                                    <p className="text-neutral-500 text-sm mb-6">Total: ${finalTotal.toFixed(2)}</p>

                                    {/* Payment Method Selector */}
                                    <div className="w-full max-w-sm mb-8">
                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">Payment Method</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('USDC')}
                                                className={`p-4 border-2 transition-all cursor-pointer ${paymentMethod === 'USDC'
                                                    ? 'border-neutral-900 bg-neutral-900 text-white'
                                                    : 'border-neutral-200 hover:border-neutral-400'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <svg className="w-6 h-6" viewBox="0 0 32 32">
                                                        {/* Background circle - blue when unselected, faint white when selected */}
                                                        <circle cx="16" cy="16" r="16" fill={paymentMethod === 'USDC' ? 'rgba(255,255,255,0.2)' : '#2775CA'} />
                                                        {/* Dollar sign - white in both states for visibility */}
                                                        <path d="M17.5 14.5v-1h-1v-1.5h-1v1.5h-1v1h1v4h-1v1h1v1.5h1v-1.5h1v-1h-1v-4h1z" fill={paymentMethod === 'USDC' ? '#fff' : '#fff'} />
                                                        {/* Inner circle border */}
                                                        <circle cx="16" cy="16" r="11" fill="none" stroke={paymentMethod === 'USDC' ? '#fff' : '#fff'} strokeWidth="1.5" />
                                                    </svg>
                                                    <span className="text-xs font-bold uppercase tracking-wider">USDC</span>
                                                    <span className="text-[10px] text-neutral-400">${finalTotal.toFixed(2)}</span>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('SOL')}
                                                className={`p-4 border-2 transition-all cursor-pointer ${paymentMethod === 'SOL'
                                                    ? 'border-neutral-900 bg-neutral-900 text-white'
                                                    : 'border-neutral-200 hover:border-neutral-400'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <svg className="w-6 h-6" viewBox="0 0 128 128">
                                                        <defs>
                                                            <linearGradient id="solGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                                <stop offset="0%" stopColor={paymentMethod === 'SOL' ? '#fff' : '#00FFA3'} />
                                                                <stop offset="100%" stopColor={paymentMethod === 'SOL' ? '#ccc' : '#DC1FFF'} />
                                                            </linearGradient>
                                                        </defs>
                                                        <path fill="url(#solGradient)" d="M93.94 42.63H25.23a3.2 3.2 0 01-2.26-5.46l13.42-13.42a4.48 4.48 0 013.17-1.31h68.71a3.2 3.2 0 012.26 5.46L97.11 41.32a4.48 4.48 0 01-3.17 1.31zM25.23 85.37h68.71a3.2 3.2 0 012.26 5.46L82.78 104.25a4.48 4.48 0 01-3.17 1.31H10.9a3.2 3.2 0 01-2.26-5.46l13.42-13.42a4.48 4.48 0 013.17-1.31zM93.94 54.56H25.23a3.2 3.2 0 00-2.26 5.46l13.42 13.42a4.48 4.48 0 003.17 1.31h68.71a3.2 3.2 0 002.26-5.46L97.11 55.87a4.48 4.48 0 00-3.17-1.31z" />
                                                    </svg>
                                                    <span className="text-xs font-bold uppercase tracking-wider">SOL</span>
                                                    <span className="text-[10px] text-neutral-400">
                                                        {isFetchingPrice ? (
                                                            <span className="flex items-center gap-1">
                                                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                </svg>
                                                                Loading...
                                                            </span>
                                                        ) : solPrice ? (
                                                            `~${solAmount.toFixed(4)} SOL`
                                                        ) : (
                                                            'Click to load price'
                                                        )}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>

                                        {/* Private Payment Option */}
                                        <div className="mt-4 pt-4 border-t border-neutral-200">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPaymentMethod('PRIVATE');
                                                    setIsPrivatePaymentActive(true);
                                                }}
                                                className={`w-full p-4 border-2 transition-all cursor-pointer ${paymentMethod === 'PRIVATE'
                                                    ? 'border-purple-600 bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                                                    : 'border-neutral-200 hover:border-purple-400'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-center gap-3">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                    <span className="text-xs font-bold uppercase tracking-wider">Private Payment</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${paymentMethod === 'PRIVATE' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>via Privacy Cash</span>
                                                </div>
                                                <p className={`text-[10px] mt-2 ${paymentMethod === 'PRIVATE' ? 'text-white/80' : 'text-neutral-500'}`}>
                                                    Breaks the on-chain link between your wallet and this purchase
                                                </p>
                                            </button>
                                            <p className="mt-2 text-[10px] text-neutral-400">
                                                Loyalty points are not awarded for private payments yet.
                                            </p>
                                        </div>

                                        {paymentMethod === 'SOL' && (
                                            <div className="flex items-center justify-center gap-2 mt-2">
                                                {isFetchingPrice ? (
                                                    <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Fetching SOL price...
                                                    </p>
                                                ) : solPrice ? (
                                                    <>
                                                        <p className="text-[10px] text-neutral-400">
                                                            Rate: 1 SOL = ${solPrice.toFixed(2)} USD
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={refreshSolPrice}
                                                            className="text-[10px] text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                                                        >
                                                            Refresh
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={refreshSolPrice}
                                                        className="text-[10px] text-amber-600 hover:text-amber-800 underline cursor-pointer"
                                                    >
                                                        Price unavailable - Click to retry
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>


                                    {/* Network Indicator */}
                                    <div className={`mb-4 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${PROTOCOL_CONFIG.isMainnet
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-amber-100 text-amber-800'
                                        }`}>
                                        <span className={`w-2 h-2 rounded-full ${PROTOCOL_CONFIG.isMainnet ? 'bg-green-500' : 'bg-amber-500'
                                            }`}></span>
                                        Solana {PROTOCOL_CONFIG.networkDisplay}
                                        {!PROTOCOL_CONFIG.isMainnet && (
                                            <span className="text-[10px] ml-1 opacity-75">(Test Mode)</span>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center gap-6 mb-8">
                                        {!publicKey ? (
                                            <div className="flex flex-col items-center gap-4">
                                                <p className="text-sm text-neutral-600">Connect your wallet to pay</p>
                                                <WalletMultiButton className="!bg-neutral-900 !rounded-xl" />
                                                {connecting && <p className="text-xs text-neutral-400">Connecting...</p>}
                                                {isValidatingNetwork && <p className="text-xs text-neutral-400">Validating network...</p>}
                                                {error && <p className="text-xs text-red-500 max-w-xs text-center">{error}</p>}
                                            </div>
                                        ) : paymentMethod === 'PRIVATE' && isPrivatePaymentActive ? (
                                            // Private Payment Flow
                                            <PrivatePaymentFlow
                                                amountUSD={finalTotal}
                                                solPrice={solPrice || 150} // Fallback if not loaded
                                                merchantWallet="CrQERYcZMnENP85qZBrdimS7oz2Ura9tAPxkZJPMpbNj"
                                                onSuccess={async (signature, amountSOL) => {
                                                    // Store success details
                                                    setSuccessSignature(signature);
                                                    setSuccessAmount(amountSOL);
                                                    setSuccessCurrency('SOL');
                                                    setIsSuccessModalOpen(true);
                                                    setIsPrivatePaymentActive(false);

                                                    // Decrement stock for purchased items
                                                    const itemsToDecrement = checkoutMode === 'direct' ? directItems : cartItems;
                                                    const stockResult = await decrementStock(
                                                        itemsToDecrement.map(item => ({ id: item.id, quantity: item.quantity }))
                                                    );
                                                    if (!stockResult.success) {
                                                        console.error("Stock decrement failed for private payment, but payment succeeded.");
                                                    }

                                                    // Prepare order data for webhook
                                                    const orderData = {
                                                        formType: "checkout",
                                                        transactionSignature: signature,
                                                        customerName: checkoutData.name,
                                                        customerEmail: checkoutData.email,
                                                        shippingAddress: checkoutData.address,
                                                        isInternational: isInternational,
                                                        shippingMethod: selectedShippingMethod?.name,
                                                        shippingCost: shippingCost,
                                                        items: itemsToDecrement,
                                                        subtotal: displayTotal,
                                                        totalAmount: finalTotal,
                                                        currency: 'SOL (Private)',
                                                        paymentAmount: amountSOL,
                                                        solPriceAtPurchase: solPrice,
                                                        timestamp: new Date().toISOString(),
                                                        walletAddress: publicKey?.toBase58(),
                                                        stockUpdateSuccess: stockResult.success,
                                                        checkoutMode: checkoutMode,
                                                        paymentType: 'private'
                                                    };

                                                    // Webhook with retry logic
                                                    const webhookUrl = "https://oncode.app.n8n.cloud/webhook/40f3a2d0-8390-44c8-a2af-b3add7651a9c";
                                                    let webhookSuccess = false;

                                                    for (let attempt = 1; attempt <= 3 && !webhookSuccess; attempt++) {
                                                        try {
                                                            console.log(`Private payment webhook attempt ${attempt}/3...`);
                                                            const response = await fetch(webhookUrl, {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify(orderData),
                                                            });

                                                            if (response.ok) {
                                                                webhookSuccess = true;
                                                                console.log("Private payment webhook notification sent successfully");
                                                            } else {
                                                                console.warn(`Webhook attempt ${attempt} returned status ${response.status}`);
                                                            }
                                                        } catch (webhookError) {
                                                            console.warn(`Webhook attempt ${attempt} failed:`, webhookError);
                                                            if (attempt < 3) {
                                                                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
                                                            }
                                                        }
                                                    }

                                                    if (!webhookSuccess) {
                                                        console.error("All webhook attempts failed for private payment - order notification not sent. Transaction signature:", signature);
                                                    }

                                                    // Clear cart after success
                                                    if (checkoutMode === 'direct') {
                                                        clearDirectItems();
                                                    } else {
                                                        clearCart();
                                                    }
                                                }}
                                                onCancel={() => {
                                                    setIsPrivatePaymentActive(false);
                                                    setPaymentMethod('USDC');
                                                }}
                                                onError={(errorMsg) => {
                                                    setError(errorMsg);
                                                    setIsErrorModalOpen(true);
                                                    setIsPrivatePaymentActive(false);
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-4">
                                                <p className="text-sm text-neutral-600">
                                                    Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                                                </p>
                                                <button
                                                    onClick={handlePayment}
                                                    disabled={isProcessing || paymentMethod === 'PRIVATE'}
                                                    className="px-8 py-3 cursor-pointer bg-neutral-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isProcessing
                                                        ? statusMessage
                                                        : paymentMethod === 'USDC'
                                                            ? `Pay ${finalTotal.toFixed(2)} USDC`
                                                            : paymentMethod === 'PRIVATE'
                                                                ? 'Click Private Payment above'
                                                                : solPrice
                                                                    ? `Pay ~${solAmount.toFixed(4)} SOL`
                                                                    : 'Pay SOL (quote)'
                                                    }
                                                </button>
                                                <div className="flex flex-col items-center gap-2 mt-3 pt-3 border-t border-neutral-100">
                                                    <span className="text-xs text-neutral-400">Need crypto?</span>
                                                    <div className="flex items-center gap-3">
                                                        <OnrampButton
                                                            walletAddress={publicKey.toBase58()}
                                                            variant="link"
                                                            mode="popup"
                                                        />
                                                        <span className="text-neutral-300">|</span>
                                                        <OnrampButton
                                                            walletAddress={publicKey.toBase58()}
                                                            variant="link"
                                                            mode="embed"
                                                            className="text-xs text-[#0052FF] hover:text-[#0040CC] underline cursor-pointer bg-transparent border-none disabled:opacity-50"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-neutral-300 text-center">
                                                        Popup opens new window • Embed stays in page
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>


                                    <button
                                        onClick={() => setStep('details')}
                                        className="text-xs cursor-pointer text-neutral-400 hover:text-neutral-900 underline"
                                    >
                                        Back to Details
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Order Summary Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-neutral-50 p-8 sticky top-32">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900 border-b border-neutral-200 pb-4 mb-6">Order Summary</h3>

                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-neutral-500">Subtotal</span>
                                    <span className="font-medium">${displayTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-neutral-500">Shipping</span>
                                    <div className="text-right">
                                        <div className="font-medium">${shippingCost.toFixed(2)}</div>
                                        {selectedShippingMethod && (
                                            <div className="text-xs text-neutral-400 mt-0.5">
                                                {selectedShippingMethod.name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-neutral-200 pt-4 flex justify-between text-base font-bold">
                                    <span>Total</span>
                                    <span>${finalTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {step === 'cart' && (
                                <button
                                    onClick={handleProceedToDetails}
                                    className="w-full cursor-pointer py-4 bg-neutral-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-colors"
                                >
                                    Checkout
                                </button>
                            )}

                            {step === 'details' && (
                                <button
                                    onClick={handleProceedToPayment}
                                    className="w-full cursor-pointer py-4 bg-neutral-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-colors"
                                >
                                    Proceed to Payment
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <PaymentErrorModal
                isOpen={isErrorModalOpen}
                onClose={() => setIsErrorModalOpen(false)}
                error={error}
                walletAddress={publicKey?.toBase58()}
            />
        </main>
    );
}
