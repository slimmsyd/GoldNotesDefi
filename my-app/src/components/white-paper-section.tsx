'use client';

import { motion } from 'framer-motion';

export function WhitePaperSection() {
    return (
        <div className="py-20 px-6 bg-gradient-to-b from-white to-gray-50">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                viewport={{ once: true }}
                className="max-w-5xl mx-auto"
            >
                {/* Section Header */}
                <div className="text-center mb-12">
                    <h2
                        className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent"
                        style={{
                            backgroundImage: 'linear-gradient(to right, #6B6550, #9B9683)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        White Paper
                    </h2>
                    <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                        Explore our vision, architecture, and the future of gold-backed digital assets.
                    </p>
                </div>

                {/* PDF Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                    className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white"
                >
                    <iframe
                        src="/BlackW3B_Platform_Document .pdf"
                        className="w-full"
                        style={{ height: '80vh', minHeight: '600px' }}
                        title="BlackW3B White Paper"
                    />
                </motion.div>

                {/* Download Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    viewport={{ once: true }}
                    className="mt-8 flex justify-center"
                >
                    <a
                        href="/BlackW3B_Platform_Document .pdf"
                        download="BlackW3B_Platform_Document.pdf"
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg"
                        style={{
                            backgroundImage: 'linear-gradient(135deg, #6B6550, #9B9683)',
                        }}
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                        </svg>
                        Download White Paper
                    </a>
                </motion.div>
            </motion.div>
        </div>
    );
}
