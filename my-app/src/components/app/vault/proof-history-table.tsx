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
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 bg-gray-800 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden"
        >
            <div className="p-6 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Proof History (Audit Log)
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                    Cryptographic commitments anchored to Solana blockchain
                </p>
            </div>

            {history.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                    No audit records yet
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-800/50 text-left">
                                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Serials</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Merkle Root</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Proof</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {history.map((record, index) => (
                                <motion.tr
                                    key={record.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="hover:bg-gray-800/30 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-white">
                                            {new Date(record.anchored_at).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(record.anchored_at).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-lg font-bold text-emerald-400">
                                            {record.total_serials}
                                        </span>
                                        <span className="text-gray-500 text-sm ml-1">Goldbacks</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <code className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded font-mono">
                                            {record.root_hash.slice(0, 10)}...{record.root_hash.slice(-8)}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${record.status === 'anchored'
                                                ? 'bg-emerald-900/50 text-emerald-400'
                                                : 'bg-yellow-900/50 text-yellow-400'
                                            }`}>
                                            {record.status === 'anchored' ? '✓ Anchored' : record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {record.solana_tx_hash ? (
                                            <a
                                                href={`https://solscan.io/tx/${record.solana_tx_hash}?cluster=devnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1"
                                            >
                                                View Tx
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
