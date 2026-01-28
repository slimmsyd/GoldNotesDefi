'use client';

import { useCart } from '@/context/CartContext';
import Image from 'next/image';

interface MixedCartBlockerProps {
  onCheckoutDirect: () => void;
  onCheckoutAmazon: () => void;
}

export function MixedCartBlocker({ onCheckoutDirect, onCheckoutAmazon }: MixedCartBlockerProps) {
  const { directItems, amazonItems, directTotal, amazonTotal, directCount, amazonCount } = useCart();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Warning Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-amber-800">
            You have items from two different sources
          </span>
        </div>
        <p className="text-neutral-500 text-sm">
          Please checkout each source separately. Items from different sources ship from different locations.
        </p>
      </div>

      {/* Two Card Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Direct Items Card */}
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="bg-neutral-900 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span className="font-medium uppercase tracking-wider text-sm">Your GoldBacks</span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded">Direct</span>
            </div>
          </div>

          <div className="p-6">
            {/* Items Preview */}
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {directItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 rounded relative flex-shrink-0">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill className="object-cover rounded" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-neutral-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">{item.price}</span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="border-t border-neutral-100 pt-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-neutral-500">{directCount} item{directCount !== 1 ? 's' : ''}</span>
                <span className="font-bold">${directTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-neutral-400">Ships from: W3B GoldBack Store</p>
            </div>

            {/* CTA Button */}
            <button
              onClick={onCheckoutDirect}
              className="w-full py-3 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
            >
              Checkout Direct
            </button>
          </div>
        </div>

        {/* Amazon Items Card */}
        <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
          <div className="bg-amber-500 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium uppercase tracking-wider text-sm">Amazon GoldBacks</span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded">SP3ND</span>
            </div>
          </div>

          <div className="p-6">
            {/* Items Preview */}
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {amazonItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 rounded relative flex-shrink-0">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill className="object-contain rounded" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-neutral-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">{item.price}</span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="border-t border-neutral-100 pt-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-neutral-500">{amazonCount} item{amazonCount !== 1 ? 's' : ''}</span>
                <span className="font-bold">${amazonTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-neutral-400">Ships via: SP3ND (Amazon)</p>
              <p className="text-xs text-amber-600 mt-1">+ SP3ND fees at checkout</p>
            </div>

            {/* CTA Button */}
            <button
              onClick={onCheckoutAmazon}
              className="w-full py-3 bg-amber-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-colors"
            >
              Checkout Amazon
            </button>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-neutral-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>Tip: Checkout direct items first to support our store!</span>
        </div>
      </div>
    </div>
  );
}
