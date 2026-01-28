'use client';

/**
 * Private Payment Flow Component
 * 
 * A multi-step UI for executing private payments through Privacy Cash.
 * This component guides the user through the shielding and unshielding process.
 * 
 * SDK calls are routed through server-side API routes to avoid Node.js dependencies.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import {
    calculatePrivacyFee,
    getPersistedShieldedState,
    clearPersistedShieldedState,
    persistShieldedState,
    createDepositTransaction,
    submitSignedDeposit,
    withdrawViaApi,
    getPrivateBalance,
    type PrivatePaymentStep,
    type PrivatePaymentState,
    PRIVACY_CASH_FEES,
} from '@/lib/privacy-cash-service';

interface PrivatePaymentFlowProps {
    amountUSD: number;
    solPrice: number;
    merchantWallet: string;
    onSuccess: (signature: string, amountSOL: number) => void;
    onCancel: () => void;
    onError: (error: string) => void;
}

const STEP_DESCRIPTIONS: Record<PrivatePaymentStep, string> = {
    IDLE: 'Ready to start private payment',
    SIGNING_KEY: 'Please sign to unlock your privacy account...',
    CREATING_TRANSACTION: 'Generating zero-knowledge proof...',
    SIGNING_DEPOSIT: 'Please sign the deposit transaction...',
    SUBMITTING_DEPOSIT: 'Submitting deposit to privacy pool...',
    WAITING_CONFIRMATION: 'Waiting for confirmation...',
    PAYING: 'Sending payment to merchant...',
    COMPLETE: 'Payment complete!',
    ERROR: 'An error occurred',
};

export function PrivatePaymentFlow({
    amountUSD,
    solPrice,
    merchantWallet,
    onSuccess,
    onCancel,
    onError,
}: PrivatePaymentFlowProps) {
    const { publicKey, signMessage, signTransaction } = useWallet();

    const [state, setState] = useState<PrivatePaymentState>({ step: 'IDLE' });
    const [showEducation, setShowEducation] = useState(true);
    const [hasPersistedState, setHasPersistedState] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isCheckingBalance, setIsCheckingBalance] = useState(false);
    const [shieldedBalance, setShieldedBalance] = useState<number | null>(null);

    // Calculate amounts
    const amountLamports = Math.ceil((amountUSD / solPrice) * LAMPORTS_PER_SOL);
    const { totalNeeded, withdrawalFee } = calculatePrivacyFee(amountLamports);

    const totalSOL = totalNeeded / LAMPORTS_PER_SOL;
    const feeSOL = withdrawalFee / LAMPORTS_PER_SOL;
    const feeUSD = feeSOL * solPrice;

    // Check wallet capabilities on mount
    useEffect(() => {
        if (publicKey && signMessage && signTransaction) {
            setIsReady(true);
        }
    }, [publicKey, signMessage, signTransaction]);

    // Check for persisted state on mount (for mobile recovery)
    useEffect(() => {
        const persisted = getPersistedShieldedState();
        if (persisted) {
            setHasPersistedState(true);
        }
    }, []);

    // Sign the privacy account message and get base64 signature
    const getSignatureBase64 = useCallback(async (): Promise<string> => {
        if (!signMessage) throw new Error('Wallet does not support message signing');

        const message = new TextEncoder().encode('Privacy Money account sign in');
        const signature = await signMessage(message);
        return Buffer.from(signature).toString('base64');
    }, [signMessage]);

    const handleRecoverPersistedState = useCallback(async () => {
        // If user had funds shielded but didn't complete payment, resume
        const persisted = getPersistedShieldedState();
        if (!persisted || !publicKey || !signMessage) return;

        try {
            setState({ step: 'SIGNING_KEY' });
            const signatureBase64 = await getSignatureBase64();

            setState({ step: 'PAYING' });
            const result = await withdrawViaApi({
                lamports: persisted.amountLamports,
                recipientAddress: merchantWallet,
                signatureBase64,
                userPublicKey: publicKey.toBase58(),
            });

            if (!result.success) {
                throw new Error(result.error || 'Withdrawal failed');
            }

            clearPersistedShieldedState();
            setState({ step: 'COMPLETE', paymentTx: result.tx });
            onSuccess(result.tx!, (result.amount_in_lamports || persisted.amountLamports) / LAMPORTS_PER_SOL);
        } catch (err: any) {
            setState({ step: 'ERROR', error: err.message });
            onError(err.message);
        }
    }, [getSignatureBase64, merchantWallet, onError, onSuccess, publicKey, signMessage]);

    // Check if user has shielded funds in the Privacy Cash pool
    const handleCheckAndRecoverBalance = useCallback(async () => {
        if (!publicKey || !signMessage) {
            onError('Wallet not connected');
            return;
        }

        try {
            setIsCheckingBalance(true);
            setState({ step: 'SIGNING_KEY' });
            
            // Sign to derive encryption key
            const signatureBase64 = await getSignatureBase64();
            
            // Check balance in privacy pool
            const balanceResult = await getPrivateBalance({
                userPublicKey: publicKey.toBase58(),
                signatureBase64,
            });

            if (!balanceResult.success) {
                throw new Error(balanceResult.error || 'Failed to check balance');
            }

            const balance = balanceResult.balance || 0;
            setShieldedBalance(balance);

            if (balance > 0) {
                // User has funds - withdraw them to merchant
                setState({ step: 'PAYING' });
                const withdrawResult = await withdrawViaApi({
                    lamports: balance,
                    recipientAddress: merchantWallet,
                    signatureBase64,
                    userPublicKey: publicKey.toBase58(),
                });

                if (!withdrawResult.success) {
                    throw new Error(withdrawResult.error || 'Withdrawal failed');
                }

                clearPersistedShieldedState();
                setState({ step: 'COMPLETE', paymentTx: withdrawResult.tx });
                onSuccess(withdrawResult.tx!, (withdrawResult.amount_in_lamports || balance) / LAMPORTS_PER_SOL);
            } else {
                setState({ step: 'IDLE' });
                onError('No shielded funds found for this wallet');
            }
        } catch (err: any) {
            setState({ step: 'ERROR', error: err.message });
            onError(err.message);
        } finally {
            setIsCheckingBalance(false);
        }
    }, [getSignatureBase64, merchantWallet, onError, onSuccess, publicKey, signMessage]);

    const startPrivatePayment = useCallback(async () => {
        if (!publicKey || !signMessage || !signTransaction) {
            onError('Wallet not connected or does not support signing');
            return;
        }

        try {
            // Step 1: Sign message to derive encryption key
            setState({ step: 'SIGNING_KEY' });
            const signatureBase64 = await getSignatureBase64();

            // Step 2: Backend creates unsigned transaction with ZK proof
            setState({ step: 'CREATING_TRANSACTION' });
            const createResult = await createDepositTransaction({
                lamports: totalNeeded,
                userPublicKey: publicKey.toBase58(),
                signatureBase64,
            });

            if (!createResult.success || !createResult.unsignedTransaction) {
                throw new Error(createResult.error || 'Failed to create deposit transaction');
            }

            console.log('Unsigned transaction created, waiting for user signature...');

            // Step 3: User signs the deposit transaction
            setState({ step: 'SIGNING_DEPOSIT' });

            // Deserialize the unsigned transaction
            const unsignedTxBytes = Buffer.from(createResult.unsignedTransaction, 'base64');
            const unsignedTx = VersionedTransaction.deserialize(unsignedTxBytes);

            // Fetch a fresh blockhash to prevent expiration issues
            // (ZK proof generation can take 15+ seconds, blockhash may be stale)
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
            const connection = new Connection(rpcUrl, 'confirmed');
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            
            // Update the transaction with fresh blockhash
            unsignedTx.message.recentBlockhash = blockhash;
            console.log('Updated transaction with fresh blockhash:', blockhash.slice(0, 8) + '...');

            // User signs the transaction in their wallet
            const signedTx = await signTransaction(unsignedTx);
            const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');

            console.log('Transaction signed by user');

            // Step 4: Submit signed transaction to relayer
            setState({ step: 'SUBMITTING_DEPOSIT' });
            const submitResult = await submitSignedDeposit({
                signedTransaction: signedTxBase64,
                userPublicKey: publicKey.toBase58(),
            });

            if (!submitResult.success || !submitResult.tx) {
                throw new Error(submitResult.error || 'Failed to submit deposit');
            }

            console.log('Deposit submitted:', submitResult.tx);

            // Persist state for mobile recovery
            persistShieldedState({
                depositTx: submitResult.tx,
                amountLamports: totalNeeded,
                timestamp: Date.now(),
            });

            // Step 5: Wait for confirmation
            setState({ step: 'WAITING_CONFIRMATION' });
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 6: Withdraw to merchant
            setState({ step: 'PAYING' });
            const withdrawResult = await withdrawViaApi({
                lamports: totalNeeded,
                recipientAddress: merchantWallet,
                signatureBase64,
                userPublicKey: publicKey.toBase58(),
            });

            if (!withdrawResult.success) {
                throw new Error(withdrawResult.error || 'Withdrawal failed');
            }

            // Clear persisted state on success
            clearPersistedShieldedState();

            setState({
                step: 'COMPLETE',
                paymentTx: withdrawResult.tx,
                amountShielded: withdrawResult.amount_in_lamports,
            });

            onSuccess(withdrawResult.tx!, (withdrawResult.amount_in_lamports || totalNeeded) / LAMPORTS_PER_SOL);
        } catch (err: any) {
            console.error('Private payment error:', err);
            setState({ step: 'ERROR', error: err.message });
            onError(err.message);
        }
    }, [getSignatureBase64, merchantWallet, onError, onSuccess, publicKey, signMessage, signTransaction, totalNeeded]);

    // Progress indicator
    const getProgress = (): number => {
        const steps: PrivatePaymentStep[] = [
            'SIGNING_KEY',
            'CREATING_TRANSACTION',
            'SIGNING_DEPOSIT',
            'SUBMITTING_DEPOSIT',
            'WAITING_CONFIRMATION',
            'PAYING',
            'COMPLETE',
        ];
        const index = steps.indexOf(state.step);
        return index >= 0 ? ((index + 1) / steps.length) * 100 : 0;
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <AnimatePresence mode="wait">
                {/* Education Screen */}
                {showEducation && state.step === 'IDLE' && (
                    <motion.div
                        key="education"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        {/* Header */}
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold uppercase tracking-wider">Private Payment</h3>
                            <p className="text-sm text-neutral-500 mt-1">via Privacy Cash</p>
                        </div>

                        {/* Explainer */}
                        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Why Private?</h4>
                            <p className="text-sm text-neutral-600 leading-relaxed">
                                This breaks the on-chain link between your wallet&apos;s total wealth and this specific purchase.
                                The merchant receives your payment, but cannot see your full portfolio.
                            </p>
                            <div className="flex items-start gap-2 text-xs text-neutral-500">
                                <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Your payment is still fully traceable for compliance if needed.</span>
                            </div>
                        </div>

                        {/* Fee Breakdown */}
                        <div className="border border-neutral-200 rounded-lg overflow-hidden">
                            <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Fee Breakdown</h4>
                            </div>
                            <div className="p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Order Total</span>
                                    <span className="font-medium">${amountUSD.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Privacy Fee ({(PRIVACY_CASH_FEES.WITHDRAW_PERCENT * 100).toFixed(2)}% + 0.006 SOL)</span>
                                    <span className="font-medium text-amber-600">+${feeUSD.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-neutral-200 pt-2 flex justify-between font-bold">
                                    <span>Total (SOL)</span>
                                    <span>~{totalSOL.toFixed(4)} SOL</span>
                                </div>
                            </div>
                        </div>

                        {/* Recovery Notice */}
                        {hasPersistedState && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800 mb-3">
                                    You have funds shielded from a previous session. Would you like to complete that payment?
                                </p>
                                <button
                                    onClick={handleRecoverPersistedState}
                                    className="w-full py-2 bg-amber-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-amber-700 transition-colors cursor-pointer"
                                >
                                    Resume Previous Payment
                                </button>
                            </div>
                        )}

                        {/* Recover Shielded Funds - for when localStorage is lost */}
                        {isReady && !hasPersistedState && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800 mb-3">
                                    Have shielded funds from a previous session? Check your privacy pool balance.
                                </p>
                                <button
                                    onClick={handleCheckAndRecoverBalance}
                                    disabled={isCheckingBalance}
                                    className="w-full py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isCheckingBalance ? 'Checking...' : 'Recover Shielded Funds'}
                                </button>
                            </div>
                        )}

                        {/* Wallet Not Ready Warning */}
                        {!isReady && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800">
                                    Please connect a wallet that supports message and transaction signing.
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-3 border border-neutral-300 text-neutral-700 text-xs font-bold uppercase tracking-wider hover:bg-neutral-50 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowEducation(false);
                                    startPrivatePayment();
                                }}
                                disabled={!isReady}
                                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider hover:from-purple-700 hover:to-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isReady ? 'Start Private Payment' : 'Connect Wallet...'}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Processing Screen */}
                {!showEducation && state.step !== 'IDLE' && state.step !== 'COMPLETE' && state.step !== 'ERROR' && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-center space-y-6"
                    >
                        {/* Animated Icon */}
                        <div className="w-20 h-20 mx-auto relative">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 animate-pulse" />
                            <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                                <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-600"
                                initial={{ width: 0 }}
                                animate={{ width: `${getProgress()}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <h3 className="text-lg font-bold uppercase tracking-wider mb-2">
                                {STEP_DESCRIPTIONS[state.step]}
                            </h3>
                            <p className="text-sm text-neutral-500">
                                Do not close this window or switch apps.
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* Success Screen */}
                {state.step === 'COMPLETE' && (
                    <motion.div
                        key="complete"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-6"
                    >
                        <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold uppercase tracking-wider text-green-700">Payment Complete!</h3>
                            <p className="text-sm text-neutral-500 mt-1">Your transaction was processed privately.</p>
                        </div>
                        {state.paymentTx && (
                            <a
                                href={`https://explorer.solana.com/tx/${state.paymentTx}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-xs text-indigo-600 hover:text-indigo-800 underline"
                            >
                                View on Explorer →
                            </a>
                        )}
                    </motion.div>
                )}

                {/* Error Screen */}
                {state.step === 'ERROR' && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-6"
                    >
                        <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold uppercase tracking-wider text-red-700">Payment Failed</h3>
                            <p className="text-sm text-neutral-500 mt-1">{state.error || 'An unknown error occurred.'}</p>
                        </div>
                        <button
                            onClick={onCancel}
                            className="px-6 py-3 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                            Try Again
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default PrivatePaymentFlow;
