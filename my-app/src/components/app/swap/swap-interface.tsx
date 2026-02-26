'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  LAMPORTS_PER_SOL,
  Transaction
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { getExplorerUrl } from '@/lib/network-utils';
import { buildUsdcToSolSwapTx, getUsdcToSolQuote } from '@/lib/jupiter-swap';
import {
  WGB_MINT,
  createBuyWgbInstruction,
  getUserWgbTokenAccount,
  fetchSolReceiver,
  fetchWgbPriceLamports,
  maybeCreateInitUserProfileInstruction,
} from '@/lib/wgb-program';
import { TokenSelector, TokenInfo, POPULAR_TOKENS } from './token-selector';

// Dynamic import to avoid SSR hydration issues
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

// Goldback price in USD (fetched from DB via API)
const DEFAULT_WGB_PRICE_USD = 9.02;

// WGB Token info for the output
const WGB_TOKEN: TokenInfo = {
  address: PROTOCOL_CONFIG.wgbMint,
  symbol: 'WGB',
  name: 'GoldBack Token',
  decimals: 9,
  logoURI: '/AppAssets/shiny_gold_logo.PNG'
};

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SLIPPAGE_BPS = 100;
const MAX_QUOTE_AGE_MS = 20_000;
const SOL_FEE_RESERVE_LAMPORTS = BigInt(Math.floor(0.01 * LAMPORTS_PER_SOL));

type CompletedRail = 'SOL_DIRECT' | 'USDC_BRIDGED';

const isSameAddress = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

interface PricingHealthResponse {
  success: boolean;
  healthy?: boolean;
  effectiveHealthy?: boolean;
  bypassed?: boolean;
  bypassReason?: string | null;
  data?: {
    reasons?: string[];
    bypassed?: boolean;
    bypassReason?: string | null;
  };
}

