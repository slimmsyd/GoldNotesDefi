'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Popular tokens for Devnet/Mainnet with fallback icons
const POPULAR_TOKENS: TokenInfo[] = [
    {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
    },

    {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin (Mainnet)',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
    },
    {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'
    },
    {
        address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
        symbol: 'mSOL',
        name: 'Marinade Staked SOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png'
    },
    {
        address: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
        symbol: 'stSOL',
        name: 'Lido Staked SOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png'
    },
    {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        symbol: 'BONK',
        name: 'Bonk',
        decimals: 5,
        logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I'
    },
    {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        symbol: 'JUP',
        name: 'Jupiter',
        decimals: 6,
        logoURI: 'https://static.jup.ag/jup/icon.png'
    },
    {
        address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
        symbol: 'PYTH',
        name: 'Pyth Network',
        decimals: 6,
        logoURI: 'https://pyth.network/token.svg'
    }
];

export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    balance?: number;
}

interface TokenSelectorProps {
    selectedToken: TokenInfo;
    onSelectToken: (token: TokenInfo) => void;
    excludeToken?: string; // Token address to exclude (e.g., the output token)
    label?: string;
}

export function TokenSelector({
    selectedToken,
    onSelectToken,
    excludeToken,
    label = 'Select token'
}: TokenSelectorProps) {
    const { connection } = useConnection();
    const { publicKey } = useWallet();

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tokens, setTokens] = useState<TokenInfo[]>(POPULAR_TOKENS);
    const [isLoading, setIsLoading] = useState(false);

    // Portal/Modal ref handling not strictly needed for this layout if we use fixed overlay
    // But we'll use a fixed overlay strategy

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

    // Fetch user's token balances when wallet is connected
    useEffect(() => {
        const fetchBalances = async () => {
            if (!publicKey) return;

            setIsLoading(true);
            try {
                // Get SOL balance
                const solBalance = await connection.getBalance(publicKey);
                const solBalanceFormatted = solBalance / 1e9;

                // Get SPL token balances
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    programId: TOKEN_PROGRAM_ID
                });

                const balanceMap = new Map<string, number>();
                balanceMap.set('So11111111111111111111111111111111111111112', solBalanceFormatted);

                tokenAccounts.value.forEach(account => {
                    const info = account.account.data.parsed.info;
                    const mint = info.mint;
                    const balance = info.tokenAmount.uiAmount || 0;
                    balanceMap.set(mint, balance);
                });

                // Update tokens with balances
                setTokens(prevTokens =>
                    prevTokens.map(token => ({
                        ...token,
                        balance: balanceMap.get(token.address) || 0
                    })).sort((a, b) => (b.balance || 0) - (a.balance || 0))
                );
            } catch (error) {
                console.error('Failed to fetch balances:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBalances();
    }, [publicKey, connection]);

    // Filter tokens based on search and exclude token
    const filteredTokens = tokens.filter(token => {
        if (excludeToken && token.address === excludeToken) return false;
        if (!searchQuery) return true;

        const query = searchQuery.toLowerCase();
        return (
            token.symbol.toLowerCase().includes(query) ||
            token.name.toLowerCase().includes(query) ||
            token.address.toLowerCase().includes(query)
        );
    });

    const handleSelect = (token: TokenInfo) => {
        onSelectToken(token);
        setIsOpen(false);
        setSearchQuery('');
    };

    // Helper to get network tag color
    const getNetworkTag = (symbol: string) => {
        // Mock data to match screenshot vibe
        if (symbol === 'SOL') return { text: 'SOL', bg: 'bg-[#9945FF]' };
        if (symbol === 'BTC') return { text: 'BTC', bg: 'bg-[#F7931A]' };
        if (symbol === 'ETH') return { text: 'ETH', bg: 'bg-[#627EEA]' };
        if (symbol === 'USDC') return { text: 'SOL', bg: 'bg-[#2775CA]' };
        return { text: 'SOL', bg: 'bg-gray-600' };
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="bg-[#2A2A2A] hover:bg-[#333] pl-2 pr-4 py-1.5 flex items-center gap-3 transition-colors cursor-pointer border border-gray-800 group"
            >
                {selectedToken.logoURI ? (
                    <img
                        src={selectedToken.logoURI}
                        alt={selectedToken.symbol}
                        className="w-8 h-8 shadow-lg"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><circle cx="12" cy="12" r="10"/></svg>';
                        }}
                    />
                ) : (
                    <div className="w-8 h-8 bg-gray-600 flex items-center justify-center text-[10px] text-white font-bold">
                        {selectedToken.symbol[0]}
                    </div>
                )}
                <div className="text-left">
                    <div className="flex items-center gap-2">
                        <span className="text-white font-bold leading-none">{selectedToken.symbol}</span>
                        <svg
                            className="w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </button>

            {/* Modal Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-md bg-[#0B0B0B] border border-gray-800 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 pb-2">
                                <h3 className="text-white text-lg font-semibold">Select currency</h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/10 transition-colors text-gray-400"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Search */}
                            <div className="px-6 py-4">
                                <div className="relative group">
                                    <svg
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-white transition-colors"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search by name, ticker, or network..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-[#1A1A1A] text-white text-base pl-12 pr-4 py-3.5 outline-none border border-transparent focus:border-gray-700 placeholder-gray-600 transition-all font-sans"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Token List */}
                            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                                {isLoading ? (
                                    <div className="p-8 text-center text-gray-500">
                                        <svg className="animate-spin h-6 w-6 mx-auto mb-3" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Loading balances...
                                    </div>
                                ) : filteredTokens.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="text-gray-400 font-medium mb-1">No tokens found</div>
                                        <div className="text-gray-600 text-sm">Try searching for something else</div>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredTokens.map((token) => {
                                            const tag = getNetworkTag(token.symbol);
                                            return (
                                                <button
                                                    key={token.address}
                                                    onClick={() => handleSelect(token)}
                                                    className={`w-full p-3 flex items-center gap-4 hover:bg-[#1A1A1A] transition-all group ${selectedToken.address === token.address ? 'bg-[#1A1A1A] ring-1 ring-gray-800' : ''}`}
                                                >
                                                    {/* Token Icon */}
                                                    <div className="relative">
                                                        {token.logoURI ? (
                                                            <img
                                                                src={token.logoURI}
                                                                alt={token.symbol}
                                                                className="w-10 h-10"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><circle cx="12" cy="12" r="10"/></svg>';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-gray-800 flex items-center justify-center text-white font-bold">
                                                                {token.symbol[0]}
                                                            </div>
                                                        )}
                                                    </div>


                                                    {/* Text Content */}
                                                    <div className="flex-grow text-left">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white font-bold text-base">{token.symbol}</span>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${tag.bg}`}>
                                                                {tag.text}
                                                            </span>
                                                        </div>
                                                        <div className="text-gray-500 text-sm font-medium">{token.name}</div>
                                                    </div>

                                                    {/* Checkmark or Balance */}
                                                    {token.balance !== undefined && token.balance > 0 ? (
                                                        <div className="text-right">
                                                            <div className="text-white font-medium">
                                                                {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                                            </div>
                                                        </div>
                                                    ) : selectedToken.address === token.address && (
                                                        <svg className="w-5 h-5 text-[#c9a84c]" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}

// Export the default token list for use elsewhere
export { POPULAR_TOKENS };
