import { NextResponse } from 'next/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';

export async function POST(req: Request) {
  try {
    const { destinationWallet } = await req.json();

    if (!destinationWallet) {
      return NextResponse.json({ error: 'Missing destination wallet' }, { status: 400 });
    }

    // Get CDP credentials from environment
    const apiKeyId = process.env.COINBASE_API_KEY_NAME;
    const apiKeySecret = process.env.COINBASE_API_KEY_SECRET?.replace(/\\n/g, '\n');

    if (!apiKeyId || !apiKeySecret) {
      console.error('Missing Coinbase CDP credentials');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Generate JWT using CDP SDK auth utility
    const jwt = await generateJwt({
      apiKeyId,
      apiKeySecret,
      requestMethod: 'POST',
      requestHost: 'api.developer.coinbase.com',
      requestPath: '/onramp/v1/token',
    });

    // Call Coinbase Onramp API to get session token
    const response = await fetch('https://api.developer.coinbase.com/onramp/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        addresses: [{
          address: destinationWallet,
          blockchains: ['solana']
        }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Coinbase API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to generate onramp token' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      token: data.token,
      success: true
    });

  } catch (error) {
    console.error('Coinbase onramp error:', error);
    return NextResponse.json(
      { error: 'Failed to generate onramp session' },
      { status: 500 }
    );
  }
}
