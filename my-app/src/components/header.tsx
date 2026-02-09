'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GetInTouchModal } from './get-in-touch-modal';
import { LearnMoreModal } from './learn-more-modal';
import { WaitlistModal } from './waitlist-modal';
import { useCart } from '@/context/CartContext';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

/* ─── Scroll-inversion hook ─── */
function useScrollInverted(threshold = 50) {
  const [isInverted, setIsInverted] = useState(false);

  const handleScroll = useCallback(() => {
    setIsInverted(window.scrollY > threshold);
  }, [threshold]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return isInverted;
}

/* ─── Framer Motion variants ─── */
const menuOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, when: 'beforeChildren' } },
  exit: { opacity: 0, transition: { duration: 0.2, when: 'afterChildren' } },
};

const smoothEase: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

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


function NetworkBadge() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 border ${PROTOCOL_CONFIG.isMainnet
      ? 'bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      }`}>
      {PROTOCOL_CONFIG.networkDisplay}
    </span>
  );
}




interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  isComingSoon?: boolean;
  isInverted?: boolean;
}

function NavLink({ href, children, isComingSoon = false, isInverted = false }: NavLinkProps) {
  if (isComingSoon) {
    return (
      <div className={`relative px-3 py-2 text-sm font-medium cursor-not-allowed ${
        isInverted ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {children}
        <span className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 uppercase font-mono bg-[#c9a84c]/20 text-[#c9a84c] leading-none">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium hover:text-[#c9a84c] transition-colors ${
        isInverted ? 'text-gray-700' : 'text-gray-300'
      }`}
    >
      {children}
    </Link>
  );
}

function CustomWalletButton({ isInverted = false }: { isInverted?: boolean }) {
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

  const walletBtnClass = isInverted
    ? 'ml-4 px-4 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors'
    : 'ml-4 px-4 py-1.5 text-xs font-medium border border-[#c9a84c]/50 text-[#e8d48b] hover:bg-[#c9a84c]/10 transition-colors';

  if (!mounted) {
    return (
      <button className={walletBtnClass}>
        Connect Wallet
      </button>
    );
  }

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          className={`${walletBtnClass} flex items-center gap-2`}
          onClick={handleConnect}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {`${address.slice(0, 4)}...${address.slice(-4)}`}
        </button>
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-[#1a1a1a] shadow-lg border border-[#c9a84c]/30 py-2 z-50">
            <div className="px-4 py-2 border-b border-[#c9a84c]/20">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Connected Wallet</p>
              <p className="text-xs font-mono text-[#c9a84c] truncate">{address}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            <Link
              href="/orders"
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Order History
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

      <button
        className={`${walletBtnClass} cursor-pointer`}
        onClick={handleConnect}
      >
        Connect Wallet
      </button>
    </>
  );
}

function CartButton({ isInverted = false }: { isInverted?: boolean }) {
  const { cartCount } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Link href="/checkout" className={`relative p-2 hover:text-[#c9a84c] transition-colors ${
      isInverted ? 'text-gray-700' : 'text-gray-300'
    }`}>
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
  const isInverted = useScrollInverted(50);

  useEffect(() => {
    const hasSeenModal = localStorage.getItem('hasSeenWaitlistModal');
    if (!hasSeenModal) {
      const timer = setTimeout(() => {
        setIsWaitlistModalOpen(true);
        localStorage.setItem('hasSeenWaitlistModal', 'true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  return (
    <>
      <motion.header
        animate={isInverted ? 'scrolled' : 'top'}
        variants={{
          top: { backgroundColor: 'rgba(10, 10, 10, 0.95)' },
          scrolled: { backgroundColor: 'rgba(255, 255, 255, 0.97)' },
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b transition-colors duration-150 h-16 px-6 ${
          isInverted ? 'border-gray-200' : 'border-[#c9a84c]/30'
        }`}
      >
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center">
              <Image
                src="/logos/BlackWebLogo_v3.png"
                alt="BlackW3B"
                width={40}
                height={32}
                className={`object-contain transition-all duration-150 ${isInverted ? 'brightness-0' : ''}`}
                priority
              />
            </Link>
            <NetworkBadge />
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden xl:flex items-center gap-2">
            <NavLink href="/" isInverted={isInverted}>Home</NavLink>
            <NavLink href="/#whitepaper" isInverted={isInverted}>White Paper</NavLink>
            <NavLink href="/shop-gold-backs" isInverted={isInverted}>Shop Gold Backs</NavLink>
            <NavLink href="#" isComingSoon isInverted={isInverted}>Merch</NavLink>
            <NavLink href="#" isComingSoon isInverted={isInverted}>Rewards</NavLink>
            <button
              className={`text-xs font-bold px-5 py-2 transition-all cursor-pointer active:scale-95 ${
                isInverted
                  ? 'bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]'
                  : 'bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black hover:brightness-110'
              }`}
              onClick={() => setIsWaitlistModalOpen(true)}
            >
              Join Waitlist
            </button>
          </div>

          <div className="flex items-center gap-4">
            <CartButton isInverted={isInverted} />
            <CustomWalletButton isInverted={isInverted} />

            {/* Animated Hamburger / X toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`xl:hidden p-2 transition-colors cursor-pointer ${
                isInverted ? 'text-gray-700 hover:text-[#c9a84c]' : 'text-gray-300 hover:text-[#c9a84c]'
              }`}
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
      </motion.header>

      {/* Mobile Menu - Animated Full Screen Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            variants={menuOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-60 xl:hidden"
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
                <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
                  <Image
                    src="/logos/BlackWebLogo_v3.png"
                    alt="BlackW3B"
                    width={40}
                    height={32}
                    className="object-contain"
                  />
                </Link>
                <div className="flex items-center gap-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black text-xs font-bold px-5 py-2 cursor-pointer hover:brightness-110 transition-all"
                    onClick={() => {
                      setIsWaitlistModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Join Waitlist
                  </motion.button>
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
              </div>

              {/* Mobile Menu Links - Staggered entrance */}
              <motion.nav
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex-1 px-6 pt-8 overflow-y-auto"
              >
                {[
                  { href: '/', label: 'Home' },
                  { href: '/#whitepaper', label: 'White Paper' },
                  { href: '/shop-gold-backs', label: 'Shop Gold Backs' },
                  { href: '#', label: 'Merch', comingSoon: true },
                  { href: '#', label: 'Rewards', comingSoon: true },
                  { href: '/checkout', label: 'Cart' },
                ].map((item) => (
                  <motion.div key={item.label} variants={menuItem}>
                    {item.comingSoon ? (
                      <div className="flex items-center gap-3 px-4 py-5 text-gray-500 text-lg font-medium cursor-not-allowed border-b border-white/5">
                        {item.label}
                        <span className="text-[10px] px-2 py-0.5 uppercase font-mono bg-[#c9a84c]/20 text-[#c9a84c]">
                          Soon
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block px-4 py-5 text-white text-lg font-medium hover:text-[#c9a84c] transition-colors border-b border-white/5"
                      >
                        {item.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
              </motion.nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <GetInTouchModal isOpen={isGetInTouchModalOpen} onClose={() => setIsGetInTouchModalOpen(false)} />
      <LearnMoreModal isOpen={isLearnMoreModalOpen} onClose={() => setIsLearnMoreModalOpen(false)} />
      <WaitlistModal isOpen={isWaitlistModalOpen} onClose={() => setIsWaitlistModalOpen(false)} />
    </>
  );
}

