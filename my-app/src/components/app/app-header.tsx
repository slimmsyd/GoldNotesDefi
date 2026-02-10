'use client';

/**
 * App Header Component
 * Obsidian Shield Design System Implementation
 *
 * Sharp edges, gold accents, institutional feel.
 * Matches the homepage header aesthetic.
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

/* ─── Framer Motion variants (matching homepage) ─── */
const smoothEase: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

const menuOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, when: 'beforeChildren' as const } },
  exit: { opacity: 0, transition: { duration: 0.2, when: 'afterChildren' as const } },
};

const menuPanel = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { duration: 0.3, ease: smoothEase } },
  exit: { x: '100%', transition: { duration: 0.25, ease: smoothEase } },
};

const menuItem = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};

/* ─── Network Badge ─── */
function NetworkBadge() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 border ${
        PROTOCOL_CONFIG.isMainnet
          ? 'bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30'
          : 'bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30'
      }`}
    >
      {PROTOCOL_CONFIG.networkDisplay}
    </span>
  );
}

/* ─── NavLink ─── */
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
      className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-150 ${
        isActive
          ? 'text-white bg-[#1a1a1a]'
          : 'text-gray-400 hover:text-[#e8d48b]'
      }`}
    >
      {icon}
      {children}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c9a84c]" />
      )}
    </Link>
  );
}

/* ─── Custom Wallet Button ─── */
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
      <button className="bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black font-bold px-5 py-1.5 text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer">
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
          className="flex items-center gap-2.5 border border-[#c9a84c]/50 text-[#e8d48b] px-4 py-1.5 font-medium text-xs hover:bg-[#c9a84c]/10 transition-all duration-150 cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 bg-green-500" />
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
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 bg-[#1a1a1a] border border-[#c9a84c]/30 shadow-2xl overflow-hidden z-50"
            >
              {/* Wallet Info */}
              <div className="px-4 py-3 border-b border-[#c9a84c]/20">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Connected Wallet</p>
                <p className="text-xs font-mono text-[#c9a84c] truncate">{address}</p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  href="/app/profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </Link>

                <div className="border-t border-[#c9a84c]/20 mt-1 pt-1">
                  <button
                    onClick={() => {
                      disconnect();
                      setIsDropdownOpen(false);
                    }}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Disconnect
                  </button>
                </div>
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
        className="bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black font-bold px-5 py-1.5 text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-[0_4px_16px_rgba(201,168,76,0.35)]"
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

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
    <>
      <header className="relative z-50 bg-[#0a0a0a] border-b-[0.5px] border-[#c9a84c]/30 h-16 px-6">
        <div className="flex items-center justify-between h-full max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/app" className="flex items-center gap-3">
              <div className="relative w-9 h-9">
                <Image
                  src="/logos/BlackWebTokenLogo.png"
                  alt="WGB"
                  width={36}
                  height={36}
                  className="object-contain drop-shadow-[0_0_8px_rgba(201,168,76,0.3)]"
                />
              </div>
              <span className="text-lg font-bold text-white">WGB</span>
            </Link>
            <NetworkBadge />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
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

          <div className="flex items-center gap-4">
            <CustomWalletButton />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-[#c9a84c] transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu - Full Screen Slide Panel (matching homepage) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            variants={menuOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-60 md:hidden"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sliding Panel */}
            <motion.div
              variants={menuPanel}
              className="absolute top-0 right-0 bottom-0 w-full bg-[#0a0a0a] flex flex-col"
            >
              {/* Mobile Menu Header */}
              <div className="flex items-center justify-between h-16 px-6 border-b border-[#c9a84c]/30">
                <Link href="/app" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3">
                  <Image
                    src="/logos/BlackWebTokenLogo.png"
                    alt="WGB"
                    width={36}
                    height={36}
                    className="object-contain"
                  />
                  <span className="text-lg font-bold text-white">WGB</span>
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile Menu Links - Staggered entrance */}
              <motion.nav
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex-1 px-6 pt-8 overflow-y-auto"
              >
                {navItems.map((item) => (
                  <motion.div key={item.label} variants={menuItem}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-5 text-lg font-medium transition-colors border-b border-white/5 ${
                        isActive(item.href)
                          ? 'text-[#e8d48b]'
                          : 'text-white hover:text-[#c9a84c]'
                      }`}
                    >
                      <span className={isActive(item.href) ? 'text-[#c9a84c]' : 'text-gray-500'}>
                        {item.icon}
                      </span>
                      {item.label}
                      {isActive(item.href) && (
                        <span className="ml-auto w-1.5 h-1.5 bg-[#c9a84c]" />
                      )}
                    </Link>
                  </motion.div>
                ))}
              </motion.nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
