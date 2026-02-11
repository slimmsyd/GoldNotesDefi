/**
 * API Route: /api/protocol-status
 * Returns the current W3B Protocol status from both on-chain and off-chain sources
 */

import { NextResponse } from 'next/server';
import {
  fetchProtocolStateRaw,
  merkleRootToHex,
  timestampToDate,
  calculateSolvency,
} from '@/lib/solana-program';
import {
  fetchLatestMerkleRoot,
  fetchBatchCount,
  fetchMerkleRootHistory,
} from '@/lib/supabase-protocol';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    // Fetch data in parallel
    const fetchPromises: Promise<unknown>[] = [
      fetchProtocolStateRaw(),
      fetchLatestMerkleRoot(),
      fetchBatchCount(),
    ];

    if (includeHistory) {
      fetchPromises.push(fetchMerkleRootHistory(10));
    }

    const results = await Promise.all(fetchPromises);
    const [protocolState, latestMerkleRoot, batchCount, history] = results;

    if (!protocolState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Protocol state not found on-chain',
          data: null,
        },
        { status: 404 }
      );
    }

    const state = protocolState as Awaited<ReturnType<typeof fetchProtocolStateRaw>>;
    
    if (!state) {
      return NextResponse.json(
        {
          success: false,
          error: 'Protocol state is null',
          data: null,
        },
        { status: 404 }
      );
    }

    const { isSolvent, ratio } = calculateSolvency(
      state.totalSupply,
      state.provenReserves
    );

    const responseData = {
      success: true,
      data: {
        // On-chain data
        onChain: {
          totalSupply: state.totalSupply,
          provenReserves: state.provenReserves,
          lastProofTimestamp: timestampToDate(state.lastProofTimestamp)?.toISOString() || null,
          currentMerkleRoot: merkleRootToHex(state.currentMerkleRoot),
          isPaused: state.isPaused,
        },
        
        // Computed solvency
        solvency: {
          isSolvent,
          ratio: isFinite(ratio) ? ratio : null,
          status: isSolvent ? 'SOLVENT' : 'INSOLVENT',
        },
        
        // Off-chain data
        offChain: {
          lastAuditRecord: latestMerkleRoot,
          totalBatches: batchCount,
          ...(includeHistory && { auditHistory: history }),
        },
        
        // Meta
        fetchedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error in /api/protocol-status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      },
      { status: 500 }
    );
  }
}
