'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MerkleRootRecord {
    id: number;
    root_hash: string;
    total_serials: number;
    anchored_at: string;
    solana_tx_hash: string | null;
    status: string;
}

interface ProtocolStatusResponse {
    success: boolean;
    data: {
        offChain: {
            lastAuditRecord: MerkleRootRecord | null;
            totalBatches: number;
            auditHistory?: MerkleRootRecord[];
        };
    };
}

export function ProofHistoryTable() {
    const [history, setHistory] = useState<MerkleRootRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/protocol-status?history=true');
                const data: ProtocolStatusResponse = await res.json();

                if (data.success && data.data.offChain.auditHistory) {
                    setHistory(data.data.offChain.auditHistory);
                }
            } catch (err) {
                setError('Failed to load audit history');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, []);

    if (isLoading) {
        return (
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 animate-pulse rounded-[32px]">
                <div className="h-6 bg-white/10 rounded-full w-48 mb-6"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-white/5 rounded-[24px]"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-950/40 backdrop-blur-xl border border-red-500/30 p-8 rounded-[32px]">
                <p className="text-red-400 font-bold tracking-widest uppercase">{error}</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden rounded-[32px]"
        >
            <div className="p-8 border-b border-white/5">
                <h3 className="text-xl font-medium text-white flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-[12px] border border-white/10">
                        <img src="/AppAssets/PNG Renders/dollar_coin_black.png" alt="Proof History" className="w-6 h-6 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
                    </div>
                    Proof History (Audit Log)
                </h3>
                <p className="text-gray-500 text-sm mt-2 font-medium">
                    Cryptographic commitments anchored to Solana blockchain
                </p>
            </div>

            {history.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest">
                    No audit records yet
                </div>
            ) : (
                <div className="overflow-x-auto p-4">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="text-left">
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">Serials</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">Merkle Root</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">Proof</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {history.map((record, index) => (
                                <motion.tr
                                    key={record.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="hover:bg-white/[0.02] transition-colors group"
                                >
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm font-medium text-white/90">
                                            {new Date(record.anchored_at).toLocaleDateString()}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                            {new Date(record.anchored_at).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-xl font-bold text-emerald-400 tracking-tight">
                                            {record.total_serials}
                                        </span>
                                        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-2">Goldbacks</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <code className="text-xs text-gray-400 bg-white/[0.02] border border-white/5 px-2.5 py-1.5 font-mono rounded-md">
                                            {record.root_hash.slice(0, 10)}...{record.root_hash.slice(-8)}
                                        </code>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border shadow-sm ${record.status === 'anchored'
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                            }`}>
                                            {record.status === 'anchored' ? '✓ Anchored' : record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        {record.solana_tx_hash ? (
                                            <a
                                                href={`https://solscan.io/tx/${record.solana_tx_hash}?cluster=devnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#c9a84c]/20 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                View Tx
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        ) : (
                                            <span className="text-gray-500 text-sm">—</span>
                                        )}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.div>
    );
}