export function SwapInterface() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  // Token selection state
  const [selectedPayToken, setSelectedPayToken] = useState<TokenInfo>(
    POPULAR_TOKENS.find((token) => token.symbol === 'USDC') ?? POPULAR_TOKENS[0]
  );
  const [payAmount, setPayAmount] = useState<string>('');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'review' | 'processing' | 'success'>('input');
  const [error, setError] = useState<string | null>(null);
  const [swapSignature, setSwapSignature] = useState<string | null>(null);
  const [buySignature, setBuySignature] = useState<string | null>(null);
  const [completedRail, setCompletedRail] = useState<CompletedRail | null>(null);
  const [processingPhase, setProcessingPhase] = useState<string | null>(null);
  const [usdcRouteReady, setUsdcRouteReady] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [wgbPriceUsd, setWgbPriceUsd] = useState<number>(DEFAULT_WGB_PRICE_USD);

  // Price verification state
  const [priceVerifiedAt, setPriceVerifiedAt] = useState<Date | null>(null);
  const [isPriceVerifying, setIsPriceVerifying] = useState(false);
  const [priceMinutesSinceUpdate, setPriceMinutesSinceUpdate] = useState<number | null>(null);
  const [isPriceFallback, setIsPriceFallback] = useState(false);
  const [isPricingHealthy, setIsPricingHealthy] = useState(false);
  const [pricingHealthLoading, setPricingHealthLoading] = useState(true);
  const [pricingHealthMessage, setPricingHealthMessage] = useState<string | null>(null);
  const [isPricingBypassed, setIsPricingBypassed] = useState(false);
  const [pricingBypassReason, setPricingBypassReason] = useState<string | null>(null);

  // Fetch WGB/Goldback price from database
  useEffect(() => {
    const fetchGoldbackRate = async () => {
      try {
        const res = await fetch('/api/goldback-rate');
        const data = await res.json();
        if (data.success && data.rate) {
          setWgbPriceUsd(data.rate);
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

  const checkPricingHealth = async (): Promise<{ healthy: boolean; message: string | null }> => {
    setPricingHealthLoading(true);
    try {
      const res = await fetch('/api/health/pricing', { cache: 'no-store' });
      let payload: PricingHealthResponse | null = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      const effectiveHealthy = Boolean(payload?.effectiveHealthy ?? payload?.healthy);
      const bypassed = Boolean(payload?.bypassed ?? payload?.data?.bypassed);
      const bypassReason = payload?.bypassReason ?? payload?.data?.bypassReason ?? null;
      const reasons = payload?.data?.reasons ?? [];
      const staleOnlyUnhealthy =
        !effectiveHealthy &&
        reasons.length > 0 &&
        reasons.every((reason) => reason === 'last_sync_stale_or_unknown');
      const healthyForSwap = effectiveHealthy || staleOnlyUnhealthy;

      setIsPricingHealthy(healthyForSwap);
      setIsPricingBypassed(bypassed);
      setPricingBypassReason(bypassReason);

      let message: string | null = null;
      if (!healthyForSwap) {
        const reason = payload?.data?.reasons?.[0];
        message =
          reason
            ? `Pricing unavailable (${reason}). Retry soon.`
            : 'Pricing unavailable, retry soon.';
        setPricingHealthMessage(message);
      } else {
        setPricingHealthMessage(null);
      }

      return { healthy: healthyForSwap, message };
    } catch {
      setIsPricingHealthy(false);
      setIsPricingBypassed(false);
      setPricingBypassReason(null);
      const message = 'Pricing unavailable, retry soon.';
      setPricingHealthMessage(message);
      return { healthy: false, message };
    } finally {
      setPricingHealthLoading(false);
    }
  };

  useEffect(() => {
    void checkPricingHealth();
    const interval = setInterval(() => {
      void checkPricingHealth();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Verify price before swap - fetches fresh data and validates availability
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

      // Update state with verified price (fallback or fresh DB price)
      setWgbPriceUsd(data.rate);
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
      if (isSameAddress(selectedPayToken.address, SOL_MINT_ADDRESS) && !solPrice) {
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
  }, [selectedPayToken.address, solPrice]);

  const clearExecutionState = () => {
    setSwapSignature(null);
    setBuySignature(null);
    setCompletedRail(null);
    setUsdcRouteReady(false);
    setProcessingPhase(null);
  };

  const getSelectedRail = (): CompletedRail | null => {
    if (isSameAddress(selectedPayToken.address, SOL_MINT_ADDRESS)) {
      return 'SOL_DIRECT';
    }
    if (isSameAddress(selectedPayToken.address, PROTOCOL_CONFIG.usdcMint)) {
      return 'USDC_BRIDGED';
    }
    return null;
  };

  const handleReviewStep = async () => {
    setError(null);
    const health = await checkPricingHealth();
    if (!health.healthy) {
      setError(health.message ?? 'Pricing unavailable, retry soon.');
      return;
    }
    setStep('review');
  };

  // Get USD value based on selected token
  const getUsdValue = (amount: number): number => {
    if (isSameAddress(selectedPayToken.address, SOL_MINT_ADDRESS) && solPrice) {
      return amount * solPrice;
    }
    if (isSameAddress(selectedPayToken.address, PROTOCOL_CONFIG.usdcMint)) {
      return amount;
    }
    return 0;
  };

  // Handle pay input changes
  const handlePayChange = (val: string) => {
    if (usdcRouteReady || swapSignature || buySignature || completedRail) {
      clearExecutionState();
    }
    setPayAmount(val);
    if (!val) {
      setReceiveAmount('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const usdValue = getUsdValue(num);
      if (usdValue > 0) {
        setReceiveAmount((usdValue / wgbPriceUsd).toFixed(4));
      }
    }
  };

  // Handle WGB output changes
  const handleReceiveChange = (val: string) => {
    if (usdcRouteReady || swapSignature || buySignature || completedRail) {
      clearExecutionState();
    }
    setReceiveAmount(val);
    if (!val) {
      setPayAmount('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const usdNeeded = num * wgbPriceUsd;
      if (isSameAddress(selectedPayToken.address, SOL_MINT_ADDRESS) && solPrice) {
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
          setReceiveAmount((usdValue / wgbPriceUsd).toFixed(4));
        }
      }
    }
  }, [selectedPayToken, solPrice, payAmount, wgbPriceUsd]);

  const handleSwap = async () => {
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }

    const selectedRail = getSelectedRail();
    if (!selectedRail) {
      setError('Selected payment token is not supported on this rail');
      return;
    }

    const payAmountNum = parseFloat(payAmount);
    if (isNaN(payAmountNum) || payAmountNum <= 0) {
      setError('Invalid payment amount');
      return;
    }

    if (selectedPayToken.balance !== undefined && payAmountNum > selectedPayToken.balance) {
      setError(`Insufficient ${selectedPayToken.symbol} balance`);
      return;
    }

    const wgbAmount = parseFloat(receiveAmount);
    if (isNaN(wgbAmount) || wgbAmount <= 0) {
      setError('Invalid amount');
      return;
    }

    // WGB has 0 decimals (1 token = 1 Goldback)
    const wgbAmountInt = Math.floor(wgbAmount);
    if (wgbAmountInt <= 0) {
      setError('Amount must be at least 1 WGB');
      return;
    }

    const health = await checkPricingHealth();
    if (!health.healthy) {
      setError(health.message ?? 'Pricing unavailable, retry soon.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('processing');
    setProcessingPhase(
      selectedRail === 'USDC_BRIDGED' && !usdcRouteReady
        ? 'Routing USDC -> SOL'
        : 'Executing WGB purchase'
    );

    let didSwapThisAttempt = false;
    let didBuyThisAttempt = false;
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
        fetchWgbPriceLamports(connection),
      ]);

      if (priceLamports === BigInt(0)) {
        setError('WGB price not set on protocol. Contact admin.');
        setIsLoading(false);
        setStep('review');
        return;
      }

      const requiredBuyLamports = BigInt(wgbAmountInt) * priceLamports;
      const requiredLamportsWithReserve = requiredBuyLamports + SOL_FEE_RESERVE_LAMPORTS;

      if (selectedRail === 'USDC_BRIDGED' && !usdcRouteReady) {
        setProcessingPhase('Routing USDC -> SOL');

        const usdcBaseUnits = BigInt(
          Math.floor(payAmountNum * 10 ** selectedPayToken.decimals)
        );
        if (usdcBaseUnits <= BigInt(0)) {
          throw new Error('USDC amount is too small');
        }

        const quoteResult = await getUsdcToSolQuote({
          inputMint: PROTOCOL_CONFIG.usdcMint,
          outputMint: SOL_MINT_ADDRESS,
          inputAmountBaseUnits: usdcBaseUnits,
          slippageBps: SLIPPAGE_BPS,
        });

        if (Date.now() - quoteResult.fetchedAtMs > MAX_QUOTE_AGE_MS) {
          throw new Error('Quote expired. Please retry the swap.');
        }

        const quoteOutLamports = BigInt(quoteResult.quote.outAmount);
        if (quoteOutLamports < requiredLamportsWithReserve) {
          throw new Error(
            'Insufficient USDC for this route after slippage/fees. Increase USDC input and retry.'
          );
        }

        const swapTx = await buildUsdcToSolSwapTx({
          quote: quoteResult.quote,
          userPublicKey: publicKey.toBase58(),
        });

        const usdcSwapSig = await sendTransaction(swapTx, connection);
        await connection.confirmTransaction(usdcSwapSig, 'confirmed');
        setSwapSignature(usdcSwapSig);
        setCompletedRail('USDC_BRIDGED');
        setUsdcRouteReady(true);
        didSwapThisAttempt = true;

        const solBalanceAfterSwap = await connection.getBalance(publicKey);
        if (BigInt(solBalanceAfterSwap) < requiredLamportsWithReserve) {
          throw new Error(
            'USDC swap completed but SOL is still below required buy amount + fee reserve.'
          );
        }
      }

      if (selectedRail === 'SOL_DIRECT' || usdcRouteReady) {
        const currentSolBalance = await connection.getBalance(publicKey);
        if (BigInt(currentSolBalance) < requiredLamportsWithReserve) {
          throw new Error('Insufficient SOL for buy amount + network fee reserve.');
        }
      }

      setProcessingPhase('Executing WGB purchase');

      const transaction = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const userWgbAccount = await getUserWgbTokenAccount(publicKey);
      const userWgbAccountInfo = await connection.getAccountInfo(userWgbAccount);

      if (!userWgbAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userWgbAccount,
            publicKey,
            WGB_MINT,
            TOKEN_2022_PROGRAM_ID
          )
        );
      }

      const initProfileIx = await maybeCreateInitUserProfileInstruction(connection, publicKey);
      if (initProfileIx) {
        transaction.add(initProfileIx);
      }

      const buyInstruction = createBuyWgbInstruction(
        publicKey,
        userWgbAccount,
        solReceiver,
        BigInt(wgbAmountInt)
      );
      transaction.add(buyInstruction);

      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error('Simulation failed:', simulation.value.err);
          console.error('Logs:', simulation.value.logs);
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
      } catch (simErr: any) {
        console.error('Simulation error:', simErr);
        throw simErr;
      }

      const wgbBuySig = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: wgbBuySig
      }, 'confirmed');

      setBuySignature(wgbBuySig);
      didBuyThisAttempt = true;
      setCompletedRail(selectedRail);
      if (selectedRail === 'SOL_DIRECT') {
        setSwapSignature(null);
      }
      setUsdcRouteReady(false);
      setProcessingPhase(null);
      setStep('success');
      window.dispatchEvent(new Event('wgb-balance-refresh'));

    } catch (err: any) {
      console.error('Swap failed:', err);
      console.error('Error details:', err.logs || err.message);

      if (didSwapThisAttempt && !didBuyThisAttempt) {
        setUsdcRouteReady(true);
        setError(
          'USDC swap completed, but WGB purchase failed. Retry to execute purchase without rerouting USDC.'
        );
      } else if (err.message?.includes('Quote unavailable')) {
        setError('Quote unavailable. Try again in a few seconds.');
      } else if (err.message?.includes('route')) {
        setError('No USDC -> SOL route is available on this network right now.');
      } else if (err.message?.includes('InsufficientFunds')) {
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
      setProcessingPhase(null);
    }
  };

  const reset = () => {
    setPayAmount('');
    setReceiveAmount('');
    setStep('input');
    setError(null);
    setIsPriceFallback(false);
    clearExecutionState();
  };

  // Progress bar configuration aligned to each swap step
  const PROGRESS_STEPS = [
    { key: 'input', label: 'Enter Amount' },
    { key: 'review', label: 'Review Details' },
    { key: 'processing', label: 'Processing' },
    { key: 'success', label: 'Complete' },
  ] as const;

  const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.key === step);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden max-w-[480px] w-full mx-auto rounded-[32px]">
        {/* Header */}
        <div className="flex flex-col mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-xl tracking-tight">Swap</h2>
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
              className="flex flex-col relative mb-4"
            >
              {/* Pay Input */}
              <div className="bg-black/60 p-5 rounded-t-[24px] rounded-b-[8px] flex flex-col justify-between min-h-[140px] mb-1 border border-transparent hover:border-white/5 transition-colors">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex-shrink-0">
                    <TokenSelector
                      selectedToken={selectedPayToken}
                      onSelectToken={(token) => {
                        clearExecutionState();
                        setError(null);
                        setSelectedPayToken(token);
                      }}
                      excludeToken={WGB_TOKEN.address}
                    />
                  </div>
                  <div className="text-right flex-grow">
                    <input
                      type="number"
                      placeholder="0"
                      value={payAmount}
                      onChange={(e) => handlePayChange(e.target.value)}
                      className="bg-transparent text-4xl font-medium text-white w-full text-right outline-none placeholder-gray-700 font-sans"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-end text-sm font-medium text-gray-500 mt-auto px-2">
                  <div>
                    {selectedPayToken.balance !== undefined ? `Balance: ${selectedPayToken.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : 'Balance: 0.00'}
                  </div>
                  <div className="text-gray-400">
                    Value: ${payAmount && !isNaN(parseFloat(payAmount)) ? getUsdValue(parseFloat(payAmount)).toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>

              {/* Overlapping Swap Button */}
              <div className="absolute left-1/2 top-[141px] -translate-x-1/2 -translate-y-1/2 z-10 flex justify-center">
                <button className="bg-[#c9a84c] hover:bg-[#e8d48b] transition-all p-2.5 border-[6px] border-[#0A0A0A] rounded-full text-black shadow-lg cursor-pointer hover:scale-105 active:scale-95">
                  <svg className="w-5 h-5 mx-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* Receive Input */}
              <div className="bg-black/60 p-5 rounded-t-[8px] rounded-b-[24px] flex flex-col justify-between min-h-[140px] mt-1 mb-6 border border-transparent hover:border-white/5 transition-colors">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex-shrink-0">
                    <div className="bg-white/5 hover:bg-white/10 pl-2 pr-5 py-2 flex items-center gap-3 transition-colors cursor-default border border-white/5 group rounded-full">
                      <img
                        src="/AppAssets/shiny_gold_logo.PNG"
                        alt="WGB Token"
                        className="w-8 h-8 shadow-lg shadow-[#c9a84c]/20 rounded-full"
                      />
                      <div className="text-left">
                        <span className="text-white font-bold block leading-none text-lg">WGB</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-grow">
                    <input
                      type="number"
                      placeholder="0"
                      value={receiveAmount}
                      onChange={(e) => handleReceiveChange(e.target.value)}
                      className="bg-transparent text-4xl font-medium text-white w-full text-right outline-none placeholder-gray-700 font-sans"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-end text-sm font-medium text-gray-500 mt-auto px-2">
                  <div>
                    Balance: 0.00
                  </div>
                  <div className="text-gray-400">
                    Value: ${receiveAmount && !isNaN(parseFloat(receiveAmount)) ? (parseFloat(receiveAmount) * wgbPriceUsd).toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>

              {/* Rate Info */}
              <div className="bg-black/60 p-4 text-sm space-y-2 rounded-[16px] mb-4 border border-transparent hover:border-white/5 transition-colors">
                <div className="flex justify-between text-gray-400 font-medium">
                  <span>Rate</span>
                  <span className="text-white">
                    {isSameAddress(selectedPayToken.address, SOL_MINT_ADDRESS) && solPrice
                      ? `1 WGB ≈ ${(wgbPriceUsd / solPrice).toFixed(6)} SOL`
                      : `1 WGB ≈ ${wgbPriceUsd} ${selectedPayToken.symbol}`
                    }
                  </span>
                </div>
                <div className="flex justify-between text-gray-400 font-medium">
                  <span>Network</span>
                  <span className={PROTOCOL_CONFIG.isMainnet ? 'text-green-400' : 'text-[#e8d48b]'}>
                    Solana {PROTOCOL_CONFIG.networkDisplay}
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/30 border border-red-800 p-3 text-red-400 text-sm rounded-[4.5px]">
                  {error}
                </div>
              )}

              {isSameAddress(selectedPayToken.address, PROTOCOL_CONFIG.usdcMint) && (
                <div className="bg-blue-900/20 border border-blue-800/60 p-3 text-blue-300 text-xs rounded-[4.5px]">
                  USDC rail executes in two steps: USDC -&gt; SOL routing, then on-chain WGB purchase.
                </div>
              )}

              {isPricingBypassed && (<>
                {/* <div className="bg-amber-900/30 border border-amber-700 p-3 text-amber-300 text-xs rounded-[4.5px]">
                  Local pricing bypass active. Do not use in production.
                  {pricingBypassReason ? ` (${pricingBypassReason})` : ''}
                </div> */}
              </>

              )}
              

              {/* Connect Wallet or Review Button */}
              {!connected ? (
                <div className="flex justify-center">
                  <WalletMultiButton className="!bg-[#c9a84c] !text-black !font-bold !py-4 !px-8" />
                </div>
              ) : (
                <button
                  disabled={
                    !payAmount ||
                    parseFloat(payAmount) <= 0 ||
                    pricingHealthLoading ||
                    !isPricingHealthy
                  }
                  onClick={handleReviewStep}
                  className="w-full bg-linear-to-r from-[#c9a84c] to-[#a48a3a] cursor-pointer text-black font-bold py-4 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_4px_16px_rgba(201,168,76,0.35)] rounded-full text-lg mt-2"
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

              <div className="bg-black/60 p-4 space-y-3 text-sm rounded-[16px] mb-4 border border-transparent hover:border-white/5 transition-colors">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-white">1 WGB = {wgbPriceUsd} USD</span>
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
                <div className="bg-amber-900/30 border border-amber-700 p-3 text-amber-400 text-sm flex items-center gap-2 rounded-[4.5px]">
                  <img src="/AppAssets/PNG Renders/discount_black.png" alt="Rate Warning" className="w-6 h-6 flex-shrink-0 object-contain drop-shadow-md" />
                  <span>Using default rate (${wgbPriceUsd.toFixed(2)}). Live pricing is currently unavailable.</span>
                </div>
              )}

              {/* Price staleness warning */}
              {!isPriceFallback && priceMinutesSinceUpdate !== null && priceMinutesSinceUpdate > 1440 && (
                <div className="bg-yellow-900/30 border border-yellow-800 p-3 text-yellow-400 text-sm flex items-center gap-2 rounded-[4.5px]">
                  <img src="/AppAssets/PNG Renders/calendar_black.png" alt="Staleness Warning" className="w-6 h-6 flex-shrink-0 object-contain drop-shadow-md" />
                  <span>Price data is {priceMinutesSinceUpdate} minutes old. Execution uses on-chain price.</span>
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-800 p-3 text-red-400 text-sm rounded-[4.5px]">
                  {error}
                </div>
              )}

              {!pricingHealthLoading && !isPricingHealthy && pricingHealthMessage && (
                <div className="bg-red-900/30 border border-red-800 p-3 text-red-400 text-sm rounded-[4.5px]">
                  {pricingHealthMessage}
                </div>
              )}

              {isPricingBypassed && (
                <>
                    {/* <div className="bg-amber-900/30 border border-amber-700 p-3 text-amber-300 text-xs rounded-[4.5px]">
                  Local pricing bypass active. Do not use in production.
                  {pricingBypassReason ? ` (${pricingBypassReason})` : ''}
                </div> */}
                </>
            
              )}

              {isSameAddress(selectedPayToken.address, PROTOCOL_CONFIG.usdcMint) && (
                <div className="bg-blue-900/20 border border-blue-800/60 p-3 text-blue-300 text-xs rounded-[4.5px]">
                  {usdcRouteReady
                    ? 'USDC routing already completed. Confirm now to execute only the WGB buy step.'
                    : 'Confirm will route USDC -> SOL first, then execute the WGB purchase.'}
                </div>
              )}

              {swapSignature && step === 'review' && (
                <a
                  href={getExplorerUrl(swapSignature, 'tx')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-[#e8d48b] hover:text-[#c9a84c] underline"
                >
                  View completed USDC -&gt; SOL route transaction -&gt;
                </a>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 bg-gray-800 text-white font-medium py-3 hover:bg-gray-700 transition-colors rounded-[4.5px]"
                >
                  Back
                </button>
                <button
                  onClick={handleSwap}
                  disabled={isLoading || isPriceVerifying || pricingHealthLoading || !isPricingHealthy}
                  className="flex-[2] cursor-pointer bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black font-bold py-3 hover:brightness-110 disabled:opacity-80 transition-all active:scale-95 shadow-[0_4px_16px_rgba(201,168,76,0.35)] relative rounded-[4.5px]"
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
                    isSameAddress(selectedPayToken.address, PROTOCOL_CONFIG.usdcMint)
                      ? usdcRouteReady
                        ? 'Execute Buy'
                        : 'Route + Buy'
                      : 'Confirm Swap'
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
                <div className="absolute inset-0 border-4 border-gray-800 rounded-[4.5px]" />
                <div className="absolute inset-0 border-4 border-transparent border-t-[#c9a84c] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src="/AppAssets/shiny_gold_logo.PNG"
                    alt="WGB"
                    className="w-10 h-10 rounded-full object-contain"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isPriceVerifying ? 'Verifying Price...' : (processingPhase || 'Processing Swap')}
                </h3>
                <p className="text-gray-400 text-sm">
                  {isPriceVerifying
                    ? 'Checking the latest WGB price for your protection'
                    : processingPhase === 'Routing USDC -> SOL'
                      ? 'Executing bridge route to SOL before the protocol buy'
                      : 'Confirming your transaction on Solana'}
                </p>
              </div>

              {/* Transaction details summary */}
              <div className="bg-gray-950/50 p-4 text-sm space-y-2 mx-4 rounded-[4.5px]">
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
              <div className="w-24 h-24 bg-[#c9a84c]/10 rounded-full flex items-center justify-center mx-auto mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#c9a84c]/10 animate-pulse rounded-full" />
                <img src="/AppAssets/shiny_gold_logo.PNG" alt="Success" className="w-16 h-16 object-contain relative z-10 drop-shadow-xl rounded-full" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Swap Complete!</h3>
              <p className="text-gray-400 mb-4">
                {Math.floor(parseFloat(receiveAmount))} WGB has been transferred to your wallet
              </p>
              <div className="space-y-2 mb-8">
                {swapSignature && (
                  <a
                    href={getExplorerUrl(swapSignature, 'tx')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e8d48b] hover:text-[#c9a84c] text-sm underline block"
                  >
                    View USDC -&gt; SOL Route Tx -&gt;
                  </a>
                )}
                {buySignature && (
                  <a
                    href={getExplorerUrl(buySignature, 'tx')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e8d48b] hover:text-[#c9a84c] text-sm underline block"
                  >
                    View WGB Purchase Tx →
                  </a>
                )}
                {completedRail === 'SOL_DIRECT' && buySignature && !swapSignature && (
                  <span className="text-xs text-gray-500 block">Rail: SOL direct</span>
                )}
                {completedRail === 'USDC_BRIDGED' && (
                  <span className="text-xs text-gray-500 block">Rail: USDC bridged via SOL</span>
                )}
              </div>
              <button
                onClick={reset}
                className="w-full bg-gray-800 text-white font-medium py-3 hover:bg-gray-700 transition-colors rounded-[4.5px]"
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
