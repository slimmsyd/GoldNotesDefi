# Phase 4 Operations Runbook (Direct Checkout Loyalty)

## Purpose
This runbook certifies and operates the Phase 4 direct checkout loyalty system:

1. `POST /api/checkout/direct/create` computes canonical order totals and payment instructions.
2. `POST /api/checkout/direct/confirm` verifies on-chain payment and awards points exactly once.
3. `GET /api/loyalty/balance` returns wallet balance from `LoyaltyPointsEvent`.

## Required Environment
For production-like operation:

- `NEXT_PUBLIC_SOLANA_NETWORK` (`devnet` or `mainnet-beta`)
- `NEXT_PUBLIC_RPC_ENDPOINT`
- `MERCHANT_WALLET_ADDRESS` (recommended server-side source of truth)
- `CRON_SECRET`
- Optional alerting: `OPS_ALERT_WEBHOOK_URL` (or `ALERT_WEBHOOK_URL`)

## Certification Checklist

### A) Direct checkout create contract
Expected:
- Returns `orderId`, stable `memo`, expected amount fields, totals, points preview.

### B) Live payment + confirm (SOL and USDC)
For each currency:
1. Create order from checkout UI.
2. Submit wallet payment on-chain.
3. Call confirm route via UI flow.
4. Validate:
   - response `success: true`
   - `pointsAwarded === floor(subtotalUsd)`
   - `/settings` balance increases.

### C) Idempotency
Repeat confirm for same `orderId + txSignature`.
Expected:
- same paid status
- no additional points
- no additional stock decrement

### D) Negative security tests
Expected failures:
- wrong memo
- wrong amount
- wrong recipient
- wrong USDC ATA/mint

## Reconciliation Queries (Postgres / Prisma DB)

### 1) Duplicate points guard (must return zero rows)
```sql
SELECT "orderId", COUNT(*)
FROM "LoyaltyPointsEvent"
GROUP BY "orderId"
HAVING COUNT(*) > 1;
```

### 2) Paid orders missing points events (must return zero rows)
```sql
SELECT o."id", o."buyerWallet", o."txSignature", o."updatedAt"
FROM "DirectCheckoutOrder" o
LEFT JOIN "LoyaltyPointsEvent" e ON e."orderId" = o."id"
WHERE o."status" = 'Paid'
  AND e."id" IS NULL;
```

### 3) Transaction signature reused across multiple orders (must return zero rows)
```sql
SELECT "txSignature", COUNT(*)
FROM "DirectCheckoutOrder"
WHERE "txSignature" IS NOT NULL
GROUP BY "txSignature"
HAVING COUNT(*) > 1;
```

## Fulfillment Webhook Failure Playbook
Webhook failure does **not** roll back paid order or points.

If fulfillment callback fails:
1. Find paid order by `orderId` or `txSignature`.
2. Confirm points event exists for that order.
3. Re-send fulfillment payload manually to `N8N_CHECKOUT_WEBHOOK_URL`.
4. Log replay event and timestamp.

## Serialization Pipeline Note
Reserve serialization (`goldback_serials`, `merkle_roots`, `/api/admin/auto-verify`) is intentionally independent from direct checkout points awarding. Keep troubleshooting paths separate during incidents.

## Serialization Ingestion Command (Dev)
```bash
curl -X POST http://localhost:3001/api/v1/goldback/new_batch \
  -H "Authorization: Bearer <SERVICE_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"BATCH-2026-001","serials":["GB-2026-000001","GB-2026-000002"]}'
```
