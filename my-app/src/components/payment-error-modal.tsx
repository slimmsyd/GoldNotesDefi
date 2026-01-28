'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { OnrampButton } from '@/components/coinbase/onramp-button';

interface PaymentErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    error: string | null;
    walletAddress?: string;
}

export default function PaymentErrorModal({ isOpen, onClose, error, walletAddress }: PaymentErrorModalProps) {
    // Check if error is related to insufficient funds
    const isInsufficientFunds = error?.toLowerCase().includes('insufficient') ||
                                 error?.toLowerCase().includes("don't have a usdc token account");
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>

                                <h3 className="text-xl font-bold text-neutral-900 mb-2">Payment Failed</h3>
                                <p className="text-sm text-neutral-500 mb-6">
                                    We couldn't process your transaction.
                                </p>

                                <div className="bg-neutral-50 rounded-lg p-4 mb-6 text-left">
                                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Error Details</p>
                                    <p className="text-sm text-red-600 font-medium break-words">
                                        {error || "Unknown error occurred"}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-colors"
                                    >
                                        Try Again
                                    </button>

                                    {isInsufficientFunds && walletAddress && (
                                        <>
                                            <div className="flex items-center gap-3 text-xs text-neutral-400">
                                                <div className="flex-1 h-px bg-neutral-200"></div>
                                                <span>or</span>
                                                <div className="flex-1 h-px bg-neutral-200"></div>
                                            </div>
                                            <OnrampButton walletAddress={walletAddress} />
                                        </>
                                    )}

                                    <p className="text-xs text-neutral-400">
                                        {isInsufficientFunds
                                            ? 'Buy crypto instantly with Apple Pay, debit card, or bank transfer.'
                                            : 'Please ensure you have sufficient funds and are connected to the correct network.'
                                        }
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
