'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import { createMemoInstruction } from '@solana/spl-memo';
import Image from 'next/image';
import { motion } from 'framer-motion';

import { useCart, CartItem } from '@/context/CartContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/context/ToastContext';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { OnrampButton } from '@/components/coinbase/onramp-button';

// US States dropdown
const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

type CheckoutStep = 'review' | 'shipping' | 'payment' | 'success';

interface OrderDetails {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
}

interface PaymentDetails {
  recipientWallet: string;
  amount: number;
  currency: string;
  memo: string;
}

interface AmazonCheckoutProps {
  onBack?: () => void;
  onSuccess?: (orderNumber: string) => void;
}

export function AmazonCheckout({ onBack, onSuccess }: AmazonCheckoutProps) {
  const { amazonItems, amazonTotal, clearAmazonItems, removeFromCart } = useCart();
  const { profile } = useUserProfile();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { showToast } = useToast();

  const [step, setStep] = useState<CheckoutStep>('review');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [shippingName, setShippingName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');

  // Order state
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [cartBreakdown, setCartBreakdown] = useState<{
    subtotal: number;
    platformFee: number;
    shipping: number;
    tax: number;
    total: number;
  } | null>(null);

  // USDC balance state
  const [needsUsdc, setNeedsUsdc] = useState(false);
  const [usdcNeeded, setUsdcNeeded] = useState(0);

  // Pre-fill from profile
  useEffect(() => {
    if (profile) {
      setEmail(profile.email || '');
      setShippingName(profile.shippingName || '');
      setShippingAddress(profile.shippingAddress || '');
      setShippingCity(profile.shippingCity || '');
      setShippingState(profile.shippingState || '');
      setShippingZip(profile.shippingZip || '');
    }
  }, [profile]);

  const handleProceedToShipping = () => {
    setStep('shipping');
  };

  const handleCreateOrder = async () => {
    if (!publicKey) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    if (!email || !shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingZip) {
      showToast('Please fill in all shipping fields', 'error');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Creating SP3ND order...');

    try {
      const response = await fetch('/api/sp3nd/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: amazonItems.map(item => ({
            asin: item.asin,
            amazonUrl: item.amazonUrl,
            title: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          shippingAddress: {
            name: shippingName,
            address_line_1: shippingAddress,
            city: shippingCity,
            state: shippingState,
            postal_code: shippingZip,
            country: 'US',
          },
          email,
          walletAddress: publicKey.toBase58(),
          testMode: !PROTOCOL_CONFIG.isMainnet,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      setOrderDetails(data.order);
      setPaymentDetails(data.payment);
      setCartBreakdown(data.cart);
      setStep('payment');
      showToast('Order created! Please complete payment.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(message, 'error');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const handlePayment = async () => {
    if (!publicKey || !paymentDetails) return;

    setIsProcessing(true);
    setStatusMessage('Checking USDC balance...');
    setNeedsUsdc(false);

    try {
      const USDC_MINT = new PublicKey(PROTOCOL_CONFIG.usdcMint);
      const USDC_DECIMALS = 6;
      const amountUSDC = Math.floor(paymentDetails.amount * Math.pow(10, USDC_DECIMALS));
      const recipientWallet = new PublicKey(paymentDetails.recipientWallet);

      // Check SOL balance for fees
      const solBalance = await connection.getBalance(publicKey);
      const MIN_SOL_FOR_FEES = 0.005 * 1e9;

      if (solBalance < MIN_SOL_FOR_FEES) {
        throw new Error('Insufficient SOL for transaction fees. You need at least 0.005 SOL.');
      }

      // Get sender's USDC token account
      const senderTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);
      const senderAccountInfo = await connection.getAccountInfo(senderTokenAccount);

      let userUsdcBalance = 0;

      if (senderAccountInfo) {
        // Check USDC balance
        const tokenBalance = await connection.getTokenAccountBalance(senderTokenAccount);
        userUsdcBalance = Number(tokenBalance.value.amount);
      }

      // Check if user has enough USDC
      if (userUsdcBalance < amountUSDC) {
        const needed = (amountUSDC - userUsdcBalance) / Math.pow(10, USDC_DECIMALS);
        setNeedsUsdc(true);
        setUsdcNeeded(needed);
        setIsProcessing(false);
        setStatusMessage('');
        return;
      }

      setStatusMessage('Requesting signature...');

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Add memo instruction
      transaction.add(
        createMemoInstruction(paymentDetails.memo, [publicKey])
      );

      // Get receiver's USDC token account
      const receiverTokenAccount = await getAssociatedTokenAddress(USDC_MINT, recipientWallet);
      const receiverAccountInfo = await connection.getAccountInfo(receiverTokenAccount);

      if (!receiverAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            receiverTokenAccount,
            recipientWallet,
            USDC_MINT
          )
        );
      }

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          senderTokenAccount,
          receiverTokenAccount,
          publicKey,
          amountUSDC
        )
      );

      const signature = await sendTransaction(transaction, connection);

      setStatusMessage('Confirming transaction...');

      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      }, 'confirmed');

      // Success!
      setStep('success');
      clearAmazonItems();

      if (onSuccess && orderDetails) {
        onSuccess(orderDetails.orderNumber);
      }

      showToast('Payment successful!', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      showToast(message, 'error');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  // Empty cart check
  if (amazonItems.length === 0 && step !== 'success') {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">No Amazon items in cart</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 text-sm text-amber-600 hover:text-amber-700 underline cursor-pointer">
            Go back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          {/* REVIEW - clickable from shipping/payment steps */}
          <button
            onClick={() => step !== 'success' && step !== 'review' && setStep('review')}
            disabled={step === 'success' || step === 'review'}
            className={`transition-colors ${step === 'review'
                ? 'text-amber-600 cursor-default'
                : step === 'success'
                  ? 'text-neutral-400 cursor-default'
                  : 'text-neutral-400 hover:text-amber-500 hover:underline cursor-pointer'
              }`}
          >
            REVIEW
          </button>
          <span className="text-neutral-300">/</span>
          {/* SHIPPING - clickable from payment step */}
          <button
            onClick={() => step === 'payment' && setStep('shipping')}
            disabled={step === 'success' || step === 'shipping' || step === 'review'}
            className={`transition-colors ${step === 'shipping'
                ? 'text-amber-600 cursor-default'
                : step === 'payment'
                  ? 'text-neutral-400 hover:text-amber-500 hover:underline cursor-pointer'
                  : 'text-neutral-400 cursor-default opacity-50'
              }`}
          >
            SHIPPING
          </button>
          <span className="text-neutral-300">/</span>
          {/* PAYMENT - not clickable backwards (can only go forward to it) */}
          <button
            onClick={() => step !== 'success' && orderDetails && setStep('payment')}
            disabled={step === 'success' || step === 'payment' || !orderDetails}
            className={`transition-colors ${step === 'payment'
                ? 'text-amber-600 cursor-default'
                : orderDetails && step !== 'success'
                  ? 'text-neutral-400 hover:text-amber-500 hover:underline cursor-pointer'
                  : 'text-neutral-400 cursor-default opacity-50'
              }`}
          >
            PAYMENT
          </button>
          <span className="text-neutral-300">/</span>
          <span className={step === 'success' ? 'text-amber-600' : 'text-neutral-400'}>DONE</span>
        </div>
      </div>

      {/* Step: Review */}
      {step === 'review' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Amazon via SP3ND</p>
              <p className="text-xs text-amber-600">These items ship directly from Amazon</p>
            </div>
          </div>

          <div className="space-y-4">
            {amazonItems.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 border border-neutral-100 rounded-lg">
                <div className="w-16 h-16 bg-neutral-50 rounded relative flex-shrink-0">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill className="object-contain p-1" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-neutral-300">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-grow">
                  <h3 className="text-sm font-medium line-clamp-2">{item.name}</h3>
                  <p className="text-xs text-neutral-500 mt-1">Qty: {item.quantity}</p>
                  <button
                    onClick={() => {
                      removeFromCart(item.id);
                      showToast('Item removed', 'success');
                    }}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-medium">{item.price}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-200 pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-500">Subtotal</span>
              <span className="font-medium">${amazonTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-neutral-400">
              SP3ND platform fee, shipping, and tax will be calculated at checkout
            </p>
          </div>

          <button
            onClick={handleProceedToShipping}
            className="w-full py-3 cursor-pointer bg-amber-500 text-white text-sm font-bold uppercase tracking-wider rounded hover:bg-amber-600 transition-colors"
          >
            Continue to Shipping
          </button>

          <div className="flex items-center justify-center gap-4">
            {onBack && (
              <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-700 cursor-pointer">
                Back to cart overview
              </button>
            )}
            {onBack && <span className="text-neutral-300">|</span>}
            <button
              onClick={() => {
                clearAmazonItems();
                showToast('Cart cleared', 'success');
              }}
              className="text-sm text-red-500 hover:text-red-700 cursor-pointer"
            >
              Clear Cart
            </button>
          </div>
        </motion.div>
      )}

      {/* Step: Shipping */}
      {step === 'shipping' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Full Name</label>
              <input
                type="text"
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Address</label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="123 Main St"
                className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">City</label>
                <input
                  type="text"
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="Austin"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">State</label>
                <select
                  value={shippingState}
                  onChange={(e) => setShippingState(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400 bg-white"
                >
                  {US_STATES.map(state => (
                    <option key={state.value} value={state.value}>{state.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">ZIP</label>
                <input
                  type="text"
                  value={shippingZip}
                  onChange={(e) => setShippingZip(e.target.value)}
                  placeholder="78701"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {publicKey ? (
            <button
              onClick={handleCreateOrder}
              disabled={isProcessing}
              className="w-full cursor-pointer py-3 bg-amber-500 text-white text-sm font-bold uppercase tracking-wider rounded hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {isProcessing ? statusMessage : 'Create Order'}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                disabled
                className="w-full py-3 bg-neutral-300 text-neutral-500 text-sm font-bold uppercase tracking-wider rounded cursor-not-allowed"
              >
                Create Order
              </button>
              <div className="flex flex-col items-center gap-2 p-4 border border-amber-200 rounded-lg bg-amber-50">
                <p className="text-sm text-amber-800 text-center">Connect your wallet to create an order</p>
                <WalletMultiButton className="!bg-amber-500 !rounded-lg !py-2 !px-4 !text-sm !font-bold !uppercase !tracking-wider" />
              </div>
            </div>
          )}

          <button onClick={() => setStep('review')} className="w-full text-center text-sm text-neutral-500 hover:text-neutral-700 cursor-pointer">
            Back to review
          </button>
        </motion.div>
      )}

      {/* Step: Payment */}
      {step === 'payment' && paymentDetails && cartBreakdown && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-green-800">Order Created: {orderDetails?.orderNumber}</span>
            </div>
            <p className="text-sm text-green-700">Please complete payment to finalize your order.</p>
          </div>

          <div className="border border-neutral-200 rounded-lg p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <span>${(cartBreakdown.subtotal ?? 0).toFixed(2)}</span>
              </div>
              {(cartBreakdown.platformFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">SP3ND Platform Fee</span>
                  <span>${(cartBreakdown.platformFee ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(cartBreakdown.shipping ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Shipping</span>
                  <span>${(cartBreakdown.shipping ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(cartBreakdown.tax ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Tax</span>
                  <span>${(cartBreakdown.tax ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>${(cartBreakdown.total ?? 0).toFixed(2)} USDC</span>
              </div>
            </div>
          </div>

          <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Payment Details</p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-neutral-500">Pay to: </span>
                <span className="font-mono text-xs">{paymentDetails.recipientWallet.slice(0, 8)}...{paymentDetails.recipientWallet.slice(-8)}</span>
              </div>
              <div>
                <span className="text-neutral-500">Memo: </span>
                <span className="font-medium">{paymentDetails.memo}</span>
              </div>
            </div>
          </div>

          {!publicKey ? (
            <div className="text-center">
              <p className="text-sm text-neutral-600 mb-4">Connect wallet to pay</p>
              <WalletMultiButton className="!bg-amber-500 !rounded-lg" />
            </div>
          ) : needsUsdc ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-medium text-red-800">Insufficient USDC Balance</p>
                    <p className="text-sm text-red-600 mt-1">
                      You need <strong>${usdcNeeded.toFixed(2)} more USDC</strong> to complete this purchase.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 mb-3">Get USDC to continue:</p>

                {/* Coinbase Onramp - Primary Option */}
                <div className="mb-4">
                  <OnrampButton
                    walletAddress={publicKey.toBase58()}
                    variant="button"
                  />
                  <p className="text-xs text-center text-blue-600 mt-2">
                    Instant purchase with card or bank
                  </p>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-blue-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-blue-50 text-blue-500">or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href="https://jup.ag/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Swap SOL for USDC on Jupiter
                  </a>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  Your wallet: <span className="font-mono">{publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}</span>
                </p>
              </div>

              <button
                onClick={handlePayment}
                className="w-full py-3 border border-amber-500 text-amber-600 text-sm font-bold uppercase tracking-wider rounded hover:bg-amber-50 transition-colors cursor-pointer"
              >
                Check Balance Again
              </button>
            </div>
          ) : (
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full py-4 bg-amber-500 text-white text-sm font-bold uppercase tracking-wider rounded hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? statusMessage : `Pay ${(cartBreakdown.total ?? 0).toFixed(2)} USDC`}
            </button>
          )}
        </motion.div>
      )}

      {/* Step: Success */}
      {step === 'success' && orderDetails && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-light tracking-widest uppercase mb-2">Order Placed!</h2>
            <p className="text-neutral-500">Order #{orderDetails.orderNumber}</p>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 text-left">
            <p className="text-sm text-neutral-600 mb-4">
              Your order has been submitted to SP3ND and will be fulfilled by Amazon.
              You will receive email updates at <strong>{email}</strong>.
            </p>
            <p className="text-xs text-neutral-400">
              Track your order status in the Orders page or check your email for shipping updates.
            </p>
          </div>

          <div className="flex gap-4 cursor-pointer">
            <a
              href="/orders"
              className="flex-1 py-3 cursor-pointer bg-amber-500 text-white text-sm font-bold uppercase tracking-wider rounded hover:bg-amber-600 transition-colors text-center"
            >
              View Orders
            </a>
            <a
              href="/shop-gold-backs"
              className="flex-1 cursor-pointer py-3 border border-neutral-300 text-neutral-700 text-sm font-bold uppercase tracking-wider rounded hover:bg-neutral-50 transition-colors text-center"
            >
              Continue Shopping
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
