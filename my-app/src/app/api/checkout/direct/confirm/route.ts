import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PROTOCOL_CONFIG } from '@/lib/protocol-constants';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export const runtime = 'nodejs';

const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

interface ConfirmDirectCheckoutRequest {
  orderId: string;
  txSignature: string;
}

function asPubkeyString(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  // Parsed transactions sometimes use PublicKey objects.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyV = v as any;
  if (typeof anyV?.toBase58 === 'function') return anyV.toBase58();
  if (typeof anyV?.pubkey === 'string') return anyV.pubkey;
  if (typeof anyV?.pubkey?.toBase58 === 'function') return anyV.pubkey.toBase58();
  return null;
}

function instructionMemoMatches(ix: unknown, expectedMemo: string): boolean {
  if (!ix) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyIx = ix as any;
  const programId = asPubkeyString(anyIx.programId);
  if (programId !== MEMO_PROGRAM_ID) return false;

  if (typeof anyIx.parsed === 'string') return anyIx.parsed === expectedMemo;

  // Some RPCs parse memo as { type: 'memo', info: { memo: string } }.
  const memo =
    (typeof anyIx.parsed?.info?.memo === 'string' && anyIx.parsed.info.memo) ||
    (typeof anyIx.parsed?.memo === 'string' && anyIx.parsed.memo) ||
    null;

  return memo === expectedMemo;
}

