'use client';

/**
 * Architecture Explainer Component
 * GoldBack Design System Implementation
 *
 * Collapsible "How W3B Works" section explaining the 4-layer trust system
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const layers = [
  {
    number: 1,
    title: 'Physical',
    description: 'Goldback serial numbers in custody',
    detail: 'Each physical Goldback has a unique serial number tracked in our database',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    number: 2,
    title: 'Cryptographic',
    description: 'ZK proofs verify reserves',
    detail: 'Zero-knowledge proofs prove reserves without revealing individual serials',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    number: 3,
    title: 'On-Chain',
    description: 'Solana stores verified roots',
    detail: 'Merkle roots are immutably stored on Solana blockchain',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
];

export function ArchitectureExplainer() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-gray-900/30 border border-gray-800/50 rounded-2xl overflow-hidden"
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-inset"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-300">How W3B Works</span>
          <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full">Trust Model</span>
        </div>
        <motion.svg
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-gray-800/50">
              {/* Layer Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {layers.map((layer, index) => (
                  <motion.div
                    key={layer.number}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.1 }}
                    className="bg-gray-800/30 rounded-xl p-4 border border-gray-800/50 group hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-6 h-6 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500">
                        {layer.icon}
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 font-medium">Layer {layer.number}</span>
                        <h4 className="text-sm font-semibold text-white leading-none">{layer.title}</h4>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{layer.description}</p>
                  </motion.div>
                ))}
              </div>

              {/* Flow Arrows (Desktop only) */}
              <div className="hidden sm:flex justify-center items-center gap-4 mb-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-600">
                    <div className="w-8 h-px bg-gray-700" />
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <div className="w-8 h-px bg-gray-700" />
                  </div>
                ))}
              </div>

              {/* Trust Statement */}
              <div className="bg-gradient-to-r from-green-500/5 to-transparent rounded-xl p-3 border border-green-500/10">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-400 mb-0.5">Mathematical Certainty</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Trust the math, not the issuer. W3B tokens can only be minted when cryptographic proofs verify that physical reserves exceed token supply.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
