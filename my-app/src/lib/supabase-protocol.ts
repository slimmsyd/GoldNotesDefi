/**
 * Supabase Data Fetching for W3B Protocol
 * Reads from merkle_roots and goldback_serials tables
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MerkleRootRecord, GoldbackSerialRecord, SUPABASE_CONFIG } from './protocol-constants';

// Note: Goldback price is now fetched dynamically from /api/goldback-rate
// The price is stored in the database via the cron job and updated every 15 minutes

// Create Supabase client for the Blockchain project

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_W3B_SUPABASE_URL || SUPABASE_CONFIG.url;
  const anonKey = process.env.NEXT_PUBLIC_W3B_SUPABASE_ANON_KEY;
  
  // Debug log for production issues
  if (typeof window !== 'undefined') {
    console.log('Supabase Config Debug:', {
      url,
      anonKeyLength: anonKey?.length || 0,
      anonKeyStart: anonKey ? anonKey.substring(0, 10) + '...' : 'undefined',
      anonKeyEnd: anonKey ? '...' + anonKey.substring(anonKey.length - 10) : 'undefined'
    });
  }
  
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_W3B_SUPABASE_ANON_KEY is not set');
  }
  
  return createClient(url, anonKey);
}

/**
 * Fetch the most recent merkle root record
 */
export async function fetchLatestMerkleRoot(): Promise<MerkleRootRecord | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('merkle_roots')
    .select('*')
    .order('anchored_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    // No rows is not an error for our purposes
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching merkle root:', error);
    throw error;
  }
  
  return data as MerkleRootRecord;
}

/**
 * Fetch merkle root history (for audit trail display)
 */
export async function fetchMerkleRootHistory(limit = 10): Promise<MerkleRootRecord[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('merkle_roots')
    .select('*')
    .order('anchored_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching merkle root history:', error);
    throw error;
  }
  
  return (data || []) as MerkleRootRecord[];
}

/**
 * Get total count of unique batches
 */
export async function fetchBatchCount(): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('goldback_serials')
    .select('batch_id')
    .limit(1000); // Reasonable limit
  
  if (error) {
    console.error('Error fetching batch count:', error);
    throw error;
  }
  
  // Count unique batch IDs
  const uniqueBatches = new Set(data?.map(row => row.batch_id) || []);
  return uniqueBatches.size;
}

/**
 * Get total count of goldback serials in the database
 */
export async function fetchTotalSerials(): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { count, error } = await supabase
    .from('goldback_serials')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error fetching total serials:', error);
    throw error;
  }
  
  return count || 0;
}

/**
 * Batch stats for dashboard display
 */
export interface BatchStats {
  batchId: string;
  serialCount: number;
  totalValueUsd: number | null; // Calculated dynamically in UI using current goldback price
  latestReceived: string;
  earliestReceived: string;
  isAnchored: boolean;
  anchoredRoot: string | null;
}

export async function fetchBatchStats(): Promise<BatchStats[]> {
  const supabase = getSupabaseClient();
  
  // Get all serials with their anchor status
  const { data, error } = await supabase
    .from('goldback_serials')
    .select('batch_id, received_at, included_in_root')
    .order('received_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching batch stats:', error);
    throw error;
  }
  
  // Aggregate by batch_id
  const batchMap = new Map<string, { 
    count: number; 
    latest: string; 
    earliest: string;
    anchoredRoot: string | null;
  }>();
  
  for (const row of data || []) {
    const existing = batchMap.get(row.batch_id);
    if (existing) {
      existing.count++;
      if (row.received_at > existing.latest) {
        existing.latest = row.received_at;
      }
      if (row.received_at < existing.earliest) {
        existing.earliest = row.received_at;
      }
      // If any serial in batch is anchored, batch is anchored
      if (row.included_in_root && !existing.anchoredRoot) {
        existing.anchoredRoot = row.included_in_root;
      }
    } else {
      batchMap.set(row.batch_id, { 
        count: 1, 
        latest: row.received_at,
        earliest: row.received_at,
        anchoredRoot: row.included_in_root || null,
      });
    }
  }
  
  // Sort by latest received (newest first)
  const sortedBatches = Array.from(batchMap.entries())
    .sort((a, b) => new Date(b[1].latest).getTime() - new Date(a[1].latest).getTime());
  
  return sortedBatches.map(([batchId, stats]) => ({
    batchId,
    serialCount: stats.count,
    totalValueUsd: null, // Calculated dynamically in UI with current goldback price
    latestReceived: stats.latest,
    earliestReceived: stats.earliest,
    isAnchored: stats.anchoredRoot !== null,
    anchoredRoot: stats.anchoredRoot,
  }));
}

/**
 * Get recent serials for the visualizer stream
 */
export async function fetchRecentSerials(limit = 50): Promise<GoldbackSerialRecord[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('goldback_serials')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching recent serials:', error);
    throw error;
  }
  
  return (data || []) as unknown as GoldbackSerialRecord[];
}

// ==================== REDEMPTION ====================

export interface RedemptionRecord {
  id: string;
  user_wallet: string;
  request_id: number;
  amount: number;
  status: number; // 0=Pending, 1=Claimed, 2=Shipped, 3=Confirmed, 4=Cancelled
  fulfiller_wallet: string | null;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  tracking_number: string | null;
  burn_tx_hash: string | null;
  created_at: string;
  claimed_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
}

const REDEMPTION_STATUS_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Claimed',
  2: 'Shipped',
  3: 'Confirmed',
  4: 'Cancelled',
};

export function getRedemptionStatusLabel(status: number): string {
  return REDEMPTION_STATUS_LABELS[status] || 'Unknown';
}

/**
 * Fetch all redemption requests for a specific user wallet
 */
export async function fetchUserRedemptions(wallet: string): Promise<RedemptionRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('redemption_requests')
    .select('*')
    .eq('user_wallet', wallet)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching user redemptions (table may not exist yet):', error.message);
    return [];
  }

  return (data || []) as RedemptionRecord[];
}

/**
 * Fetch pending redemption requests available for P2P fulfillers
 */
export async function fetchPendingRedemptions(): Promise<RedemptionRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('redemption_requests')
    .select('*')
    .eq('status', 0)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Error fetching pending redemptions (table may not exist yet):', error.message);
    return [];
  }

  return (data || []) as RedemptionRecord[];
}

// ==================== USER PROFILES ====================

export interface UserProfileRecord {
  id: string;
  wallet: string;
  points: number;
  tier: number;
  total_volume: number;
  total_redeemed: number;
  total_fulfilled: number;
  fulfiller_rewards: number;
  display_name: string | null;
  is_fulfiller: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch user profile from off-chain cache
 */
export async function fetchUserProfile(wallet: string): Promise<UserProfileRecord | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet', wallet)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.warn('Error fetching user profile (table may not exist yet):', error.message);
    return null;
  }

  return data as UserProfileRecord;
}

/**
 * Fetch leaderboard (top users by points)
 */
export async function fetchLeaderboard(limit = 20): Promise<UserProfileRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('points', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('Error fetching leaderboard (table may not exist yet):', error.message);
    return [];
  }

  return (data || []) as UserProfileRecord[];
}
