'use client';

/**
 * App Header Component
 * GoldBack Design System Implementation
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

function NavLink({
  href,
  children,
  isActive,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
        isActive
          ? 'bg-gray-800 text-white shadow-lg'
          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
      }`}
    >
      {icon}
      {children}
      {isActive && (
        <motion.div
          layoutId="activeNav"
          className="absolute inset-0 bg-gray-800 rounded-xl -z-10"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </Link>
  );
}

function CustomWalletButton() {
  const { publicKey, connected, disconnect } = useWallet();
  const walletButtonRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsDropdownOpen(false);
    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (connected) {
      setIsDropdownOpen(!isDropdownOpen);
    } else {
      const button = walletButtonRef.current?.querySelector('button');
      if (button) {
        button.click();
      }
    }
  };

  if (!mounted) {
    return (
      <button className="bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-amber-400 transition-colors">
        Connect Wallet
      </button>
    );
  }

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          className="flex items-center gap-2.5 bg-gray-900/80 border border-gray-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 hover:border-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="font-mono">{`${address.slice(0, 4)}...${address.slice(-4)}`}</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50"
            >
              {/* Wallet Info */}
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-white truncate">{address}</p>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <Link
                  href="/app/profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Profile</span>
                    <p className="text-xs text-gray-500">View wallet details</p>
                  </div>
                </Link>

                <button
                  onClick={() => {
                    disconnect();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <span className="font-medium">Disconnect</span>
                    <p className="text-xs text-red-400/70">End session</p>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      <div ref={walletButtonRef} className="hidden">
        <WalletMultiButton />
      </div>

      <button
        onClick={handleConnect}
        className="bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-amber-400 active:bg-amber-600 transition-colors duration-200 shadow-lg shadow-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        Connect Wallet
      </button>
    </>
  );
}

export function AppHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/app' && pathname === '/app') return true;
    if (path !== '/app' && pathname?.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    {
      href: '/app',
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      href: '/app/swap',
      label: 'Swap',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
    {
      href: '/app/vault',
      label: 'Vault',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0A0A]/80 border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/app" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 group-hover:scale-105 transition-transform">
              <Image
                src="/logos/BlackWebTokenLogo.png"
                alt="WGB"
                width={36}
                height={36}
                className="object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                WGB
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  PROTOCOL_CONFIG.isMainnet
                    ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                    : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                }`}
              >
                {PROTOCOL_CONFIG.networkDisplay}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-2xl p-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                isActive={isActive(item.href)}
                icon={item.icon}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <CustomWalletButton />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-gray-800/50 bg-[#0A0A0A]/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive(item.href) ? 'bg-amber-500/20 text-amber-500' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {item.icon}
                  </div>
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
