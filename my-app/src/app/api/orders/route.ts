import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sp3ndService } from '@/services/sp3nd';

/**
 * GET /api/orders
 * Fetch orders for a wallet address
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

    // Fetch SP3ND orders from our database
    const sp3ndOrders = await prisma.sP3NDOrder.findMany({
      where: { userWallet: walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    // Format orders for the frontend
    const orders = sp3ndOrders.map(order => ({
      id: order.id,
      orderNumber: order.sp3ndOrderNumber,
      source: 'amazon' as const,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      trackingNumber: order.trackingNumber,
      items: order.items as Array<{ asin: string; title: string; price: string; quantity: number }>,
      shippingAddress: order.shippingAddress as { name: string; city: string; state: string },
      customerEmail: order.customerEmail,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders/refresh
 * Refresh order statuses from SP3ND API
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

    // Get orders that are not yet delivered
    const pendingOrders = await prisma.sP3NDOrder.findMany({
      where: {
        userWallet: walletAddress,
        status: { notIn: ['Delivered', 'Cancelled'] },
      },
    });

    let updated = 0;

    for (const order of pendingOrders) {
      try {
        // Fetch latest status from SP3ND
        const sp3ndResponse = await sp3ndService.getOrder(order.sp3ndOrderId);

        if (sp3ndResponse.order) {
          const sp3ndOrder = sp3ndResponse.order;

          // Update if status or tracking changed
          if (sp3ndOrder.status !== order.status || sp3ndOrder.tracking_number !== order.trackingNumber) {
            await prisma.sP3NDOrder.update({
              where: { id: order.id },
              data: {
                status: sp3ndOrder.status,
                trackingNumber: sp3ndOrder.tracking_number || null,
              },
            });
            updated++;
          }
        }
      } catch (err) {
        console.error(`Failed to refresh order ${order.sp3ndOrderNumber}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed ${updated} order(s)`,
      ordersChecked: pendingOrders.length,
      ordersUpdated: updated,
    });
  } catch (error) {
    console.error('Error refreshing orders:', error);
    return NextResponse.json(
      { error: 'Failed to refresh orders' },
      { status: 500 }
    );
  }
}
