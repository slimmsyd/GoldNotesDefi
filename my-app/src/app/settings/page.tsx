'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/context/ToastContext';
import { useCart, CartItem } from '@/context/CartContext';

// Countries list (ISO 3166-1 alpha-2 codes)
const COUNTRIES = [
  { value: '', label: 'Select Country' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'CN', label: 'China' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'AT', label: 'Austria' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'IE', label: 'Ireland' },
  { value: 'PT', label: 'Portugal' },
  { value: 'PL', label: 'Poland' },
  { value: 'CZ', label: 'Czech Republic' },
  { value: 'HU', label: 'Hungary' },
  { value: 'RO', label: 'Romania' },
  { value: 'GR', label: 'Greece' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SG', label: 'Singapore' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'TH', label: 'Thailand' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'PH', label: 'Philippines' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'VN', label: 'Vietnam' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'IL', label: 'Israel' },
  { value: 'TR', label: 'Turkey' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'EG', label: 'Egypt' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'KE', label: 'Kenya' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Peru' },
  { value: 'UA', label: 'Ukraine' },
  { value: 'RU', label: 'Russia' },
];

// US States for dropdown
const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// Canadian Provinces
const CA_PROVINCES = [
  { value: '', label: 'Select Province' },
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

// Australian States/Territories
const AU_STATES = [
  { value: '', label: 'Select State/Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'WA', label: 'Western Australia' },
];

// Helper to get region options based on country
function getRegionOptions(countryCode: string) {
  switch (countryCode) {
    case 'US':
      return { options: US_STATES, label: 'State', placeholder: 'Select State' };
    case 'CA':
      return { options: CA_PROVINCES, label: 'Province', placeholder: 'Select Province' };
    case 'AU':
      return { options: AU_STATES, label: 'State/Territory', placeholder: 'Select State/Territory' };
    default:
      return { options: null, label: 'State/Province/Region', placeholder: 'Enter region' };
  }
}

// Helper to get postal code label based on country
function getPostalCodeLabel(countryCode: string) {
  switch (countryCode) {
    case 'US':
      return 'ZIP Code';
    case 'GB':
      return 'Postcode';
    case 'CA':
    case 'AU':
    case 'NZ':
      return 'Postal Code';
    default:
      return 'Postal Code';
  }
}

export default function SettingsPage() {
  const { publicKey, connected } = useWallet();
  const { profile, isLoading, updateProfile, fetchProfile } = useUserProfile();
  const { showToast } = useToast();
  const { cartItems, cartCount, loadSavedCart } = useCart();

  // Loyalty points state
  const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
  const [loyaltyEvents, setLoyaltyEvents] = useState<Array<{ id: string; source: string; points: number; createdAt: string }>>([]);
  const [isLoadingLoyalty, setIsLoadingLoyalty] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [emailOrderUpdates, setEmailOrderUpdates] = useState(true);
  const [emailPromotions, setEmailPromotions] = useState(false);

  const [shippingName, setShippingName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [shippingCountry, setShippingCountry] = useState('');

  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  const [isSavingCart, setIsSavingCart] = useState(false);
  const [isLoadingCart, setIsLoadingCart] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setEmail(profile.email || '');
      setEmailOrderUpdates(profile.emailOrderUpdates);
      setEmailPromotions(profile.emailPromotions);
      setShippingName(profile.shippingName || '');
      setShippingAddress(profile.shippingAddress || '');
      setShippingCity(profile.shippingCity || '');
      setShippingState(profile.shippingState || '');
      setShippingZip(profile.shippingZip || '');
      setShippingCountry(profile.shippingCountry || '');
    }
  }, [profile]);

  // Fetch loyalty balance for connected wallet
  useEffect(() => {
    const fetchLoyalty = async () => {
      if (!publicKey || !connected) {
        setLoyaltyBalance(null);
        setLoyaltyEvents([]);
        return;
      }

      setIsLoadingLoyalty(true);
      try {
        const res = await fetch('/api/loyalty/balance', {
          method: 'GET',
          headers: {
            'X-Wallet-Address': publicKey.toBase58(),
          },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch loyalty balance');
        }
        setLoyaltyBalance(data.balance ?? 0);
        setLoyaltyEvents(Array.isArray(data.events) ? data.events : []);
      } catch (err: any) {
        console.warn('Failed to fetch loyalty balance:', err);
        setLoyaltyBalance(null);
        setLoyaltyEvents([]);
      } finally {
        setIsLoadingLoyalty(false);
      }
    };

    fetchLoyalty();
  }, [publicKey, connected]);

  const handleSaveEmail = async () => {
    setIsSavingEmail(true);
    const success = await updateProfile({
      email: email || null,
      emailOrderUpdates,
      emailPromotions,
    });
    setIsSavingEmail(false);
    if (success) {
      showToast('Email settings saved', 'success');
    } else {
      showToast('Failed to save email settings', 'error');
    }
  };

  const handleSaveShipping = async () => {
    setIsSavingShipping(true);
    const success = await updateProfile({
      shippingName: shippingName || null,
      shippingAddress: shippingAddress || null,
      shippingCity: shippingCity || null,
      shippingState: shippingState || null,
      shippingZip: shippingZip || null,
      shippingCountry: shippingCountry || undefined,
      isInternational: shippingCountry !== 'US' && shippingCountry !== '',
    });
    setIsSavingShipping(false);
    if (success) {
      showToast('Shipping address saved', 'success');
    } else {
      showToast('Failed to save shipping address', 'error');
    }
  };

  // Get region options based on selected country
  const regionConfig = getRegionOptions(shippingCountry);
  const postalCodeLabel = getPostalCodeLabel(shippingCountry);

  const handleSaveCart = async () => {
    if (!publicKey) return;

    setIsSavingCart(true);
    try {
      const response = await fetch('/api/user/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': publicKey.toBase58(),
        },
        body: JSON.stringify({ cart: cartItems }),
      });

      if (response.ok) {
        showToast(`Cart saved (${cartCount} items)`, 'success');
        fetchProfile(); // Refresh profile to update savedCart
      } else {
        showToast('Failed to save cart', 'error');
      }
    } catch {
      showToast('Failed to save cart', 'error');
    }
    setIsSavingCart(false);
  };

  const handleLoadCart = async () => {
    if (!publicKey || !profile?.savedCart) return;

    setIsLoadingCart(true);
    try {
      const savedCartArray = profile.savedCart as unknown[];
      if (Array.isArray(savedCartArray) && savedCartArray.length > 0) {
        loadSavedCart(savedCartArray as CartItem[]);
        showToast(`Loaded ${savedCartArray.length} item${savedCartArray.length !== 1 ? 's' : ''} to cart`, 'success');
      } else {
        showToast('No items in saved cart', 'info');
      }
    } catch {
      showToast('Failed to load saved cart', 'error');
    }
    setIsLoadingCart(false);
  };

  const handleClearSavedCart = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch('/api/user/cart', {
        method: 'DELETE',
        headers: {
          'X-Wallet-Address': publicKey.toBase58(),
        },
      });

      if (response.ok) {
        showToast('Saved cart cleared', 'success');
        fetchProfile();
      } else {
        showToast('Failed to clear saved cart', 'error');
      }
    } catch {
      showToast('Failed to clear saved cart', 'error');
    }
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 font-sans">
        <Header />
        <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-light tracking-widest uppercase mb-8">
              Account Settings
            </h1>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-12">
              <svg className="w-16 h-16 mx-auto text-neutral-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-neutral-600 mb-4">
                Connect your wallet to access account settings
              </p>
              <p className="text-sm text-neutral-400">
                Your profile is linked to your Solana wallet address
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const savedCartItems = Array.isArray(profile?.savedCart) ? profile.savedCart : [];
  const savedCartCount = savedCartItems.length;

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans">
      <Header />
      <main className="pt-32 pb-24 px-6 md:px-12 lg:px-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <h1 className="text-3xl font-light tracking-widest uppercase">
              Account Settings
            </h1>
            <div className="text-right">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Connected</p>
              <p className="text-sm font-mono text-neutral-600">
                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
              </p>
            </div>
          </div>

          {/* Loyalty Points Section */}
          <section className="mb-12">
            <h2 className="text-lg font-medium tracking-wider uppercase mb-6 pb-2 border-b border-neutral-200">
              Loyalty Points
            </h2>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Current Balance</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {isLoadingLoyalty ? '…' : (loyaltyBalance ?? 0)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-2">
                    Earn 1 point per $1 subtotal on direct checkout purchases.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Wallet</p>
                  <p className="text-xs font-mono text-neutral-600 break-all">
                    {publicKey?.toBase58()}
                  </p>
                </div>
              </div>

              {loyaltyEvents.length > 0 && (
                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider mb-3">Recent Events</p>
                  <div className="space-y-2">
                    {loyaltyEvents.slice(0, 5).map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600">
                          {e.source.replace(/_/g, ' ')}
                          <span className="text-xs text-neutral-400 ml-2">
                            {new Date(e.createdAt).toLocaleDateString()}
                          </span>
                        </span>
                        <span className="font-medium text-green-700 tabular-nums">+{e.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {isLoading && !profile && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-600 rounded-full mx-auto mb-4"></div>
              <p className="text-neutral-500">Loading profile...</p>
            </div>
          )}

          {/* Email Notifications Section */}
          <section className="mb-12">
            <h2 className="text-lg font-medium tracking-wider uppercase mb-6 pb-2 border-b border-neutral-200">
              Email Notifications
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="emailOrderUpdates"
                  checked={emailOrderUpdates}
                  onChange={(e) => setEmailOrderUpdates(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                />
                <label htmlFor="emailOrderUpdates" className="text-sm text-neutral-600">
                  Receive order updates and shipping notifications
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="emailPromotions"
                  checked={emailPromotions}
                  onChange={(e) => setEmailPromotions(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                />
                <label htmlFor="emailPromotions" className="text-sm text-neutral-600">
                  Receive promotions and special offers
                </label>
              </div>
              <button
                onClick={handleSaveEmail}
                disabled={isSavingEmail}
                className="mt-4 px-6 py-2 bg-neutral-900 text-white text-sm font-medium uppercase tracking-wider rounded hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSavingEmail ? 'Saving...' : 'Save Email Settings'}
              </button>
            </div>
          </section>

          {/* Shipping Address Section */}
          <section className="mb-12">
            <h2 className="text-lg font-medium tracking-wider uppercase mb-6 pb-2 border-b border-neutral-200">
              Shipping Address
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-2">Full Name</label>
                <input
                  type="text"
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-2">Street Address</label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="123 Main St"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-2">Country</label>
                <select
                  value={shippingCountry}
                  onChange={(e) => {
                    setShippingCountry(e.target.value);
                    // Reset state when country changes if switching between dropdown and text input
                    const newRegionConfig = getRegionOptions(e.target.value);
                    const oldRegionConfig = getRegionOptions(shippingCountry);
                    if ((newRegionConfig.options === null) !== (oldRegionConfig.options === null)) {
                      setShippingState('');
                    }
                  }}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors bg-white"
                >
                  {COUNTRIES.map(country => (
                    <option key={country.value} value={country.value}>{country.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-neutral-600 mb-2">City</label>
                  <input
                    type="text"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder="Enter city"
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600 mb-2">{regionConfig.label}</label>
                  {regionConfig.options ? (
                    <select
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors bg-white"
                    >
                      {regionConfig.options.map(region => (
                        <option key={region.value} value={region.value}>{region.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      placeholder={regionConfig.placeholder}
                      className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm text-neutral-600 mb-2">{postalCodeLabel}</label>
                  <input
                    type="text"
                    value={shippingZip}
                    onChange={(e) => setShippingZip(e.target.value)}
                    placeholder="Enter postal code"
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors"
                  />
                </div>
              </div>
              {shippingCountry && shippingCountry !== 'US' && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>International shipping rates may apply for orders outside the United States.</span>
                </div>
              )}
              <button
                onClick={handleSaveShipping}
                disabled={isSavingShipping}
                className="mt-4 px-6 py-2 bg-neutral-900 text-white text-sm font-medium uppercase tracking-wider rounded hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSavingShipping ? 'Saving...' : 'Save Shipping Address'}
              </button>
            </div>
          </section>

          {/* Saved Cart Section */}
          <section className="mb-12">
            <h2 className="text-lg font-medium tracking-wider uppercase mb-6 pb-2 border-b border-neutral-200">
              Saved Cart
            </h2>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-neutral-600">
                    {savedCartCount > 0
                      ? `${savedCartCount} item${savedCartCount !== 1 ? 's' : ''} saved`
                      : 'No saved cart'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Current cart: {cartCount} item{cartCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSaveCart}
                  disabled={isSavingCart || cartCount === 0}
                  className="px-4 py-2 bg-neutral-900 text-white text-xs font-medium uppercase tracking-wider rounded hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSavingCart ? 'Saving...' : 'Save Current Cart'}
                </button>
                {savedCartCount > 0 && (
                  <>
                    <button
                      onClick={handleLoadCart}
                      disabled={isLoadingCart}
                      className="px-4 py-2 bg-amber-500 text-white text-xs font-medium uppercase tracking-wider rounded hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isLoadingCart ? 'Loading...' : 'Load Saved Cart'}
                    </button>
                    <button
                      onClick={handleClearSavedCart}
                      className="px-4 py-2 border border-red-300 text-red-600 text-xs font-medium uppercase tracking-wider rounded hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Clear Saved Cart
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Wallet Info Section */}
          <section>
            <h2 className="text-lg font-medium tracking-wider uppercase mb-6 pb-2 border-b border-neutral-200">
              Wallet
            </h2>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">Connected Wallet</p>
              <p className="font-mono text-sm text-neutral-700 break-all">
                {publicKey?.toBase58()}
              </p>
              <p className="text-xs text-neutral-400 mt-4">
                Your profile is linked to this wallet address. Connect with the same wallet to access your settings on any device.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
