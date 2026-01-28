/**
 * App Dashboard Layout
 * Route: /app
 * 
 * Provides the authenticated shell with AppHeader and dark theme
 */

import { AppHeader } from '@/components/app/app-header';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <AppHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
