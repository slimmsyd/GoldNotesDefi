import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { calculateShippingMethod, getAvailableShippingMethods } from '@/config/shipping-config';
import { getSolPriceUsd } from '@/lib/sol-price';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

export const runtime = 'nodejs';

type Currency = 'SOL' | 'USDC';

interface CreateDirectCheckoutRequest {
  items: Array<{ id: string; quantity: number }>;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  isInternational: boolean;
  shippingMethodId: string | null;
  currency: Currency;
}

function parseUsd(priceLabel: string): number {
  const n = parseFloat(priceLabel.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<CreateDirectCheckoutRequest>;

    const items = body.items;
    const currency = body.currency;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items is required' }, { status: 400 });
    }
    if (currency !== 'SOL' && currency !== 'USDC') {
      return NextResponse.json({ error: 'currency must be SOL or USDC' }, { status: 400 });
    }
    if (!body.customerName || !body.customerEmail || !body.shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedItems = items.map((it) => ({
      id: String(it.id),
      quantity: Math.floor(Number(it.quantity)),
    }));

    if (normalizedItems.some((it) => !it.id || !Number.isFinite(it.quantity) || it.quantity <= 0)) {
      return NextResponse.json({ error: 'Invalid items payload' }, { status: 400 });
    }

    const packages = await prisma.goldPackage.findMany({
      where: { id: { in: normalizedItems.map((i) => i.id) } },
    });

    // Ensure all requested items exist.
    if (packages.length !== new Set(normalizedItems.map((i) => i.id)).size) {
      return NextResponse.json({ error: 'One or more items not found' }, { status: 400 });
    }

    // Canonical subtotal from DB prices.
    let subtotalUsd = 0;
    const snapshotItems = normalizedItems.map((it) => {
      const pkg = packages.find((p) => p.id === it.id)!;
      const unitPriceUsd = parseUsd(pkg.price);
      if (!Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) {
        throw new Error(`Invalid price for package ${pkg.id}`);
      }
      subtotalUsd += unitPriceUsd * it.quantity;
      return {
        id: pkg.id,
        name: pkg.name,
        price: pkg.price,
        quantity: it.quantity,
        image: pkg.image,
      };
    });

    subtotalUsd = round2(subtotalUsd);

    // Shipping method validation/selection.
    const isInternational = Boolean(body.isInternational);
    const availableMethods = getAvailableShippingMethods(subtotalUsd, isInternational);
    const selectedMethodId = body.shippingMethodId ?? null;

    let method =
      selectedMethodId
        ? availableMethods.find((m) => m.id === selectedMethodId) || null
        : null;

    if (!method) {
      // If not provided or invalid, fall back to required method.
      method = calculateShippingMethod(subtotalUsd, isInternational);
    }

    // If a method id was provided but doesn't match allowed methods, reject.
    if (selectedMethodId && !availableMethods.some((m) => m.id === selectedMethodId)) {
      return NextResponse.json({ error: 'Invalid shippingMethodId for this order' }, { status: 400 });
    }

    const shippingUsd = round2(method.cost);
    const totalUsd = round2(subtotalUsd + shippingUsd);

    const merchantWallet =
      process.env.MERCHANT_WALLET_ADDRESS ||
      process.env.NEXT_PUBLIC_MERCHANT_WALLET ||
      'CrQERYcZMnENP85qZBrdimS7oz2Ura9tAPxkZJPMpbNj';

    // Generate an order id up-front so we can embed it in the memo.
    const orderId = crypto.randomUUID();
    const memo = `GoldBack Order: ${orderId}`;

    let solPriceUsd: Prisma.Decimal | null = null;
    let expectedLamports: bigint | null = null;
    let expectedUsdcBaseUnits: bigint | null = null;

    if (currency === 'USDC') {
      expectedUsdcBaseUnits = BigInt(Math.floor(totalUsd * 1_000_000));
    } else {
      const solPrice = await getSolPriceUsd();
      if (!solPrice) {
        return NextResponse.json({ error: 'Unable to fetch SOL price' }, { status: 503 });
      }
      const lamports = Math.ceil((totalUsd / solPrice) * 1_000_000_000);
      solPriceUsd = new Prisma.Decimal(solPrice.toFixed(2));
      expectedLamports = BigInt(lamports);
    }

    await prisma.directCheckoutOrder.create({
      data: {
        id: orderId,
        status: 'Created',
        network: PROTOCOL_CONFIG.network,
        currency,
        merchantWallet,
        memo,
        items: snapshotItems,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        shippingAddress: body.shippingAddress,
        isInternational,
        shippingMethod: method.name,
        subtotalUsd: new Prisma.Decimal(subtotalUsd.toFixed(2)),
        shippingUsd: new Prisma.Decimal(shippingUsd.toFixed(2)),
        totalUsd: new Prisma.Decimal(totalUsd.toFixed(2)),
        solPriceUsd: solPriceUsd ?? undefined,
        expectedLamports: expectedLamports ?? undefined,
        expectedUsdcBaseUnits: expectedUsdcBaseUnits ?? undefined,
      },
    });

    return NextResponse.json({
      success: true,
      orderId,
      memo,
      merchantWallet,
      network: PROTOCOL_CONFIG.network,
      currency,
      expectedLamports: expectedLamports ? expectedLamports.toString() : null,
      expectedUsdcBaseUnits: expectedUsdcBaseUnits ? expectedUsdcBaseUnits.toString() : null,
      subtotalUsd,
      shippingUsd,
      totalUsd,
      pointsPreview: Math.floor(subtotalUsd),
    });
  } catch (error) {
    console.error('Direct checkout create error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
