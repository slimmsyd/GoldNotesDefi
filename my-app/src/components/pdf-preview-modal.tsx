'use client';

import { useEffect, useState } from 'react';

interface PDFPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string;
}

export function PDFPreviewModal({ isOpen, onClose, pdfUrl }: PDFPreviewModalProps) {
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

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-10000 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

            {/* Modal Container */}
            <div
                className="relative w-full max-w-5xl h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glassmorphic Card */}
                <div className="relative flex-1 flex flex-col backdrop-blur-2xl bg-white/90 shadow-2xl border border-white/20 overflow-hidden">
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-linear-to-br from-white/50 via-white/30 to-white/10 pointer-events-none" />

                    {/* Header */}
                    <div className="relative flex items-center justify-between p-6 border-b border-gray-200/50 bg-white/40">
                        <h3 className="text-xl font-bold text-gray-900">White Paper Preview</h3>
                        <div className="flex items-center gap-4">
                            <a
                                href={pdfUrl}
                                download
                                className="inline-flex items-center px-4 py-2 bg-[#0a0a0a] text-white text-sm font-bold hover:bg-[#1a1a1a] transition-all duration-150 active:scale-95"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download PDF
                            </a>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center bg-gray-900/5 hover:bg-gray-900/10 transition-all duration-150 group"
                                aria-label="Close modal"
                            >
                                <svg
                                    className="w-5 h-5 text-gray-900 group-hover:rotate-90 transition-transform duration-200"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="relative flex-1 bg-gray-100">
                        <iframe
                            src={`${pdfUrl}#toolbar=0`}
                            className="w-full h-full"
                            title="PDF Preview"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
