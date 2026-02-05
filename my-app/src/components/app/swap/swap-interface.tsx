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
} from '@/lib/w3b-program';
import { TokenSelector, TokenInfo, POPULAR_TOKENS } from './token-selector';

// Dynamic import to avoid SSR hydration issues
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

// Goldback price in USD (fetched from DB via API)
const DEFAULT_W3B_PRICE_USD = 9.02;

// W3B Token info for the output
const W3B_TOKEN: TokenInfo = {
  address: PROTOCOL_CONFIG.w3bMint,
  symbol: 'W3B',
  name: 'GoldBack Token',
  decimals: 9,
  logoURI: undefined
};

export function SwapInterface() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  // Token selection state
  const [selectedPayToken, setSelectedPayToken] = useState<TokenInfo>(POPULAR_TOKENS[1]); // Default to USDC
  const [payAmount, setPayAmount] = useState<string>('');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'review' | 'success'>('input');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [w3bPriceUsd, setW3bPriceUsd] = useState<number>(DEFAULT_W3B_PRICE_USD);

  // Price verification state
  const [priceVerifiedAt, setPriceVerifiedAt] = useState<Date | null>(null);
  const [isPriceVerifying, setIsPriceVerifying] = useState(false);
  const [priceMinutesSinceUpdate, setPriceMinutesSinceUpdate] = useState<number | null>(null);

  // Fetch W3B/Goldback price from database
  useEffect(() => {
    const fetchGoldbackRate = async () => {
      try {
        const res = await fetch('/api/goldback-rate');
        const data = await res.json();
        if (data.success && data.rate) {
          setW3bPriceUsd(data.rate);
          setPriceMinutesSinceUpdate(data.minutesSinceUpdate);
        }
      } catch (err) {
        console.error('Failed to fetch Goldback rate, using default');
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
        return { verified: false, rate: null, error: 'Unable to verify current W3B price. Please try again.' };
      }

      const minutesSinceUpdate = data.minutesSinceUpdate ?? Infinity;

      // Block if price is more than 60 minutes stale
      if (minutesSinceUpdate > 60) {
        return {
          verified: false,
          rate: data.rate,
          error: `Price data is ${minutesSinceUpdate} minutes old. Swap blocked for safety. Please try again later.`
        };
      }

      // Update state with verified price
      setW3bPriceUsd(data.rate);
      setPriceVerifiedAt(new Date());
      setPriceMinutesSinceUpdate(minutesSinceUpdate);

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
      setError('Amount must be at least 1 W3B');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // CRITICAL: Verify price freshness before swap
      const priceCheck = await verifyPriceBeforeSwap();
      if (!priceCheck.verified) {
        setError(priceCheck.error || 'Price verification failed');
        setIsLoading(false);
        return;
      }
      // Fetch on-chain data
      const [solReceiver, priceLamports] = await Promise.all([
        fetchSolReceiver(connection),
        fetchW3bPriceLamports(connection),
      ]);

      if (priceLamports === BigInt(0)) {
        setError('W3B price not set on protocol. Contact admin.');
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
        setError('W3B price not configured');
      } else if (err.message?.includes('ProtocolPaused')) {
        setError('Protocol is paused');
      } else {
        setError(err.message || 'Transaction failed');
      }
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
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#111111] border border-gray-800/50 rounded-[32px] p-6 shadow-2xl relative overflow-hidden max-w-[480px] w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-xl tracking-tight">Swap</h2>
              <svg className="w-5 h-5 text-gray-500 hover:text-gray-400 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-gray-500 text-sm font-medium">1/4</span>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 mb-6">
            <div className="h-1 bg-blue-500 w-full rounded-full"></div>
            <div className="h-1 bg-gray-800 w-full rounded-full"></div>
            <div className="h-1 bg-gray-800 w-full rounded-full"></div>
            <div className="h-1 bg-gray-800 w-full rounded-full"></div>
          </div>

          <p className="text-gray-500 text-sm">Fees and rate shown before confirmation</p>
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
                <div className="bg-[#1A1A1A] rounded-[24px] p-4 border border-transparent hover:border-gray-700/50 transition-all group">
                  <div className="flex items-center justify-between gap-4">
                    {/* Token Selector - Left Side */}
                    <div className="flex-shrink-0">
                      <TokenSelector
                        selectedToken={selectedPayToken}
                        onSelectToken={setSelectedPayToken}
                        excludeToken={W3B_TOKEN.address}
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
                <div className="bg-gray-800 p-2 rounded-xl border-4 border-gray-900">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* Receive Input */}
              {/* Receive Input */}
              <div className="space-y-2">
                <div className="flex justify-between ml-1">
                  <div className="text-gray-500 text-sm mb-1">You receive</div>
                  <div className="text-gray-600 text-xs mt-1">estimated</div>
                </div>

                <div className="bg-[#1A1A1A] rounded-[24px] p-4 border border-transparent hover:border-gray-700/50 transition-all">
                  <div className="flex items-center justify-between gap-4">
                    {/* Fixed W3B Token Display */}
                    <div className="flex-shrink-0">
                      <div className="bg-[#2A2A2A] hover:bg-[#333] rounded-full pl-2 pr-4 py-1.5 flex items-center gap-3 transition-colors cursor-default border border-gray-800">
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs text-black font-bold shadow-lg shadow-amber-500/20">
                          G
                        </div>
                        <div className="text-left">
                          <span className="text-white font-bold block leading-none">W3B</span>
                          {/* <span className="text-[10px] text-gray-400 block leading-none mt-0.5">Goldback</span> */}
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
                        1 W3B ≈ ${w3bPriceUsd.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate Info */}
              <div className="bg-gray-950/50 rounded-xl p-3 text-xs space-y-2">
                <div className="flex justify-between text-gray-400">
                  <span>Rate</span>
                  <span className="text-white">
                    {selectedPayToken.symbol === 'SOL' && solPrice
                      ? `1 W3B ≈ ${(w3bPriceUsd / solPrice).toFixed(6)} SOL`
                      : `1 W3B ≈ ${w3bPriceUsd} ${selectedPayToken.symbol}`
                    }
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Network</span>
                  <span className={PROTOCOL_CONFIG.isMainnet ? 'text-green-400' : 'text-amber-400'}>
                    Solana {PROTOCOL_CONFIG.networkDisplay}
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Connect Wallet or Review Button */}
              {!connected ? (
                <div className="flex justify-center">
                  <WalletMultiButton className="!bg-amber-500 !text-black !font-bold !rounded-xl !py-4 !px-8" />
                </div>
              ) : (
                <button
                  disabled={!payAmount || parseFloat(payAmount) <= 0}
                  onClick={() => setStep('review')}
                  className="w-full bg-amber-500 cursor-pointer text-black font-bold py-4 rounded-xl hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20"
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
                  {receiveAmount} W3B
                </div>
                <div className="text-amber-500 text-sm">
                  Using {payAmount} {selectedPayToken.symbol}
                </div>
              </div>

              <div className="bg-gray-950 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-white">1 W3B = {w3bPriceUsd} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Age</span>
                  <span className={`${
                    priceMinutesSinceUpdate !== null && priceMinutesSinceUpdate > 30
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}>
                    {priceMinutesSinceUpdate !== null
                      ? priceMinutesSinceUpdate < 1
                        ? 'Updated just now'
                        : `${priceMinutesSinceUpdate} min ago`
                      : 'Verifying...'}
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

              {/* Price staleness warning */}
              {priceMinutesSinceUpdate !== null && priceMinutesSinceUpdate > 30 && (
                <div className="bg-yellow-900/30 border border-yellow-800 rounded-xl p-3 text-yellow-400 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Price data is {priceMinutesSinceUpdate} minutes old. Fresh verification will occur before swap.</span>
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 bg-gray-800 text-white font-medium py-3 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSwap}
                  disabled={isLoading || isPriceVerifying}
                  className="flex-[2] cursor-pointer bg-amber-500 text-black font-bold py-3 rounded-xl hover:bg-amber-400 disabled:opacity-80 transition-all shadow-lg shadow-amber-500/20 relative"
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

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Swap Complete!</h3>
              <p className="text-gray-400 mb-4">
                {Math.floor(parseFloat(receiveAmount))} W3B has been transferred to your wallet
              </p>
              {txSignature && (
                <a
                  href={getExplorerUrl(txSignature, 'tx')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 text-sm underline mb-8 block"
                >
                  View Transaction on Solscan →
                </a>
              )}
              <button
                onClick={reset}
                className="w-full bg-gray-800 text-white font-medium py-3 rounded-xl hover:bg-gray-700 transition-colors"
              >
                Start New Swap
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-center mt-6 text-xs text-gray-500">
        Powered by BlackW3B • {PROTOCOL_CONFIG.networkDisplay}
      </div>
    </div>
  );
}
