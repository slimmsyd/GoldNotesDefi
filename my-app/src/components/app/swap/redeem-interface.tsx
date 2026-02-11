'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { getExplorerUrl } from '@/lib/network-utils';
import {
  createBurnW3bInstruction,
  getUserW3bTokenAccount,
  fetchUserW3bBalance,
  generateRequestId,
} from '@/lib/w3b-program';
import {
  fetchUserRedemptions,
  getRedemptionStatusLabel,
  type RedemptionRecord,
} from '@/lib/supabase-protocol';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

const DEFAULT_W3B_PRICE_USD = 9.02;

type RedeemStep = 'input' | 'shipping' | 'confirm' | 'processing' | 'success';

interface ShippingInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export function RedeemInterface() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  // Redeem state
  const [redeemAmount, setRedeemAmount] = useState<string>('');
  const [step, setStep] = useState<RedeemStep>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [w3bBalance, setW3bBalance] = useState<bigint>(BigInt(0));
  const [w3bPriceUsd, setW3bPriceUsd] = useState<number>(DEFAULT_W3B_PRICE_USD);

  // Shipping info
  const [shipping, setShipping] = useState<ShippingInfo>({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });

  // Redemption history
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch W3B price
  useEffect(() => {
    fetch('/api/goldback-rate')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rate) setW3bPriceUsd(data.rate);
      })
      .catch(() => {});
  }, []);

  // Fetch W3B balance when wallet connects
  useEffect(() => {
    if (!publicKey || !connection) return;
    fetchUserW3bBalance(connection, publicKey)
      .then(setW3bBalance)
      .catch(() => setW3bBalance(BigInt(0)));
  }, [publicKey, connection]);

  // Fetch redemption history
  const loadRedemptions = useCallback(async () => {
    if (!publicKey) return;
    try {
      const records = await fetchUserRedemptions(publicKey.toBase58());
      setRedemptions(records);
    } catch {
      // Silently fail — table may not exist yet
    }
  }, [publicKey]);

  useEffect(() => {
    loadRedemptions();
  }, [loadRedemptions]);

  const handleShippingChange = (field: keyof ShippingInfo, value: string) => {
    setShipping(prev => ({ ...prev, [field]: value }));
  };

  const isShippingValid = shipping.name && shipping.address && shipping.city && shipping.state && shipping.zip;

  const handleRedeem = async () => {
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }

    const amount = parseInt(redeemAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (BigInt(amount) > w3bBalance) {
      setError('Insufficient WGB balance');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('processing');

    try {
      const userTokenAccount = await getUserW3bTokenAccount(publicKey);
      const requestId = generateRequestId();

      const transaction = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Build burn_w3b instruction
      const burnIx = createBurnW3bInstruction(
        publicKey,
        userTokenAccount,
        BigInt(amount),
        requestId
      );
      transaction.add(burnIx);

      // Simulate first
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error('Simulation failed:', simulation.value.err);
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      }, 'confirmed');

      setTxSignature(signature);

      // Store shipping details off-chain
      try {
        await fetch('/api/redemption/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_wallet: publicKey.toBase58(),
            request_id: Number(requestId),
            amount,
            burn_tx_hash: signature,
            ...shipping,
            shipping_name: shipping.name,
            shipping_address: shipping.address,
            shipping_city: shipping.city,
            shipping_state: shipping.state,
            shipping_zip: shipping.zip,
            shipping_country: shipping.country,
          }),
        });
      } catch (apiErr) {
        // Non-critical: on-chain burn already succeeded
        console.warn('Failed to store shipping details off-chain:', apiErr);
      }

      setStep('success');
      loadRedemptions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      console.error('Redeem failed:', err);
      if (message.includes('ProtocolPaused')) {
        setError('Protocol is paused');
      } else {
        setError(message);
      }
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setRedeemAmount('');
    setStep('input');
    setTxSignature(null);
    setError(null);
    setShipping({ name: '', address: '', city: '', state: '', zip: '', country: 'US' });
  };

  const PROGRESS_STEPS = [
    { key: 'input', label: 'Amount' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'confirm', label: 'Confirm' },
    { key: 'processing', label: 'Processing' },
    { key: 'success', label: 'Complete' },
  ] as const;

  const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.key === step);

  const usdValue = parseFloat(redeemAmount || '0') * w3bPriceUsd;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#111111] border border-gray-800/50 p-6 shadow-2xl relative overflow-hidden max-w-[480px] w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-xl tracking-tight">Redeem</h2>
              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 font-medium">IRREVERSIBLE</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
              >
                {showHistory ? 'Hide History' : 'History'}
              </button>
              <span className="text-gray-500 text-sm font-medium">
                {currentStepIndex + 1}/{PROGRESS_STEPS.length}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-1.5 mb-6">
            {PROGRESS_STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1 w-full transition-all duration-500 ease-out ${
                  i < currentStepIndex
                    ? 'bg-red-500'
                    : i === currentStepIndex
                      ? step === 'processing' ? 'bg-red-500 animate-pulse' : 'bg-red-500'
                      : 'bg-gray-800'
                }`}
              />
            ))}
          </div>

          <p className="text-gray-500 text-sm">
            {step === 'input' && 'Enter how many WGB to redeem for physical Goldbacks'}
            {step === 'shipping' && 'Enter your shipping address for physical delivery'}
            {step === 'confirm' && 'Review carefully — burning tokens is permanent'}
            {step === 'processing' && 'Your redemption is being processed...'}
            {step === 'success' && 'Your tokens have been burned and redemption created'}
          </p>
        </div>

        {/* Redemption History Panel */}
        {showHistory && (
          <div className="mb-6 bg-gray-950/50 border border-gray-800/50 p-4 max-h-60 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Redemption History</h3>
            {redemptions.length === 0 ? (
              <p className="text-gray-600 text-xs">No redemptions yet</p>
            ) : (
              <div className="space-y-2">
                {redemptions.map(r => (
                  <div key={r.id} className="flex justify-between items-center text-xs border-b border-gray-800/50 pb-2">
                    <div>
                      <span className="text-white font-medium">{r.amount} WGB</span>
                      <span className="text-gray-500 ml-2">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 font-medium ${
                      r.status === 3 ? 'bg-green-500/20 text-green-400' :
                      r.status === 4 ? 'bg-red-500/20 text-red-400' :
                      r.status === 1 ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {getRedemptionStatusLabel(r.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Enter amount */}
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <div className="flex justify-between ml-1">
                  <div className="text-gray-500 text-sm mb-1">You burn</div>
                  <div className="text-gray-600 text-xs">
                    Balance: {w3bBalance.toString()} WGB
                  </div>
                </div>
                <div className="bg-[#1A1A1A] p-4 border border-transparent hover:border-gray-700/50 transition-all">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-shrink-0">
                      <div className="bg-[#2A2A2A] pl-2 pr-4 py-1.5 flex items-center gap-3 border border-gray-800">
                        <img src="/logos/BlackWebTokenLogo.png" alt="WGB" className="w-8 h-8" />
                        <span className="text-white font-bold">WGB</span>
                      </div>
                    </div>
                    <div className="text-right flex-grow">
                      <input
                        type="number"
                        placeholder="0"
                        min="1"
                        step="1"
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(e.target.value)}
                        className="bg-transparent text-4xl font-medium text-white w-full text-right outline-none placeholder-gray-700 font-sans"
                      />
                      <div className="text-gray-600 text-xs mt-1">
                        ≈ ${usdValue.toFixed(2)} USD
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Max button */}
              {w3bBalance > BigInt(0) && (
                <button
                  onClick={() => setRedeemAmount(w3bBalance.toString())}
                  className="text-xs text-[#c9a84c] hover:text-[#e8d48b] transition-colors"
                >
                  Redeem Max ({w3bBalance.toString()} WGB)
                </button>
              )}

              {/* Info box */}
              <div className="bg-red-950/30 border border-red-900/50 p-3 text-xs text-red-300 space-y-1">
                <p className="font-medium">Physical Redemption</p>
                <p className="text-red-400/80">
                  Burning WGB tokens is irreversible. You will receive physical Goldback notes
                  shipped to your address. Each WGB = 1 Goldback note.
                </p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {!connected ? (
                <div className="flex justify-center">
                  <WalletMultiButton className="!bg-[#c9a84c] !text-black !font-bold !py-4 !px-8" />
                </div>
              ) : (
                <button
                  disabled={!redeemAmount || parseInt(redeemAmount) <= 0}
                  onClick={() => {
                    setError(null);
                    setStep('shipping');
                  }}
                  className="w-full bg-red-600 hover:bg-red-500 cursor-pointer text-white font-bold py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  Continue to Shipping
                </button>
              )}
            </motion.div>
          )}

          {/* Step 2: Shipping details */}
          {step === 'shipping' && (
            <motion.div
              key="shipping"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={shipping.name}
                  onChange={(e) => handleShippingChange('name', e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-gray-800 p-3 text-white placeholder-gray-600 text-sm outline-none focus:border-gray-600 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Street Address"
                  value={shipping.address}
                  onChange={(e) => handleShippingChange('address', e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-gray-800 p-3 text-white placeholder-gray-600 text-sm outline-none focus:border-gray-600 transition-colors"
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={shipping.city}
                    onChange={(e) => handleShippingChange('city', e.target.value)}
                    className="flex-1 bg-[#1A1A1A] border border-gray-800 p-3 text-white placeholder-gray-600 text-sm outline-none focus:border-gray-600 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={shipping.state}
                    onChange={(e) => handleShippingChange('state', e.target.value)}
                    className="w-20 bg-[#1A1A1A] border border-gray-800 p-3 text-white placeholder-gray-600 text-sm outline-none focus:border-gray-600 transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="ZIP Code"
                    value={shipping.zip}
                    onChange={(e) => handleShippingChange('zip', e.target.value)}
                    className="flex-1 bg-[#1A1A1A] border border-gray-800 p-3 text-white placeholder-gray-600 text-sm outline-none focus:border-gray-600 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Country"
                    value={shipping.country}
                    onChange={(e) => handleShippingChange('country', e.target.value)}
                    className="w-24 bg-[#1A1A1A] border border-gray-800 p-3 text-white placeholder-gray-600 text-sm outline-none focus:border-gray-600 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 bg-gray-800 text-white font-medium py-3 hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  disabled={!isShippingValid}
                  onClick={() => setStep('confirm')}
                  className="flex-[2] bg-red-600 hover:bg-red-500 cursor-pointer text-white font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  Review Redemption
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="text-red-400 text-sm mb-1 font-medium">Confirm Burn &amp; Redeem</div>
                <div className="text-3xl font-bold text-white mb-2">
                  {redeemAmount} WGB
                </div>
                <div className="text-gray-400 text-sm">
                  ≈ ${usdValue.toFixed(2)} in physical Goldbacks
                </div>
              </div>

              <div className="bg-gray-950 p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tokens Burned</span>
                  <span className="text-white">{redeemAmount} WGB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Physical Goldbacks</span>
                  <span className="text-white">{redeemAmount} notes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Points Earned</span>
                  <span className="text-[#c9a84c]">+{parseInt(redeemAmount || '0') * 2} pts (2x bonus)</span>
                </div>
                <div className="border-t border-gray-800 my-2" />
                <div className="flex justify-between">
                  <span className="text-gray-400">Ship To</span>
                  <span className="text-white text-right text-xs">
                    {shipping.name}<br />
                    {shipping.city}, {shipping.state} {shipping.zip}
                  </span>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-red-950/40 border border-red-800 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-red-300 font-medium">This action is irreversible</p>
                    <p className="text-red-400/80 text-xs mt-1">
                      Your WGB tokens will be permanently burned. You cannot undo this.
                      Physical Goldbacks will be shipped to the address provided.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('shipping')}
                  className="flex-1 bg-gray-800 text-white font-medium py-3 hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleRedeem}
                  disabled={isLoading}
                  className="flex-[2] bg-red-600 hover:bg-red-500 cursor-pointer text-white font-bold py-3 disabled:opacity-80 transition-all active:scale-95 relative"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Burning...
                    </span>
                  ) : (
                    'Burn & Redeem'
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Processing */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-12 space-y-6"
            >
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-gray-800 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-red-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Burning Tokens...</h3>
                <p className="text-gray-400 text-sm">
                  Creating your redemption request on Solana
                </p>
              </div>
              <div className="bg-gray-950/50 p-4 text-sm space-y-2 mx-4">
                <div className="flex justify-between text-gray-400">
                  <span>Burning</span>
                  <span className="text-white">{redeemAmount} WGB</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Physical delivery</span>
                  <span className="text-white">{shipping.city}, {shipping.state}</span>
                </div>
              </div>
              <p className="text-gray-600 text-xs">Please confirm in your wallet if prompted</p>
            </motion.div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Redemption Created!</h3>
              <p className="text-gray-400 mb-2">
                {redeemAmount} WGB has been burned. Your physical Goldbacks will be shipped.
              </p>
              <p className="text-[#c9a84c] text-sm mb-4">
                +{parseInt(redeemAmount || '0') * 2} loyalty points earned
              </p>

              {txSignature && (
                <a
                  href={getExplorerUrl(txSignature, 'tx')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e8d48b] hover:text-[#c9a84c] text-sm underline mb-4 block"
                >
                  View Burn Transaction on Solscan →
                </a>
              )}

              <div className="bg-gray-950/50 p-4 text-sm space-y-2 mt-4 mb-6 text-left">
                <div className="flex justify-between text-gray-400">
                  <span>Status</span>
                  <span className="text-yellow-400">Pending Fulfillment</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Shipping To</span>
                  <span className="text-white">{shipping.name}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Address</span>
                  <span className="text-white text-right text-xs">
                    {shipping.city}, {shipping.state} {shipping.zip}
                  </span>
                </div>
              </div>

              <button
                onClick={reset}
                className="w-full bg-gray-800 text-white font-medium py-3 hover:bg-gray-700 transition-colors"
              >
                Done
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
