import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/user/profile
 * Fetch user profile by wallet address
 * Requires X-Wallet-Address header
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('X-Wallet-Address');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const profile = await prisma.userProfile.findUnique({
      where: { walletAddress },
    });

    if (!profile) {
      return NextResponse.json(
        { exists: false, profile: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      exists: true,
      profile: {
        id: profile.id,
        walletAddress: profile.walletAddress,
        email: profile.email,
        shippingName: profile.shippingName,
        shippingAddress: profile.shippingAddress,
        shippingCity: profile.shippingCity,
        shippingState: profile.shippingState,
        shippingZip: profile.shippingZip,
        shippingCountry: profile.shippingCountry,
        isInternational: profile.isInternational,
        emailOrderUpdates: profile.emailOrderUpdates,
        emailPromotions: profile.emailPromotions,
        savedCart: profile.savedCart,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/profile
 * Create or update user profile
 * Requires X-Wallet-Address header
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('X-Wallet-Address');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate email format if provided
    if (body.email && !isValidEmail(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Upsert profile (create if not exists, update if exists)
    const profile = await prisma.userProfile.upsert({
      where: { walletAddress },
      update: {
        email: body.email !== undefined ? body.email : undefined,
        shippingName: body.shippingName !== undefined ? body.shippingName : undefined,
        shippingAddress: body.shippingAddress !== undefined ? body.shippingAddress : undefined,
        shippingCity: body.shippingCity !== undefined ? body.shippingCity : undefined,
        shippingState: body.shippingState !== undefined ? body.shippingState : undefined,
        shippingZip: body.shippingZip !== undefined ? body.shippingZip : undefined,
        shippingCountry: body.shippingCountry !== undefined ? body.shippingCountry : undefined,
        isInternational: body.isInternational !== undefined ? body.isInternational : undefined,
        emailOrderUpdates: body.emailOrderUpdates !== undefined ? body.emailOrderUpdates : undefined,
        emailPromotions: body.emailPromotions !== undefined ? body.emailPromotions : undefined,
      },
      create: {
        walletAddress,
        email: body.email || null,
        shippingName: body.shippingName || null,
        shippingAddress: body.shippingAddress || null,
        shippingCity: body.shippingCity || null,
        shippingState: body.shippingState || null,
        shippingZip: body.shippingZip || null,
        shippingCountry: body.shippingCountry || 'US',
        isInternational: body.isInternational || false,
        emailOrderUpdates: body.emailOrderUpdates !== undefined ? body.emailOrderUpdates : true,
        emailPromotions: body.emailPromotions !== undefined ? body.emailPromotions : false,
      },
    });

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        walletAddress: profile.walletAddress,
        email: profile.email,
        shippingName: profile.shippingName,
        shippingAddress: profile.shippingAddress,
        shippingCity: profile.shippingCity,
        shippingState: profile.shippingState,
        shippingZip: profile.shippingZip,
        shippingCountry: profile.shippingCountry,
        isInternational: profile.isInternational,
        emailOrderUpdates: profile.emailOrderUpdates,
        emailPromotions: profile.emailPromotions,
        savedCart: profile.savedCart,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    return NextResponse.json(
      { error: 'Failed to save profile' },
      { status: 500 }
    );
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
