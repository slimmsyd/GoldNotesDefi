'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export interface UserProfile {
  id: string;
  walletAddress: string;
  email: string | null;
  shippingName: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string;
  isInternational: boolean;
  emailOrderUpdates: boolean;
  emailPromotions: boolean;
  savedCart: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddress {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isInternational: boolean;
}

export interface ProfileUpdateData {
  email?: string | null;
  shippingName?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string;
  isInternational?: boolean;
  emailOrderUpdates?: boolean;
  emailPromotions?: boolean;
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<boolean>;
  hasShippingAddress: boolean;
  shippingAddress: ShippingAddress | null;
}

export function useUserProfile(): UseUserProfileReturn {
  const { publicKey, connected } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58();

  const fetchProfile = useCallback(async () => {
    if (!walletAddress) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: {
          'X-Wallet-Address': walletAddress,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch profile');
      }

      setProfile(data.profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const updateProfile = useCallback(async (data: ProfileUpdateData): Promise<boolean> => {
    if (!walletAddress) {
      setError('Wallet not connected');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': walletAddress,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile');
      }

      setProfile(result.profile);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error updating profile:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Fetch profile when wallet connects
  useEffect(() => {
    if (connected && walletAddress) {
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [connected, walletAddress, fetchProfile]);

  // Derived values
  const hasShippingAddress = Boolean(
    profile?.shippingName &&
    profile?.shippingAddress &&
    profile?.shippingCity &&
    profile?.shippingState &&
    profile?.shippingZip
  );

  const shippingAddress: ShippingAddress | null = hasShippingAddress && profile
    ? {
        name: profile.shippingName!,
        address: profile.shippingAddress!,
        city: profile.shippingCity!,
        state: profile.shippingState!,
        zip: profile.shippingZip!,
        country: profile.shippingCountry,
        isInternational: profile.isInternational,
      }
    : null;

  return {
    profile,
    isLoading,
    error,
    fetchProfile,
    updateProfile,
    hasShippingAddress,
    shippingAddress,
  };
}

export default useUserProfile;
