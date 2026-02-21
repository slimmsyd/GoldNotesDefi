'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { getExplorerUrl } from '@/lib/network-utils';
import {
  W3B_MINT,
  createBuyW3bInstruction,
  getUserW3bTokenAccount,
  fetchSolReceiver,
  fetchW3bPriceLamports,
  maybeCreateInitUserProfileInstruction,
} from '@/lib/w3b-program';
import { TokenSelector, TokenInfo, POPULAR_TOKENS } from './token-selector';

// Dynamic import to avoid SSR hydration issues
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

// Goldback price in USD (fetched from DB via API)
const DEFAULT_W3B_PRICE_USD = 9.02;

// WGB Token info for the output
const WGB_TOKEN: TokenInfo = {
  address: PROTOCOL_CONFIG.w3bMint,
  symbol: 'WGB',
  name: 'GoldBack Token',
  decimals: 9,
  logoURI: '/AppAssets/BlackW3BCoin.jpg'
};

export function SwapInterface() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  // Token selection state
  const [selectedPayToken, setSelectedPayToken] = useState<TokenInfo>(POPULAR_TOKENS[1]); // Default to USDC
  const [payAmount, setPayAmount] = useState<string>('');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'review' | 'processing' | 'success'>('input');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [w3bPriceUsd, setW3bPriceUsd] = useState<number>(DEFAULT_W3B_PRICE_USD);

  // Price verification state
  const [priceVerifiedAt, setPriceVerifiedAt] = useState<Date | null>(null);
  const [isPriceVerifying, setIsPriceVerifying] = useState(false);
  const [priceMinutesSinceUpdate, setPriceMinutesSinceUpdate] = useState<number | null>(null);
  const [isPriceFallback, setIsPriceFallback] = useState(false);

  // Fetch W3B/Goldback price from database
  useEffect(() => {
    const fetchGoldbackRate = async () => {
      try {
        const res = await fetch('/api/goldback-rate');
        const data = await res.json();
        if (data.success && data.rate) {
          setW3bPriceUsd(data.rate);
          setPriceMinutesSinceUpdate(data.minutesSinceUpdate);
          setIsPriceFallback(data.source === 'fallback');
        }
      } catch (err) {
        console.error('Failed to fetch Goldback rate, using default');
        setIsPriceFallback(true);
      }
    };
    fetchGoldbackRate();
  }, []);

  // Verify price before swap - fetches fresh data and checks staleness
  const verifyPriceBeforeSwap = async (): Promise<{ verified: boolean; rate: number | null; error: string | null }> => {
    setIsPriceVerifying(true);
    try {
      const res = await fetch('/api/goldback-rate');
      const data = await res.json();

      if (!data.success || !data.rate) {
        return { verified: false, rate: null, error: 'Unable to verify current WGB price. Please try again.' };
      }

      const isFallback = data.source === 'fallback';
      setIsPriceFallback(isFallback);

      // If using a real DB price, enforce staleness check
      if (!isFallback && data.minutesSinceUpdate !== null) {
        if (data.minutesSinceUpdate > 60) {
          return {
            verified: false,
            rate: data.rate,
            error: `Price data is ${data.minutesSinceUpdate} minutes old. Swap blocked for safety. Please try again later.`
          };
        }
      }

      // Update state with verified price (fallback or fresh DB price)
      setW3bPriceUsd(data.rate);
      setPriceVerifiedAt(new Date());
      setPriceMinutesSinceUpdate(data.minutesSinceUpdate);

      return { verified: true, rate: data.rate, error: null };
    } catch (err) {
      console.error('Price verification failed:', err);
      return { verified: false, rate: null, error: 'Failed to verify price. Please check your connection.' };
    } finally {
      setIsPriceVerifying(false);
    }
  };

  // Fetch SOL price when needed
  useEffect(() => {
    const fetchSolPrice = async () => {
      if (selectedPayToken.symbol === 'SOL' && !solPrice) {
        try {
          const res = await fetch('/api/sol-price');
          const data = await res.json();
          if (data.success) {
            setSolPrice(data.price);
          }
        } catch (err) {
          console.error('Failed to fetch SOL price');
        }
      }
    };
    fetchSolPrice();
  }, [selectedPayToken.symbol, solPrice]);

  // Get USD value based on selected token
  const getUsdValue = (amount: number): number => {
    if (selectedPayToken.symbol === 'SOL' && solPrice) {
      return amount * solPrice;
    }
    if (['USDC', 'USDT'].includes(selectedPayToken.symbol)) {
      return amount;
    }
    return 0;
  };

  // Handle pay input changes
  const handlePayChange = (val: string) => {
    setPayAmount(val);
    if (!val) {
      setReceiveAmount('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const usdValue = getUsdValue(num);
      if (usdValue > 0) {
        setReceiveAmount((usdValue / w3bPriceUsd).toFixed(4));
      }
    }
  };

  // Handle W3B output changes
  const handleReceiveChange = (val: string) => {
    setReceiveAmount(val);
    if (!val) {
      setPayAmount('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const usdNeeded = num * w3bPriceUsd;
      if (selectedPayToken.symbol === 'SOL' && solPrice) {
        setPayAmount((usdNeeded / solPrice).toFixed(6));
      } else {
        setPayAmount(usdNeeded.toFixed(2));
      }
    }
  };

  // Recalculate when token changes
  useEffect(() => {
    if (payAmount) {
      const num = parseFloat(payAmount);
      if (!isNaN(num)) {
        const usdValue = getUsdValue(num);
        if (usdValue > 0) {
          setReceiveAmount((usdValue / w3bPriceUsd).toFixed(4));
        }
      }
    }
  }, [selectedPayToken, solPrice]);

  const handleSwap = async () => {
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }

    // Only SOL payments are supported for buy_w3b (uses on-chain price)
    if (selectedPayToken.symbol !== 'SOL') {
      setError('Only SOL payments are supported for now');
      return;
    }

    const w3bAmount = parseFloat(receiveAmount);
    if (isNaN(w3bAmount) || w3bAmount <= 0) {
      setError('Invalid amount');
      return;
    }

    // W3B has 0 decimals (1 token = 1 Goldback)
    const w3bAmountInt = Math.floor(w3bAmount);
    if (w3bAmountInt <= 0) {
      setError('Amount must be at least 1 WGB');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('processing');

    try {
      // CRITICAL: Verify price freshness before swap
      const priceCheck = await verifyPriceBeforeSwap();
      if (!priceCheck.verified) {
        setError(priceCheck.error || 'Price verification failed');
        setIsLoading(false);
        setStep('review');
        return;
      }
      // Fetch on-chain data
      const [solReceiver, priceLamports] = await Promise.all([
        fetchSolReceiver(connection),
        fetchW3bPriceLamports(connection),
      ]);

      if (priceLamports === BigInt(0)) {
        setError('WGB price not set on protocol. Contact admin.');
        setIsLoading(false);
        return;
      }

      const transaction = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // ============ W3B TOKEN ACCOUNT SETUP ============
      const userW3bAccount = await getUserW3bTokenAccount(publicKey);
      const userW3bAccountInfo = await connection.getAccountInfo(userW3bAccount);

      if (!userW3bAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userW3bAccount,
            publicKey,
            W3B_MINT,
            TOKEN_2022_PROGRAM_ID
          )
        );
      }

      // Initialize user profile for first-time wallets (needed for points profile account constraints)
      const initProfileIx = await maybeCreateInitUserProfileInstruction(connection, publicKey);
      if (initProfileIx) {
        transaction.add(initProfileIx);
      }

      // ============ BUY W3B INSTRUCTION ============
      // This atomically: transfers SOL from buyer to sol_receiver,
      // and transfers W3B from treasury to buyer
      const buyInstruction = createBuyW3bInstruction(
        publicKey,
        userW3bAccount,
        solReceiver,
        BigInt(w3bAmountInt)
      );
      transaction.add(buyInstruction);

      // Simulate transaction first to get better error messages
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error('Simulation failed:', simulation.value.err);
          console.error('Logs:', simulation.value.logs);
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log('Simulation succeeded:', simulation.value.logs);
      } catch (simErr: any) {
        console.error('Simulation error:', simErr);
        throw simErr;
      }

      // Send the transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
      }, 'confirmed');

      setTxSignature(signature);
      setStep('success');

    } catch (err: any) {
      console.error('Swap failed:', err);
      console.error('Error details:', err.logs || err.message);
      // Parse common errors
      if (err.message?.includes('InsufficientFunds')) {
        setError('Insufficient SOL balance');
      } else if (err.message?.includes('PriceNotSet')) {
        setError('WGB price not configured');
      } else if (err.message?.includes('ProtocolPaused')) {
        setError('Protocol is paused');
      } else {
        setError(err.message || 'Transaction failed');
      }
      setStep('review');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setPayAmount('');
    setReceiveAmount('');
    setStep('input');
    setTxSignature(null);
    setError(null);
    setIsPriceFallback(false);
  };

  // Progress bar configuration aligned to each swap step
  const PROGRESS_STEPS = [
    { key: 'input', label: 'Enter Amount' },
    { key: 'review', label: 'Review Details' },
    { key: 'processing', label: 'Processing' },
    { key: 'success', label: 'Complete' },
  ] as const;

  const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.key === step);
  const currentStepLabel = PROGRESS_STEPS[currentStepIndex]?.label ?? '';

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#111111] border border-gray-800/50 p-6 shadow-2xl relative overflow-hidden max-w-[480px] w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-xl tracking-tight">Swap</h2>
              <img src="/AppAssets/PNG Renders/calculator_black.png" alt="Swap Info" className="w-5 h-5 hover:scale-110 cursor-pointer object-contain transition-transform drop-shadow-md" />
            </div>
            <span className="text-gray-500 text-sm font-medium">{currentStepIndex + 1}/{PROGRESS_STEPS.length}</span>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 mb-6">
            {PROGRESS_STEPS.map((s, i) => {
              const isCompleted = i < currentStepIndex;
              const isActive = i === currentStepIndex;
              const isProcessingPulse = step === 'processing' && i === currentStepIndex;

              return (
                <div
                  key={s.key}
                  className={`h-1 w-full transition-all duration-500 ease-out ${isCompleted
                    ? 'bg-[#c9a84c]'
                    : isActive
                      ? isProcessingPulse
                        ? 'bg-[#c9a84c] animate-pulse'
                        : 'bg-[#c9a84c]'
                      : 'bg-gray-800'
                    }`}
                />
              );
            })}
          </div>

          <p className="text-gray-500 text-sm">
            {step === 'input' && 'Select a token and enter the amount to swap'}
            {step === 'review' && 'Review the details before confirming'}
            {step === 'processing' && 'Your transaction is being processed...'}
            {step === 'success' && 'Your swap has been completed successfully'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Pay Input */}
              {/* Pay Input */}
              <div className="space-y-2">
                <div className="text-gray-500 text-sm mb-1 ml-1">You send</div>
                <div className="bg-[#1A1A1A] p-4 border border-transparent hover:border-gray-700/50 transition-all group">
                  <div className="flex items-center justify-between gap-4">
                    {/* Token Selector - Left Side */}
                    <div className="flex-shrink-0">
                      <TokenSelector
                        selectedToken={selectedPayToken}
                        onSelectToken={setSelectedPayToken}
                        excludeToken={WGB_TOKEN.address}
                      />
                      <div className="text-gray-500 text-xs mt-1 ml-1">
                        {selectedPayToken.symbol === 'SOL' ? 'Solana' : selectedPayToken.name}
                      </div>
                    </div>

                    {/* Amount Input - Right Side */}
                    <div className="text-right flex-grow">
                      <input
                        type="number"
                        placeholder="0"
                        value={payAmount}
                        onChange={(e) => handlePayChange(e.target.value)}
                        className="bg-transparent text-4xl font-medium text-white w-full text-right outline-none placeholder-gray-700 font-sans"
                      />
                      {selectedPayToken.balance !== undefined && (
                        <div className="text-gray-600 text-xs mt-1 font-medium">
                          Balance: {selectedPayToken.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-gray-800 p-2 border-4 border-gray-900">
                  <img src="/AppAssets/PNG Renders/send_money_black.png" alt="Swap direction" className="w-5 h-5 object-contain drop-shadow-md" />
                </div>
              </div>

              {/* Receive Input */}
              {/* Receive Input */}
              <div className="space-y-2">
                <div className="flex justify-between ml-1">
                  <div className="text-gray-500 text-sm mb-1">You receive</div>
                  <div className="text-gray-600 text-xs mt-1">estimated</div>
                </div>

                <div className="bg-[#1A1A1A] p-4 border border-transparent hover:border-gray-700/50 transition-all">
                  <div className="flex items-center justify-between gap-4">
                    {/* Fixed WGB Token Display */}
                    <div className="flex-shrink-0">
                      <div className="bg-[#2A2A2A] hover:bg-[#333] pl-2 pr-4 py-1.5 flex items-center gap-3 transition-colors cursor-default border border-gray-800">
                        <img
                          src="/AppAssets/BlackW3BCoin.jpg"
                          alt="WGB Token"
                          className="w-8 h-8 shadow-lg shadow-[#c9a84c]/20 rounded-full"
                        />
                        <div className="text-left">
                          <span className="text-white font-bold block leading-none">WGB</span>
                        </div>
                      </div>
                      <div className="text-gray-500 text-xs mt-1 ml-1">
                        GoldBack
                      </div>
                    </div>

                    <div className="text-right flex-grow">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={receiveAmount}
                        onChange={(e) => handleReceiveChange(e.target.value)}
                        className="bg-transparent text-4xl font-medium text-white w-full text-right outline-none placeholder-gray-700 font-sans"
                      />
                      <div className="text-gray-600 text-xs mt-1 font-medium">
                        1 WGB ≈ ${w3bPriceUsd.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate Info */}
              <div className="bg-gray-950/50 p-3 text-xs space-y-2">
                <div className="flex justify-between text-gray-400">
                  <span>Rate</span>
                  <span className="text-white">
                    {selectedPayToken.symbol === 'SOL' && solPrice
                      ? `1 WGB ≈ ${(w3bPriceUsd / solPrice).toFixed(6)} SOL`
                      : `1 WGB ≈ ${w3bPriceUsd} ${selectedPayToken.symbol}`
                    }
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Network</span>
                  <span className={PROTOCOL_CONFIG.isMainnet ? 'text-green-400' : 'text-[#e8d48b]'}>
                    Solana {PROTOCOL_CONFIG.networkDisplay}
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/30 border border-red-800 p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Connect Wallet or Review Button */}
              {!connected ? (
                <div className="flex justify-center">
                  <WalletMultiButton className="!bg-[#c9a84c] !text-black !font-bold !py-4 !px-8" />
                </div>
              ) : (
                <button
                  disabled={!payAmount || parseFloat(payAmount) <= 0}
                  onClick={() => setStep('review')}
                  className="w-full bg-linear-to-r from-[#c9a84c] to-[#a48a3a] cursor-pointer text-black font-bold py-4 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_4px_16px_rgba(201,168,76,0.35)]"
                >
                  Review Swap
                </button>
              )}
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="text-gray-400 text-sm mb-1">Confirm Swap</div>
                <div className="text-3xl font-bold text-white mb-2">
                  {receiveAmount} WGB
                </div>
                <div className="text-[#c9a84c] text-sm">
                  Using {payAmount} {selectedPayToken.symbol}
                </div>
              </div>

              <div className="bg-gray-950 p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-white">1 WGB = {w3bPriceUsd} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Age</span>
                  <span className={`${isPriceFallback
                    ? 'text-amber-400'
                    : priceMinutesSinceUpdate !== null && priceMinutesSinceUpdate > 30
                      ? 'text-yellow-400'
                      : 'text-green-400'
                    }`}>
                    {isPriceFallback
                      ? 'Default rate'
                      : priceMinutesSinceUpdate !== null
                        ? priceMinutesSinceUpdate < 1
                          ? 'Updated just now'
                          : `${priceMinutesSinceUpdate} min ago`
                        : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Network Fee</span>
                  <span className="text-white">~0.00005 SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Connected Wallet</span>
                  <span className="text-white font-mono text-xs">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </span>
                </div>
              </div>

              {/* Fallback pricing warning */}
              {isPriceFallback && (
                <div className="bg-amber-900/30 border border-amber-700 p-3 text-amber-400 text-sm flex items-center gap-2">
                  <img src="/AppAssets/PNG Renders/discount_black.png" alt="Rate Warning" className="w-6 h-6 flex-shrink-0 object-contain drop-shadow-md" />
                  <span>Using default rate (${w3bPriceUsd.toFixed(2)}). Live pricing is currently unavailable.</span>
                </div>
              )}

              {/* Price staleness warning */}
              {!isPriceFallback && priceMinutesSinceUpdate !== null && priceMinutesSinceUpdate > 30 && (
                <div className="bg-yellow-900/30 border border-yellow-800 p-3 text-yellow-400 text-sm flex items-center gap-2">
                  <img src="/AppAssets/PNG Renders/calendar_black.png" alt="Staleness Warning" className="w-6 h-6 flex-shrink-0 object-contain drop-shadow-md" />
                  <span>Price data is {priceMinutesSinceUpdate} minutes old. Fresh verification will occur before swap.</span>
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-800 p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 bg-gray-800 text-white font-medium py-3 hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSwap}
                  disabled={isLoading || isPriceVerifying}
                  className="flex-[2] cursor-pointer bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black font-bold py-3 hover:brightness-110 disabled:opacity-80 transition-all active:scale-95 shadow-[0_4px_16px_rgba(201,168,76,0.35)] relative"
                >
                  {isLoading || isPriceVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isPriceVerifying ? 'Verifying Price...' : 'Swapping...'}
                    </span>
                  ) : (
                    'Confirm Swap'
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-12 space-y-6"
            >
              {/* Animated spinner */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-gray-800 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-[#c9a84c] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src="/AppAssets/BlackW3BCoin.jpg"
                    alt="WGB"
                    className="w-8 h-8 rounded-full"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isPriceVerifying ? 'Verifying Price...' : 'Processing Swap'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {isPriceVerifying
                    ? 'Checking the latest WGB price for your protection'
                    : 'Confirming your transaction on Solana'}
                </p>
              </div>

              {/* Transaction details summary */}
              <div className="bg-gray-950/50 p-4 text-sm space-y-2 mx-4">
                <div className="flex justify-between text-gray-400">
                  <span>Sending</span>
                  <span className="text-white">{payAmount} {selectedPayToken.symbol}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Receiving</span>
                  <span className="text-white">{receiveAmount} WGB</span>
                </div>
              </div>

              <p className="text-gray-600 text-xs">
                Please confirm in your wallet if prompted
              </p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-green-500/20 animate-pulse" />
                <img src="/AppAssets/PNG Renders/safe_open_coins_black.png" alt="Success" className="w-16 h-16 object-contain relative z-10 drop-shadow-xl" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Swap Complete!</h3>
              <p className="text-gray-400 mb-4">
                {Math.floor(parseFloat(receiveAmount))} WGB has been transferred to your wallet
              </p>
              {txSignature && (
                <a
                  href={getExplorerUrl(txSignature, 'tx')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e8d48b] hover:text-[#c9a84c] text-sm underline mb-8 block"
                >
                  View Transaction on Solscan →
                </a>
              )}
              <button
                onClick={reset}
                className="w-full bg-gray-800 text-white font-medium py-3 hover:bg-gray-700 transition-colors"
              >
                Start New Swap
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-center mt-6 text-xs text-gray-500">
        Powered by BlackWGB • {PROTOCOL_CONFIG.networkDisplay}
      </div>
    </div>
  );
}
