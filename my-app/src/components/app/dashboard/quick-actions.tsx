'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    href: string;
    delay: number;
    highlight?: boolean;
}

function ActionButton({ icon, label, href, delay, highlight }: ActionButtonProps) {
    return (
        <Link href={href} className="group flex flex-col items-center gap-3">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-lg ${highlight
                        ? 'bg-[#c9a84c] text-black group-hover:bg-[#d6b75e] group-hover:shadow-[#c9a84c]/20'
                        : 'bg-gray-800 text-white group-hover:bg-gray-700'
                    }`}
            >
                {icon}
            </motion.div>
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.1 }}
                className={`text-sm font-medium transition-colors ${highlight ? 'text-white group-hover:text-[#c9a84c]' : 'text-gray-400 group-hover:text-white'}`}
            >
                {label}
            </motion.span>
        </Link>
    );
}

export function QuickActions() {
    return (
        <div className="flex justify-center gap-6 md:gap-12 py-6 border-b border-gray-800/50 mb-8">
            <ActionButton
                delay={0.1}
                label="Buy"
                href="/app/swap"
                highlight={true}
                icon={
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                }
            />
            <ActionButton
                delay={0.15}
                label="Swap"
                href="/app/swap"
                icon={
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                }
            />
            <ActionButton
                delay={0.2}
                label="Vault"
                href="/app/vault"
                icon={
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                }
            />
            <ActionButton
                delay={0.25}
                label="Send"
                href="#" // Placeholder for Send
                icon={
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                }
            />
        </div>
    );
}
