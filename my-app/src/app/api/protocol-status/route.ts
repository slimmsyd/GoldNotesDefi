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

    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:26',message:'/api/protocol-status:begin',data:{includeHistory},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion agent log

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

    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:43',message:'/api/protocol-status:results',data:{hasProtocolState:!!protocolState,hasLatestMerkleRoot:!!latestMerkleRoot,hasBatchCount:typeof batchCount === 'number'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion agent log

    if (!protocolState) {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:49',message:'/api/protocol-status:protocolState:null',data:{includeHistory},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion agent log
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
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/99d0f315-4dc7-42db-8aeb-8df9844719a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:111',message:'/api/protocol-status:error',data:{message:error instanceof Error ? error.message : 'unknown',name:error instanceof Error ? error.name : 'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion agent log
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
