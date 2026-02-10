'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

const W3B_MINT = new PublicKey(PROTOCOL_CONFIG.w3bMint);

export default function ProfilePage() {
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const [solBalance, setSolBalance] = useState<number | null>(null);
    const [w3bBalance, setW3bBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchBalances() {
            if (!publicKey) {
                setIsLoading(false);
                return;
            }
            try {
                // Fetch SOL balance
                const solBal = await connection.getBalance(publicKey);
                setSolBalance(solBal / LAMPORTS_PER_SOL);

                // Fetch W3B token balance (Token-2022)
                try {
                    const ata = await getAssociatedTokenAddress(
                        W3B_MINT,
                        publicKey,
                        false,
                        TOKEN_2022_PROGRAM_ID
                    );
                    const tokenAccountInfo = await connection.getTokenAccountBalance(ata);
                    setW3bBalance(tokenAccountInfo.value.uiAmount ?? 0);
                } catch (tokenErr) {
                    // User doesn't have a W3B token account yet
                    setW3bBalance(0);
                }
            } catch (err) {
                console.error('Failed to fetch balances:', err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchBalances();
    }, [publicKey, connection]);

    if (!connected || !publicKey) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-20 h-20 bg-gray-800 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
                <p className="text-gray-400 max-w-md">
                    Connect your Solana wallet to view your profile and account settings.
                </p>
            </div>
        );
    }

    const address = publicKey.toBase58();

    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Profile</h1>
                <p className="text-gray-400">Manage your account and preferences.</p>
            </div>

            {/* Wallet Card */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1a1a1a] border border-[#c9a84c]/30 p-6"
            >
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Connected Wallet
                </h2>

                <div className="space-y-4">
                    {/* Address */}
                    <div className="bg-black/30 p-4">
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Wallet Address</p>
                        <div className="flex items-center justify-between">
                            <p className="text-white font-mono text-sm break-all">{address}</p>
                            <button
                                onClick={() => navigator.clipboard.writeText(address)}
                                className="ml-2 text-gray-400 hover:text-white transition-colors"
                                title="Copy Address"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Balances */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-black/30 p-4">
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">W3B Balance</p>
                            {isLoading ? (
                                <div className="h-7 w-16 bg-gray-800 animate-pulse" />
                            ) : (
                                <p className="text-2xl font-bold text-[#e8d48b]">
                                    {w3bBalance?.toLocaleString() ?? '0'}
                                    <span className="text-gray-500 text-sm ml-1">W3B</span>
                                </p>
                            )}
                        </div>
                        <div className="bg-black/30 p-4">
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">SOL Balance</p>
                            {isLoading ? (
                                <div className="h-7 w-20 bg-gray-800 animate-pulse" />
                            ) : (
                                <p className="text-2xl font-bold text-white">
                                    {solBalance?.toFixed(4) ?? '—'}
                                    <span className="text-gray-500 text-sm ml-1">SOL</span>
                                </p>
                            )}
                        </div>
                        <div className="bg-black/30 p-4">
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Network</p>
                            <p className="text-lg font-semibold text-[#e8d48b] capitalize">
                                {PROTOCOL_CONFIG.network}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* Settings Section */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#1a1a1a] border border-[#c9a84c]/30 p-6"
            >
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Preferences
                </h2>

                <div className="text-gray-500 text-sm">
                    <p>More settings coming soon.</p>
                    <ul className="mt-3 space-y-2 text-gray-400">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#c9a84c]"></span>
                            Notification preferences
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#c9a84c]"></span>
                            Display currency settings
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#c9a84c]"></span>
                            Identity verification
                        </li>
                    </ul>
                </div>
            </motion.section>

            {/* Explorer Link */}
            <div className="text-center">
                <a
                    href={`https://solscan.io/account/${address}?cluster=${PROTOCOL_CONFIG.network}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#e8d48b] hover:text-[#c9a84c] text-sm font-medium transition-colors"
                >
                    View on Solscan
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>
        </div>
    );
}