async function postFulfillmentWebhook(payload: unknown): Promise<void> {
  const webhookUrl =
    process.env.N8N_CHECKOUT_WEBHOOK_URL ||
    'https://oncode.app.n8n.cloud/webhook/40f3a2d0-8390-44c8-a2af-b3add7651a9c';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
    } catch (err) {
      if (attempt === 3) {
        console.error('Fulfillment webhook failed:', err);
      }
    }

    // Exponential backoff
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ConfirmDirectCheckoutRequest>;
    const orderId = body.orderId;
    const txSignature = body.txSignature;

    if (!orderId || !txSignature) {
      return NextResponse.json({ error: 'orderId and txSignature are required' }, { status: 400 });
    }

    const order = await prisma.directCheckoutOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Idempotency: if already paid, return existing event/balance.
    if (order.status === 'Paid' && order.buyerWallet) {
      const sum = await prisma.loyaltyPointsEvent.aggregate({
        where: { walletAddress: order.buyerWallet },
        _sum: { points: true },
      });
      const existingEvent = await prisma.loyaltyPointsEvent.findUnique({
        where: { orderId: order.id },
      });

      return NextResponse.json({
        success: true,
        status: 'Paid',
        walletAddress: order.buyerWallet,
        pointsAwarded: existingEvent?.points ?? 0,
        newBalance: sum._sum.points ?? 0,
        txSignature: order.txSignature,
      });
    }

    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || PROTOCOL_CONFIG.rpcEndpoint;
    const connection = new Connection(rpcEndpoint, 'confirmed');

    const tx = await connection.getParsedTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta) {
      return NextResponse.json({ error: 'Transaction not found or not confirmed yet' }, { status: 404 });
    }
    if (tx.meta.err) {
      return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
    }

    const instructions = tx.transaction.message.instructions;
    const memoOk = instructions.some((ix) => instructionMemoMatches(ix, order.memo));
    if (!memoOk) {
      return NextResponse.json({ error: 'Transaction memo does not match order' }, { status: 400 });
    }

    // Fee payer / first signer is the authoritative buyer wallet for attribution.
    const accountKeys = tx.transaction.message.accountKeys.map((k) => ({
      pubkey: asPubkeyString(k),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signer: Boolean((k as any).signer),
    }));
    const buyerWallet = accountKeys.find((k) => k.signer)?.pubkey || accountKeys[0]?.pubkey;
    if (!buyerWallet) {
      return NextResponse.json({ error: 'Unable to determine buyer wallet' }, { status: 500 });
    }

    const merchantWallet = order.merchantWallet;

    // Payment verification
    if (order.currency === 'SOL') {
      if (order.expectedLamports === null) {
        return NextResponse.json({ error: 'Order is missing expectedLamports' }, { status: 500 });
      }
      const idx = accountKeys.findIndex((k) => k.pubkey === merchantWallet);
      if (idx < 0) {
        return NextResponse.json({ error: 'Merchant wallet not found in transaction accounts' }, { status: 400 });
      }
      const pre = BigInt(tx.meta.preBalances[idx] ?? 0);
      const post = BigInt(tx.meta.postBalances[idx] ?? 0);
      const delta = post - pre;
      if (delta !== order.expectedLamports) {
        return NextResponse.json(
          { error: `SOL payment mismatch: expected ${order.expectedLamports.toString()} lamports, got ${delta.toString()}` },
          { status: 400 }
        );
      }
    } else if (order.currency === 'USDC') {
      if (order.expectedUsdcBaseUnits === null) {
        return NextResponse.json({ error: 'Order is missing expectedUsdcBaseUnits' }, { status: 500 });
      }

      const usdcMint = new PublicKey(PROTOCOL_CONFIG.usdcMint);
      const merchantPk = new PublicKey(merchantWallet);
      const receiverAta = await getAssociatedTokenAddress(usdcMint, merchantPk);

      const ataIndex = accountKeys.findIndex((k) => k.pubkey === receiverAta.toBase58());
      if (ataIndex < 0) {
        return NextResponse.json({ error: 'Merchant USDC ATA not found in transaction accounts' }, { status: 400 });
      }

      const preToken = tx.meta.preTokenBalances?.find(
        (b) => b.accountIndex === ataIndex && b.mint === usdcMint.toBase58()
      );
      const postToken = tx.meta.postTokenBalances?.find(
        (b) => b.accountIndex === ataIndex && b.mint === usdcMint.toBase58()
      );

      const preAmt = BigInt(preToken?.uiTokenAmount?.amount ?? '0');
      const postAmt = BigInt(postToken?.uiTokenAmount?.amount ?? '0');
      const delta = postAmt - preAmt;

      if (delta !== order.expectedUsdcBaseUnits) {
        return NextResponse.json(
          { error: `USDC payment mismatch: expected ${order.expectedUsdcBaseUnits.toString()} base units, got ${delta.toString()}` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Unsupported order currency' }, { status: 400 });
    }

    const points = Math.floor(Number(order.subtotalUsd));

    const result = await prisma.$transaction(async (txdb) => {
      const updatedOrder = await txdb.directCheckoutOrder.update({
        where: { id: order.id },
        data: {
          status: 'Paid',
          txSignature,
          buyerWallet,
        },
      });

      // Decrement stock for all items in this order.
      const items = Array.isArray(updatedOrder.items) ? (updatedOrder.items as Array<{ id: string; quantity: number }>) : [];
      if (items.length > 0) {
        for (const it of items) {
          const qty = Math.floor(Number(it.quantity));
          if (!Number.isFinite(qty) || qty <= 0) continue;
          await txdb.goldPackage.update({
            where: { id: String(it.id) },
            data: { stock: { decrement: qty } },
          });
        }
      }

      const event = await txdb.loyaltyPointsEvent.upsert({
        where: { orderId: updatedOrder.id },
        update: {},
        create: {
          walletAddress: buyerWallet,
          source: 'direct_checkout',
          sourceRef: updatedOrder.id,
          points,
          orderId: updatedOrder.id,
        },
      });

      const sum = await txdb.loyaltyPointsEvent.aggregate({
        where: { walletAddress: buyerWallet },
        _sum: { points: true },
      });

      return { updatedOrder, event, newBalance: sum._sum.points ?? 0 };
    });

    // Fire-and-forget fulfillment webhook (still await, but errors won't fail the order).
    const webhookPayload = {
      formType: 'checkout',
      transactionSignature: txSignature,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress,
      isInternational: order.isInternational,
      shippingMethod: order.shippingMethod,
      shippingCost: Number(order.shippingUsd),
      items: order.items,
      subtotal: Number(order.subtotalUsd),
      totalAmount: Number(order.totalUsd),
      currency: order.currency,
      timestamp: new Date().toISOString(),
      walletAddress: buyerWallet,
      checkoutMode: 'direct',
      pointsAwarded: result.event.points,
      orderId: order.id,
    };

    // Don't block the response on webhook failures.
    postFulfillmentWebhook(webhookPayload).catch(() => undefined);

    return NextResponse.json({
      success: true,
      status: 'Paid',
      walletAddress: buyerWallet,
      pointsAwarded: result.event.points,
      newBalance: result.newBalance,
      txSignature,
    });
  } catch (error) {
    console.error('Direct checkout confirm error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
