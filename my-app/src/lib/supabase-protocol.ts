/**
 * Supabase Data Fetching for W3B Protocol
 * Reads from merkle_roots and goldback_serials tables
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MerkleRootRecord, GoldbackSerialRecord, SUPABASE_CONFIG } from './protocol-constants';

// Constants
const GOLDBACK_PRICE_USD = 9.18; // Fixed peg price (1 Goldback = ~$9.18 USD)

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
  totalValueUsd: number;
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
    totalValueUsd: stats.count * GOLDBACK_PRICE_USD,
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
