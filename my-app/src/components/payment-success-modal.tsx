'use client';

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface PaymentSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    signature: string;
    amount?: number; // Optional amount display
    currency?: 'USDC' | 'SOL';
}

export default function PaymentSuccessModal({
    isOpen,
    onClose,
    signature,
    amount,
    currency = 'USDC'
}: PaymentSuccessModalProps) {
    const [copied, setCopied] = useState(false);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleCopy = () => {
        navigator.clipboard.writeText(signature);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-all duration-300"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-[32px] w-full max-w-sm overflow-hidden pointer-events-auto flex flex-col items-center p-8 text-center relative">

                            {/* Success Icon Animation */}
                            <div className="mb-6 relative">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 20,
                                        delay: 0.1
                                    }}
                                    className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30"
                                >
                                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                        <motion.path
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </motion.div>
                            </div>

                            {/* Text Content */}
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">Payment Successful</h2>

                            {amount && (
                                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 font-medium">
                                    You sent {amount.toFixed(currency === 'SOL' ? 4 : 2)} {currency}
                                </p>
                            )}

                            {/* Signature Box */}
                            <div className="w-full bg-gray-100 dark:bg-black/40 rounded-2xl p-4 mb-6 relative group border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-bold">Transaction Signature</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300 font-mono break-all line-clamp-2 leading-relaxed">
                                    {signature}
                                </p>
                                <button
                                    onClick={handleCopy}
                                    className="absolute right-2 top-2 p-2 rounded-full bg-white dark:bg-[#2C2C2E] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
                                    title="Copy Signature"
                                >
                                    {copied ? (
                                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 20h6a2 2 0 012 2v6a2 2 0 01-2 2h-6a2 2 0 01-2-2v-6a2 2 0 012-2z" /></svg>
                                    )}
                                </button>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={onClose}
                                className="w-full cursor-pointer py-4 bg-gray-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-xl shadow-gray-200 dark:shadow-none text-sm tracking-wide"
                            >
                                Done
                            </button>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
