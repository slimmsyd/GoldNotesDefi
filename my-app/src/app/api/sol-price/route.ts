import { NextResponse } from 'next/server';

export async function GET() {
    const priceSources = [
        // Jupiter Price API v2
        async () => {
            const response = await fetch(
                'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112',
                { next: { revalidate: 30 } } // Cache for 30 seconds
            );
            if (!response.ok) throw new Error('Jupiter API failed');
            const data = await response.json();
            const price = data.data?.['So11111111111111111111111111111111111111112']?.price;
            if (!price) throw new Error('No price in Jupiter response');
            return { price: Number(price), source: 'jupiter' };
        },
        // Binance public API
        async () => {
            const response = await fetch(
                'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
                { next: { revalidate: 30 } }
            );
            if (!response.ok) throw new Error('Binance API failed');
            const data = await response.json();
            if (!data.price) throw new Error('No price in Binance response');
            return { price: Number(data.price), source: 'binance' };
        },
        // CoinGecko (may have rate limits)
        async () => {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
                { next: { revalidate: 60 } } // Cache longer due to rate limits
            );
            if (!response.ok) throw new Error('CoinGecko API failed');
            const data = await response.json();
            if (!data.solana?.usd) throw new Error('No price in CoinGecko response');
            return { price: data.solana.usd, source: 'coingecko' };
        },
    ];

    for (const fetchPrice of priceSources) {
        try {
            const result = await fetchPrice();
            console.log(`SOL price fetched from ${result.source}: $${result.price}`);
            return NextResponse.json({
                success: true,
                price: result.price,
                source: result.source,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            console.warn('Price source failed, trying next...', err);
            continue;
        }
    }

    // All sources failed
    console.error('All SOL price sources failed');
    return NextResponse.json(
        {
            success: false,
            error: 'Unable to fetch SOL price from any source',
        },
        { status: 503 }
    );
}
