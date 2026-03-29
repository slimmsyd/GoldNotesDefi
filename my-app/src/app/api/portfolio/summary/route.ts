import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import prisma from '@/lib/prisma';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { resolveAuthenticatedRequest } from '@/lib/mobile-auth';
import { fetchUPMARates } from '@/lib/upma-client';

const DEFAULT_GOLDBACK_RATE = 9.02;
const WEB_RATE_PARITY_OFFSET = 0.23;

type WgbSource = 'onchain' | 'fallback';
type LoyaltySource = 'db' | 'fallback';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchOnChainWgbBalance(walletAddress: string): Promise<{ balance: number; source: WgbSource }> {
  try {
    const connection = new Connection(PROTOCOL_CONFIG.rpcEndpoint, 'confirmed');
    const owner = new PublicKey(walletAddress);
    const mint = new PublicKey(PROTOCOL_CONFIG.wgbMint);

    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(ata, 'confirmed');
    if (!accountInfo) {
      return { balance: 0, source: 'onchain' };
    }

    const tokenBalance = await connection.getTokenAccountBalance(ata, 'confirmed');
    const rawAmount = BigInt(tokenBalance.value.amount || '0');
    const decimals = tokenBalance.value.decimals || 0;

    let wholeTokens = rawAmount;
    for (let i = 0; i < decimals; i += 1) {
      wholeTokens /= BigInt(10);
    }

    const numeric = Number(wholeTokens);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return { balance: 0, source: 'fallback' };
    }

    return { balance: Math.floor(numeric), source: 'onchain' };
  } catch (error) {
    console.warn('[api/portfolio/summary] on-chain WGB lookup failed:', error);
    return { balance: 0, source: 'fallback' };
  }
}

async function fetchLoyaltyBalance(walletAddress: string): Promise<{ points: number; source: LoyaltySource }> {
  try {
    const sum = await prisma.loyaltyPointsEvent.aggregate({
      where: { walletAddress },
      _sum: { points: true },
    });

    return {
      points: sum._sum.points ?? 0,
      source: 'db',
    };
  } catch (error) {
    console.warn('[api/portfolio/summary] loyalty lookup failed:', error);
    return { points: 0, source: 'fallback' };
  }
}

async function fetchGoldbackRate(): Promise<number> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 'main' },
    select: { goldbackRatePer1GB: true },
  });

  return round2((settings?.goldbackRatePer1GB ?? DEFAULT_GOLDBACK_RATE) + WEB_RATE_PARITY_OFFSET);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedRequest(request);
    const walletAddress = auth.context?.walletAddress;

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Authentication required',
        },
        { status: 401 }
      );
    }

    const [wgb, loyalty, goldbackRateUsd, upmaRates] = await Promise.all([
      fetchOnChainWgbBalance(walletAddress),
      fetchLoyaltyBalance(walletAddress),
      fetchGoldbackRate(),
      fetchUPMARates(),
    ]);

    const portfolioUsd = round2(wgb.balance * goldbackRateUsd);

    return NextResponse.json({
      success: true,
      walletAddress,
      wgbBalance: wgb.balance,
      // Keep the legacy field during the naming transition.
      w3bBalance: wgb.balance,
      goldbackRateUsd,
      portfolioUsd,
      loyaltyPoints: loyalty.points,
      lastUpdated: new Date().toISOString(),
      dataHealth: {
        wgbSource: wgb.source,
        w3bSource: wgb.source,
        loyaltySource: loyalty.source,
      },
      upma: upmaRates ? {
        goldbackBuyBack: upmaRates.goldbackBuyBack,
        buyBackValue: round2(wgb.balance * upmaRates.goldbackBuyBack),
        goldSpot: upmaRates.goldSpot,
        silverSpot: upmaRates.silverSpot,
      } : null,
    });
  } catch (error) {
    console.error('[api/portfolio/summary] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load portfolio summary',
      },
      { status: 500 }
    );
  }
}
