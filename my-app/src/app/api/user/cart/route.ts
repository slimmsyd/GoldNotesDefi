import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * GET /api/user/cart
 * Fetch saved cart for a wallet address
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
      select: { savedCart: true },
    });

    if (!profile) {
      return NextResponse.json({
        exists: false,
        cart: null,
      });
    }

    return NextResponse.json({
      exists: true,
      cart: profile.savedCart,
    });
  } catch (error) {
    console.error('Error fetching saved cart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved cart' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/cart
 * Save cart for a wallet address
 * Requires X-Wallet-Address header
 * Body: { cart: CartItem[] }
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
    const { cart } = body;

    // Validate cart is an array
    if (cart !== null && !Array.isArray(cart)) {
      return NextResponse.json(
        { error: 'Cart must be an array or null' },
        { status: 400 }
      );
    }

    // Upsert: create profile if doesn't exist, update savedCart
    const profile = await prisma.userProfile.upsert({
      where: { walletAddress },
      update: {
        savedCart: cart,
      },
      create: {
        walletAddress,
        savedCart: cart,
      },
    });

    return NextResponse.json({
      success: true,
      cart: profile.savedCart,
    });
  } catch (error) {
    console.error('Error saving cart:', error);
    return NextResponse.json(
      { error: 'Failed to save cart' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/cart
 * Clear saved cart for a wallet address
 * Requires X-Wallet-Address header
 */
export async function DELETE(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('X-Wallet-Address');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    await prisma.userProfile.update({
      where: { walletAddress },
      data: { savedCart: Prisma.JsonNull },
    });

    return NextResponse.json({
      success: true,
      message: 'Cart cleared',
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}
