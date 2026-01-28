'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useRef } from 'react';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';

function NavLink({ href, children, isActive }: { href: string; children: React.ReactNode; isActive: boolean }) {
  return (
    <div className="transform transition-transform hover:scale-105 active:scale-95">
      <Link
        href={href}
        className={`px-4 py-2 rounded-xl border transition-all duration-200 text-sm font-medium ${isActive
          ? 'bg-gray-800 text-white border-gray-700 shadow-lg shadow-gray-900/20'
          : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
      >
        {children}
      </Link>
    </div>
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

  const handleConnect = () => {
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
      <button className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-2 rounded-xl font-medium text-sm shadow-lg hover:shadow-amber-500/20 hover:shadow-xl transition-all transform hover:scale-105 active:scale-95">
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
          className="bg-gray-800 cursor-pointer border border-gray-700 text-white px-5 py-2 rounded-xl font-medium text-sm shadow-lg hover:bg-gray-700 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {`${address.slice(0, 4)}...${address.slice(-4)}`}
        </button>
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-2 z-50">
            <Link
              href="/app/profile"
              onClick={() => setIsDropdownOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </span>
            </Link>
            <button
              onClick={() => {
                disconnect();
                setIsDropdownOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect
              </span>
            </button>
          </div>
        )}
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
        className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-2 rounded-xl font-medium text-sm shadow-lg hover:shadow-amber-500/20 hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
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

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/80 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/app" className="flex items-center gap-2 group">
            <div className="relative w-8 h-8 transition-transform group-hover:scale-105">
              <Image
                src="/logos/BlackWeb.png"
                alt="BlackW3B"
                width={32}
                height={32}
                className="object-contain filter invert"
              />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
              BlackW3B
            </span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
              PROTOCOL_CONFIG.isMainnet 
                ? 'text-green-400 border-green-800 bg-green-900/30' 
                : 'text-amber-400 border-amber-800 bg-amber-900/30'
            }`}>
              {PROTOCOL_CONFIG.networkDisplay}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/app/swap" isActive={isActive('/app/swap')}>Swap</NavLink>
            <NavLink href="/app" isActive={isActive('/app')}>Dashboard</NavLink>
            <NavLink href="/app/vault" isActive={isActive('/app/vault')}>Vault</NavLink>
          </div>

          <div className="flex items-center gap-4">
            <CustomWalletButton />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/app/swap"
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive('/app/swap') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Swap
            </Link>
            <Link
              href="/app"
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive('/app') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/app/vault"
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive('/app/vault') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Vault
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
