'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';

interface OrderItem {
  asin?: string;
  title: string;
  price: string;
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: string;
  source: 'amazon' | 'direct';
  status: string;
  totalAmount: number;
  trackingNumber?: string;
  items: OrderItem[];
  shippingAddress?: { name: string; city: string; state: string };
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Created': 'bg-blue-100 text-blue-800',
  'Paid': 'bg-yellow-100 text-yellow-800',
  'Ordered': 'bg-purple-100 text-purple-800',
  'Shipped': 'bg-indigo-100 text-indigo-800',
  'Delivered': 'bg-green-100 text-green-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

const STATUS_ICONS: Record<string, string> = {
  'Created': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  'Paid': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  'Ordered': 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  'Shipped': 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  'Delivered': 'M5 13l4 4L19 7',
  'Cancelled': 'M6 18L18 6M6 6l12 12',
};

export default function OrdersPage() {
  const { publicKey, connected } = useWallet();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'amazon' | 'direct'>('all');

  const fetchOrders = useCallback(async () => {
    if (!publicKey) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/orders', {
        headers: {
          'X-Wallet-Address': publicKey.toBase58(),
        },
      });

      const data = await response.json();

      if (response.ok) {
        setOrders(data.orders || []);
      } else {
        showToast(data.error || 'Failed to fetch orders', 'error');
      }
    } catch {
      showToast('Failed to fetch orders', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, showToast]);

  const handleRefreshStatuses = async () => {
    if (!publicKey) return;

    setIsRefreshing(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'X-Wallet-Address': publicKey.toBase58(),
        },
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || 'Orders refreshed', 'success');
        // Refetch orders to get updated data
        fetchOrders();
      } else {
        showToast(data.error || 'Failed to refresh', 'error');
      }
    } catch {
      showToast('Failed to refresh orders', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      fetchOrders();
    }
  }, [connected, publicKey, fetchOrders]);

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.source === filter;
  });

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 font-sans">
        <Header />
        <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-light tracking-widest uppercase mb-8">
              My Orders
            </h1>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-12">
              <svg className="w-16 h-16 mx-auto text-neutral-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-neutral-600 mb-4">
                Connect your wallet to view your orders
              </p>
              <p className="text-sm text-neutral-400">
                Your order history is linked to your Solana wallet
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans">
      <Header />
      <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-light tracking-widest uppercase">
              My Orders
            </h1>
            <button
              onClick={handleRefreshStatuses}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-8">
            {(['all', 'amazon', 'direct'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                  filter === tab
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {tab === 'all' ? 'All Orders' : tab === 'amazon' ? 'Amazon' : 'Direct'}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-600 rounded-full mx-auto mb-4"></div>
              <p className="text-neutral-500">Loading orders...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredOrders.length === 0 && (
            <div className="text-center py-12 bg-neutral-50 border border-neutral-200 rounded-lg">
              <svg className="w-12 h-12 mx-auto text-neutral-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-neutral-500 mb-4">No orders found</p>
              <Link
                href="/shop-gold-backs"
                className="inline-block px-6 py-2 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-neutral-800 transition-colors"
              >
                Start Shopping
              </Link>
            </div>
          )}

          {/* Orders List */}
          {!isLoading && filteredOrders.length > 0 && (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="border border-neutral-200 rounded-lg overflow-hidden hover:border-neutral-300 transition-colors"
                >
                  {/* Order Header */}
                  <div className="bg-neutral-50 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-bold">#{order.orderNumber}</p>
                        <p className="text-xs text-neutral-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        order.source === 'amazon' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {order.source === 'amazon' ? 'Amazon via SP3ND' : 'Direct'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${
                        STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={STATUS_ICONS[order.status] || STATUS_ICONS['Created']} />
                        </svg>
                        {order.status}
                      </span>
                      <span className="font-bold">${order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="px-6 py-4">
                    <div className="space-y-2">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-neutral-600 truncate max-w-xs">{item.title}</span>
                          <span className="text-neutral-500">x{item.quantity}</span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-xs text-neutral-400">+{order.items.length - 3} more items</p>
                      )}
                    </div>

                    {/* Tracking */}
                    {order.trackingNumber && (
                      <div className="mt-4 pt-4 border-t border-neutral-100">
                        <p className="text-xs text-neutral-500">
                          Tracking: <span className="font-mono">{order.trackingNumber}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
