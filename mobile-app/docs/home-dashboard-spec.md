# Home Dashboard Spec (Screenshot Parity)

## Objective
- Deliver a persistent mobile landing dashboard that mirrors the provided screenshot layout and tone, adapted to GoldBack branding and Android-safe React Native implementation.

## Screen Mapping
1. Splash
- Short branded entry animation.
- Auto-transition to `Home`.

2. Home (new)
- Welcome header.
- Portfolio card:
  - Total USD portfolio estimate.
  - W3B token count.
  - Loyalty points.
  - Rate metadata and update time.
- Primary actions:
  - `Withdraw` -> `Redeem`
  - `Buy Gold` -> `Shop`
- Feature grid:
  - Stake W3B
  - Physical Gold
  - Withdraw Gold
  - Autopay

3. Existing commerce flow
- `Shop` and `Checkout` remain active and unchanged in business logic.

## Data Sources
1. `GET /api/portfolio/summary` (new backend facade)
- Wallet auth via bearer token (`X-Wallet-Address` fallback compatible).
- Returns:
  - `w3bBalance` (on-chain)
  - `goldbackRateUsd` (server authoritative rate)
  - `portfolioUsd` (derived)
  - `loyaltyPoints` (DB aggregate)
  - `dataHealth`

2. Existing APIs still used
- `GET /api/shop/catalog` for shop inventory visuals and pricing.
- `GET /api/redemption/status?wallet=<pubkey>` for withdraw status summary.

## Android-Safe Compromises
1. Keep native stack and header wallet action instead of adding new native UI libraries.
2. Use local static assets in `mobile-app/assets/landing/` for stable image rendering.
3. Keep withdraw deep flow as a safe “hub + status” until full burn flow is integrated.

## Deferred
1. Full private withdraw transaction UI in mobile.
2. Dedicated portfolio drill-down screen.
3. Feature-card deep links beyond Shop/Withdraw.
