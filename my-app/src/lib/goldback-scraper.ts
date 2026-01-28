interface GoldbackProxyResponse {
    success: boolean;
    timestamp: number;
    source: string;
    quotes: {
        USDUSD: number;
        [key: string]: number;
    };
}

interface GoldbackRateResult {
    rate: number;
    timestamp: number;
}

/**
 * Fetches the current Goldback exchange rate from goldback.com's API.
 * Returns null if the fetch fails or validation fails.
 */
export async function getCurrentGoldbackRate(): Promise<GoldbackRateResult | null> {
    try {
        const response = await fetch('https://www.goldback.com/gb-proxy.php', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            cache: 'no-store' // Ensure fresh fetch
        });

        if (!response.ok) {
            console.error(`Failed to fetch Goldback API: ${response.status} ${response.statusText}`);
            return null;
        }

        const data: GoldbackProxyResponse = await response.json();

        if (!data.success) {
            console.error('Goldback API returned success: false');
            return null;
        }

        // The USDUSD quote is the rate in USD per 1 Goldback
        const rate = data.quotes?.USDUSD;

        // Sanity Checks
        if (typeof rate !== 'number' || isNaN(rate)) {
            console.error(`Invalid rate from API: ${rate}`);
            return null;
        }

        if (rate <= 0) {
            console.error(`Rate is <= 0: ${rate}`);
            return null;
        }

        if (rate > 100) {
            // Unlikely for 1 Goldback to be > $100. Log warning but allow.
            console.warn(`Rate seems unusually high: ${rate}. Update will proceed.`);
        }

        return {
            rate,
            timestamp: data.timestamp * 1000 // Convert to ms
        };

    } catch (error) {
        console.error('Error in getCurrentGoldbackRate:', error);
        return null;
    }
}
