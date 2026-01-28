# Deployment Guide - BlackW3B / GoldBack

This document covers environment configuration and deployment steps for the BlackW3B application.

## Environment Variables

### Required Environment Variables

Create a `.env.local` file in the `my-app` directory with the following variables:

```bash
# ===========================================
# SOLANA NETWORK CONFIGURATION
# ===========================================

# Network selection: 'devnet' | 'mainnet-beta' | 'testnet'
# IMPORTANT: For production, this MUST be set to 'mainnet-beta'
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# RPC Endpoint - Use a dedicated RPC provider for production
# Recommended providers: Helius, QuickNode, Alchemy, Triton
NEXT_PUBLIC_RPC_ENDPOINT=https://your-rpc-provider.com

# ===========================================
# DATABASE / SUPABASE
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ===========================================
# OTHER
# ===========================================
# Add any other environment variables here
```

### Network-Specific Configuration

#### Development (Devnet)

```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
```

#### Production (Mainnet)

```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
# OR use a dedicated RPC provider (recommended):
NEXT_PUBLIC_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

## Network Behavior

The application automatically adjusts behavior based on the configured network:

| Feature | Devnet | Mainnet |
|---------|--------|---------|
| USDC Address | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Explorer Links | Include `?cluster=devnet` | No cluster param |
| UI Badge | Amber "Devnet" | Green "Mainnet" |
| Network Warning | None | None |

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] `NEXT_PUBLIC_SOLANA_NETWORK` is set to `mainnet-beta`
- [ ] `NEXT_PUBLIC_RPC_ENDPOINT` is set to a reliable mainnet RPC
- [ ] Merchant wallet address is correct for mainnet
- [ ] All environment variables are set in your deployment platform
- [ ] Test the checkout flow with a small amount on mainnet
- [ ] Verify USDC/SOL balance detection works correctly
- [ ] Check that transaction links point to mainnet Solscan

## Deployment Platforms

### Vercel

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add all required variables
4. Set them for "Production" environment
5. Redeploy the application

```bash
# Using Vercel CLI
vercel env add NEXT_PUBLIC_SOLANA_NETWORK
# Enter: mainnet-beta

vercel env add NEXT_PUBLIC_RPC_ENDPOINT
# Enter: your RPC endpoint
```

### Other Platforms

For other platforms (Netlify, AWS, etc.), ensure environment variables are set before build time since `NEXT_PUBLIC_*` variables are embedded at build time.

## Troubleshooting

### "Wallet connected but tokens not showing"

**Cause**: Network mismatch between the app and wallet.

**Solution**:
1. Check `NEXT_PUBLIC_SOLANA_NETWORK` is set correctly
2. Verify the RPC endpoint matches the network
3. Ensure wallet is on the same network as the app

### "USDC token account not found"

**Cause**: User doesn't have a USDC token account, or wrong USDC mint address.

**Solution**:
1. Verify the network configuration
2. User needs to add USDC to their wallet first

### "Transaction failed - insufficient balance"

**Cause**: User needs SOL for transaction fees, even when paying with USDC.

**Solution**:
1. Ensure user has at least 0.005 SOL for fees
2. Display clear error messages about fee requirements

## RPC Provider Recommendations

For production, we recommend using a dedicated RPC provider:

1. **Helius** - https://helius.dev/
   - Good free tier
   - Fast and reliable

2. **QuickNode** - https://quicknode.com/
   - Enterprise-grade
   - Good for high traffic

3. **Triton** - https://triton.one/
   - Specialized for Solana
   - Good performance

**Note**: The public Solana RPC endpoints have rate limits and may be unreliable under load. Always use a dedicated provider for production.

## Security Notes

1. Never commit `.env.local` to version control
2. Use environment variables in your deployment platform, not hardcoded values
3. The `NEXT_PUBLIC_*` prefix means these values are exposed to the browser - only use for non-sensitive configuration
4. Keep API keys and secrets server-side only

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify network configuration
3. Test with a fresh wallet
4. Check RPC endpoint health
