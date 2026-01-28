'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useRef } from 'react';
import { GetInTouchModal } from './get-in-touch-modal';
import { LearnMoreModal } from './learn-more-modal';
import { WaitlistModal } from './waitlist-modal';
import { useCart } from '@/context/CartContext';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { Button } from '@/components/ui/button';

function NetworkBadge() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${PROTOCOL_CONFIG.isMainnet
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}>
      {PROTOCOL_CONFIG.networkDisplay}
    </span>
  );
}




interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  isComingSoon?: boolean;
}

function NavLink({ href, children, isComingSoon = false }: NavLinkProps) {
  if (isComingSoon) {
    return (
      <div className="transform transition-transform hover:scale-105 active:scale-95">
        <div className="relative px-3 py-2 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed">
          {children}
          <span className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full uppercase font-mono bg-gray-900 text-white leading-none">
            Soon
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="transform transition-transform hover:scale-105 active:scale-95">
      <Link
        href={href}
        className="text-gray-700 px-3 pt-2.5 pb-2 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-300 transition-colors text-sm font-medium"
      >
        {children}
      </Link>
    </div>
  );
}

function CustomWalletButton() {
  const { publicKey, connected, disconnect } = useWallet();
  const walletButtonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleConnect = () => {
    if (connected) {
      setIsDropdownOpen(!isDropdownOpen);
    } else {
      // Click the hidden WalletMultiButton to open wallet selection modal
      const button = walletButtonRef.current?.querySelector('button');
      if (button) {
        button.click();
      }
    }
  };

  if (!mounted) {
    return (
      <Button variant="black" shape="pill" size="sm" className="ml-8">
        Connect Wallet
      </Button>
    );
  }

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    return (
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="black"
          shape="pill"
          size="sm"
          className="ml-8 gap-2"
          onClick={handleConnect}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {`${address.slice(0, 4)}...${address.slice(-4)}`}
        </Button>
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Connected Wallet</p>
              <p className="text-xs font-mono text-gray-600 truncate">{address}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            <Link
              href="/orders"
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Order History
            </Link>
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => {
                  disconnect();
                  setIsDropdownOpen(false);
                }}
                className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Hidden WalletMultiButton for wallet modal functionality */}
      <div ref={walletButtonRef} className="hidden">
        <WalletMultiButton />
      </div>

      <Button
        variant="black"
        shape="pill"
        size="sm"
        className="ml-8"
        onClick={handleConnect}
      >
        Connect Wallet
      </Button>
    </>
  );
}

function CartButton() {
  const { cartCount } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Link href="/checkout" className="relative p-2 text-gray-700 hover:text-gray-900 transition-colors">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
      {cartCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
          {cartCount}
        </span>
      )}
    </Link>
  );
}

export function Header() {
  const [isGetInTouchModalOpen, setIsGetInTouchModalOpen] = useState(false);
  const [isLearnMoreModalOpen, setIsLearnMoreModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check if user has already seen the waitlist modal
    const hasSeenModal = localStorage.getItem('hasSeenWaitlistModal');

    if (!hasSeenModal) {
      // Show modal after a short delay
      const timer = setTimeout(() => {
        setIsWaitlistModalOpen(true);
        localStorage.setItem('hasSeenWaitlistModal', 'true');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      <header className="fixed top-4 left-4 right-4 z-50 backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-gray-200/50 transition-all duration-300 py-4 px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-baseline gap-1.5">
              <Image
                src="/logos/BlackWeb.png"
                alt="GoldBack"
                width={100}
                height={100}
                className="object-contain"
                priority
              />
            </Link>
            <NetworkBadge />
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden xl:flex items-center gap-2">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/#whitepaper">White Paper</NavLink>
            <NavLink href="/shop-gold-backs">Shop Gold Backs</NavLink>
            {/* <NavLink href="/app">Go To App</NavLink> */}
            <NavLink href="#" isComingSoon>Merch</NavLink>
            <NavLink href="#" isComingSoon>Rewards</NavLink>
            <div className="transform transition-transform hover:scale-105 active:scale-95">
              <Button
                variant="outline"
                shape="pill"
                size="sm"
                className="hover:border-gray-300"
                onClick={() => setIsWaitlistModalOpen(true)}
              >
                Join Waitlist
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <CartButton />
            <CustomWalletButton />
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden p-2 cursor-pointer"
              aria-label="Toggle menu"
            >
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 132h416c8.837 0 16-7.163 16-16V76c0-8.837-7.163-16-16-16H16C7.163 60 0 67.163 0 76v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`xl:hidden border-t border-gray-200 overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="py-2">
            <button className="block w-full text-left px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
              Home
            </button>
          </div>
          <div className="py-2">
            <Link href="/#whitepaper" className="block px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              White Paper
            </Link>
          </div>
          <div className="py-2">
            <Link href="/shop-gold-backs" className="block px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              Shop Gold Backs
            </Link>
          </div>
          {/* <div className="py-2">
            <Link href="/app" className="block px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              Go To App
            </Link>
          </div> */}
          <div className="py-2">
            <div className="relative block px-4 py-2 rounded-xl text-sm font-medium text-gray-400 cursor-not-allowed">
              Merch<span className="ml-2 bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full">Soon</span>
            </div>
          </div>
          <div className="py-2">
            <div className="relative block px-4 py-2 rounded-xl text-sm font-medium text-gray-400 cursor-not-allowed">
              Rewards<span className="ml-2 bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full">Soon</span>
            </div>
          </div>
          <div className="py-2">
            <button
              onClick={() => {
                setIsWaitlistModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="block w-full text-left px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium cursor-pointer"
            >
              Join Waitlist
            </button>
          </div>
          <div className="py-2">
            <Link href="/checkout" className="block px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              Cart
            </Link>
          </div>

        </div>
      </header>

      {/* Modals */}
      <GetInTouchModal isOpen={isGetInTouchModalOpen} onClose={() => setIsGetInTouchModalOpen(false)} />
      <LearnMoreModal isOpen={isLearnMoreModalOpen} onClose={() => setIsLearnMoreModalOpen(false)} />
      <WaitlistModal isOpen={isWaitlistModalOpen} onClose={() => setIsWaitlistModalOpen(false)} />
    </>
  );
}

