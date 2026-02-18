import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const DEFAULT_GOLDBACK_RATE = 9.02;
const WEB_RATE_PARITY_OFFSET = 0.23;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseUsdLabel(value: string): number | null {
  const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function normalizeCatalogImage(input: string | null | undefined, requestOrigin: string): {
  imageUrl: string | null;
  imageSource: 'supabase_public' | 'absolute_url' | 'invalid' | 'none';
} {
  if (!input || !input.trim()) {
    return { imageUrl: null, imageSource: 'none' };
  }

  const image = input.trim();
  if (image.startsWith('blob:') || image.startsWith('data:')) {
    return { imageUrl: null, imageSource: 'invalid' };
  }

  if (image.startsWith('https://') || image.startsWith('http://')) {
    return { imageUrl: image, imageSource: 'absolute_url' };
  }

  if (image.startsWith('/')) {
    return { imageUrl: joinUrl(requestOrigin, image), imageSource: 'absolute_url' };
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!supabaseUrl) {
    return { imageUrl: null, imageSource: 'invalid' };
  }

  let objectPath = image;
  if (objectPath.startsWith('product-images/')) {
    objectPath = objectPath.replace(/^product-images\//, '');
  }
  if (objectPath.startsWith('storage/v1/object/public/product-images/')) {
    objectPath = objectPath.replace(/^storage\/v1\/object\/public\/product-images\//, '');
  }

  const publicUrl = joinUrl(supabaseUrl, `storage/v1/object/public/product-images/${objectPath}`);
  return { imageUrl: publicUrl, imageSource: 'supabase_public' };
}

function extractDenominationGb(features: string[], name?: string): number | null {
  const featureOzPattern = /(\d+)\/1000(?:th)?\s*oz/i;
  for (const feature of features) {
    const match = feature.match(featureOzPattern);
    if (match) return parseInt(match[1], 10);
  }

  const featureGbPattern = /(\d+)\s*GB/i;
  for (const feature of features) {
    const match = feature.match(featureGbPattern);
    if (match) return parseInt(match[1], 10);
  }

  if (name) {
    const namePattern = /\((\d+)\s*GB\)/i;
    const match = name.match(namePattern);
    if (match) return parseInt(match[1], 10);
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const requestOrigin = new URL(request.url).origin;
    const [packages, siteSettings] = await Promise.all([
      prisma.goldPackage.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      prisma.siteSettings.findUnique({
        where: { id: 'main' },
        select: { goldbackRatePer1GB: true, updatedAt: true },
      }),
    ]);

    const baseRate = siteSettings?.goldbackRatePer1GB ?? DEFAULT_GOLDBACK_RATE;
    const goldbackRate = round2(baseRate + WEB_RATE_PARITY_OFFSET);

    const responsePackages = packages.map((pkg) => {
      const denominationGb = extractDenominationGb(pkg.features, pkg.name);
      const computedUnitPrice = denominationGb ? round2(goldbackRate * denominationGb) : null;
      const fallbackUnitPrice = parseUsdLabel(pkg.price);
      const unitPriceUsd = computedUnitPrice ?? fallbackUnitPrice ?? 0;
      const { imageUrl, imageSource } = normalizeCatalogImage(pkg.image, requestOrigin);

      return {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        image: pkg.image,
        imageUrl,
        imageSource,
        features: pkg.features,
        stock: pkg.stock,
        minQty: pkg.minQty ?? 3,
        denominationGb,
        displayPriceLabel: `$${unitPriceUsd.toFixed(2)}`,
        unitPriceUsd,
      };
    });

    return NextResponse.json({
      success: true,
      goldbackRate,
      rateUpdatedAt: siteSettings?.updatedAt?.toISOString() ?? null,
      packages: responsePackages,
    });
  } catch (error) {
    console.error('[api/shop/catalog] failed to load catalog:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load shop catalog',
      },
      { status: 500 }
    );
  }
}
