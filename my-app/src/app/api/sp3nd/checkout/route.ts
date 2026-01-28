import { NextRequest, NextResponse } from 'next/server';
import { sp3ndService, SP3NDCart, SP3NDOrder } from '@/services/sp3nd';
import { SP3ND_TREASURY_WALLET, SP3ND_MEMO_PREFIX } from '@/lib/sp3nd-constants';
import prisma from '@/lib/prisma';

interface AmazonCartItem {
  asin: string;
  amazonUrl: string;
  title: string;
  price: string;
  quantity: number;
}

interface CheckoutRequest {
  items: AmazonCartItem[];
  shippingAddress: {
    name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  email: string;
  walletAddress: string;
  testMode?: boolean;
}

/**
 * POST /api/sp3nd/checkout
 * Create SP3ND order for Amazon GoldBacks
 */
export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json();

    const { items, shippingAddress, email, walletAddress, testMode = false } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }

    if (!shippingAddress || !email || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: shippingAddress, email, walletAddress' },
        { status: 400 }
      );
    }

    console.log('=== SP3ND Checkout ===');
    console.log('Items:', items.length);
    console.log('Wallet:', walletAddress);
    console.log('Test Mode:', testMode);

    // Step 1: Create SP3ND cart with first item
    console.log('Creating SP3ND cart...');
    const firstItem = items[0];
    const cartResponse = await sp3ndService.createCart(firstItem.amazonUrl, firstItem.quantity);

    if (!cartResponse.cart) {
      throw new Error('Failed to create SP3ND cart');
    }

    let cart: SP3NDCart = cartResponse.cart;
    console.log('Cart created:', cart.cart_id);

    // Step 2: Add remaining items
    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      console.log(`Adding item ${i + 1}:`, item.title);
      const addResponse = await sp3ndService.addItem(cart.cart_id, item.amazonUrl, item.quantity);
      if (addResponse.cart) {
        cart = addResponse.cart;
      }
    }

    // Step 3: Update shipping address (calculates tax)
    console.log('Updating shipping address...');
    const shippingResponse = await sp3ndService.updateShippingAddress(cart.cart_id, shippingAddress);
    if (shippingResponse.cart) {
      cart = shippingResponse.cart;
    }

    // Step 4: Create order
    console.log('Creating order...');
    const orderResponse = await sp3ndService.createOrder(
      cart.cart_id,
      shippingAddress,
      email,
      testMode
    );

    if (!orderResponse.order) {
      throw new Error('Failed to create SP3ND order');
    }

    const order: SP3NDOrder = orderResponse.order;
    console.log('Order created:', order.order_number);

    // Step 5: Create transaction record
    console.log('Creating transaction record...');
    await sp3ndService.createTransaction(
      order.order_id,
      order.order_number,
      order.total_amount,
      walletAddress
    );

    // Step 6: Save order to our database
    console.log('Saving order to database...');
    await prisma.sP3NDOrder.create({
      data: {
        sp3ndOrderId: order.order_id,
        sp3ndOrderNumber: order.order_number,
        userWallet: walletAddress,
        customerEmail: email,
        totalAmount: order.total_amount,
        status: 'Created',
        shippingAddress: shippingAddress,
        items: items.map(item => ({
          asin: item.asin,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    });

    // Return payment instructions
    const paymentMemo = `${SP3ND_MEMO_PREFIX} ${order.order_number}`;

    // Calculate total from cart fields if cart.total is not available
    // Use order.total_amount as the authoritative total
    const cartTotal = cart.total || order.total_amount || 
      ((cart.subtotal || 0) + (cart.platform_fee || 0) + (cart.shipping || 0) + (cart.tax || 0));

    console.log('=== Cart Breakdown ===');
    console.log('Subtotal:', cart.subtotal);
    console.log('Platform Fee:', cart.platform_fee);
    console.log('Shipping:', cart.shipping);
    console.log('Tax:', cart.tax);
    console.log('Cart Total (raw):', cart.total);
    console.log('Order Total Amount:', order.total_amount);
    console.log('Final Total:', cartTotal);

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.order_id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        status: order.status,
      },
      payment: {
        recipientWallet: SP3ND_TREASURY_WALLET,
        amount: order.total_amount,
        currency: 'USDC',
        memo: paymentMemo,
      },
      cart: {
        subtotal: cart.subtotal || 0,
        platformFee: cart.platform_fee || 0,
        shipping: cart.shipping || 0,
        tax: cart.tax || 0,
        total: cartTotal,
      },
    });
  } catch (error) {
    console.error('SP3ND checkout error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
