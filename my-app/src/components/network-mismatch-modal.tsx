'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

interface NetworkMismatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    detectedNetwork?: string | null;
    expectedNetwork?: string;
    errorMessage?: string | null;
}

export default function NetworkMismatchModal({ 
    isOpen, 
    onClose, 
    detectedNetwork,
    expectedNetwork = PROTOCOL_CONFIG.networkDisplay,
    errorMessage
}: NetworkMismatchModalProps) {
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
                                {/* Warning Icon */}
                                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>

                                <h3 className="text-xl font-bold text-neutral-900 mb-2">Network Mismatch</h3>
                                <p className="text-sm text-neutral-500 mb-6">
                                    Your wallet appears to be on a different network than expected.
                                </p>

                                {/* Network Info Cards */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {detectedNetwork && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Detected</p>
                                            <p className="text-sm font-bold text-red-600">{detectedNetwork}</p>
                                        </div>
                                    )}
                                    <div className={`bg-green-50 border border-green-200 rounded-xl p-3 ${!detectedNetwork ? 'col-span-2' : ''}`}>
                                        <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1">Expected</p>
                                        <p className="text-sm font-bold text-green-600">{expectedNetwork}</p>
                                    </div>
                                </div>

                                {/* Error Details */}
                                {errorMessage && (
                                    <div className="bg-neutral-50 rounded-lg p-4 mb-6 text-left">
                                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Error Details</p>
                                        <p className="text-sm text-neutral-600 break-words whitespace-pre-wrap">
                                            {errorMessage}
                                        </p>
                                    </div>
                                )}

                                {/* Instructions */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">How to Fix</p>
                                    <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                                        <li>Open your wallet (e.g., Phantom)</li>
                                        <li>Click on Settings (gear icon)</li>
                                        <li>Select &quot;Developer Settings&quot; or &quot;Network&quot;</li>
                                        <li>Switch to <strong>{expectedNetwork}</strong></li>
                                        <li>Reconnect your wallet</li>
                                    </ol>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                                    >
                                        I Understand
                                    </button>
                                    <p className="text-xs text-neutral-400">
                                        Make sure your wallet is connected to <strong>Solana {expectedNetwork}</strong> to continue.
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
