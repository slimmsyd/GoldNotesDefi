/**
 * App Dashboard Layout
 * Route: /app
 *
 * Provides the authenticated shell with AppHeader and dark theme
 * Uses GoldBack Design System tokens
 */

import { AppHeader } from '@/components/app/app-header';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-60 h-60 bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      <AppHeader />

      <main className="relative flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-gray-800/50 bg-[#0A0A0A]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              <span>GoldBack Protocol</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-gray-300 transition-colors">Docs</a>
              <a href="#" className="hover:text-gray-300 transition-colors">GitHub</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
