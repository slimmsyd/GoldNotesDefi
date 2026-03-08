# GoldBackProject Phase Plan (Devnet Readiness + Checkout Loyalty)

Last updated: 2026-02-13
Owner: Sydney + Codex
Scope: W3B protocol devnet usability + physical checkout loyalty points tied to wallet identity and future on-chain sync

## 0) Why This Exists (Larger Goal)
We are building a system where users can:
1. Buy W3B (digital) backed by proven reserves and earn points
2. Burn W3B to create redemption requests (physical fulfillment flow) and earn points
3. Buy physical Goldbacks with crypto checkout and earn points tied to their wallet identity
4. Eventually, on mainnet, reconcile/claim those points on-chain into the protocol UserProfile (or other canonical token-linked representation)

The key outcome is a testable, end-to-end loop on devnet now, and a credible mainnet story later.

---

## 1) Current Facts (Observed In Repo)
### On-chain core exists
- `buy_w3b` transfers SOL to receiver and W3B from treasury to buyer; awards points if UserProfile is present.
- `burn_w3b` burns tokens; creates a `RedemptionRequest`; awards points (2x) if UserProfile is present.
- Points live in on-chain `UserProfile` account.

File: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/programs/w3b_protocol/programs/w3b_protocol/src/lib.rs`

### Checkout exists for physical Goldbacks
Direct checkout (`/checkout`) builds SOL/USDC payment tx client-side to merchant wallet and confirms it, then posts order data to an external webhook.

File: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/checkout/page.tsx`
- Merchant wallet: `CrQERYcZMnENP85qZBrdimS7oz2Ura9tAPxkZJPMpbNj`
- Memo: `GoldBack Order: <timestamp>`
- Currency: SOL or USDC; Private payment uses Privacy Cash withdraw -> merchant

Amazon/SP3ND checkout also exists and is more server-driven:
- Creates order via `/api/sp3nd/checkout`, stores order in Prisma (`SP3NDOrder`)
- Returns payment instructions (USDC) and memo prefix

Files:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/components/checkout/amazon-checkout.tsx`
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/sp3nd/checkout/route.ts`
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/prisma/schema.prisma` (SP3NDOrder, UserProfile shipping)

### Known devnet blockers (from earlier arc notes)
To make devnet buy/burn testable, we must ensure:
- `w3b_price_lamports > 0`
- Treasury has supply (tokens minted)
- ProtocolState proof timestamps/reserves are compatible with mint rules

Reference: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/Clean_Slate_Plan/token.md`

---

## 2) PHASE 2 Decisions (Locked)
### Devnet protocol plan
- Target: devnet only
- Deployment: upgrade-in-place (no address rotation)
- Program ID: `9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6`

### Step 3 semantics (already implemented in code)
- `UserProfile` is truly optional for `buy_w3b` and `burn_w3b`
- If `user_profile` is omitted: instruction succeeds, points are skipped
- If `user_profile` is provided: validate correct PDA + correct user or error (`InvalidUserProfileAccount`)

### Checkout loyalty (new scope decisions)
- Points representation long-term: OFF-CHAIN accrual now + ON-CHAIN claim later
- Private payment: opt-in wallet linkage (default does not force loyalty linkage)
- Points rate: 1 point per $1 USD (floor), applied to order subtotal (exclude shipping/tax unless policy changes)

---

## 3) PHASE 3 Execution Checklist (Devnet Step 4 + 5)

### 3.1 Step 4: Upgrade + Verify Program (Devnet)
Goal: deploy Step 3 code to the existing devnet program ID.

Preflight:
1. Confirm upgrade authority matches local keypair:
   - `solana program show -u devnet 9xZaf2...`
2. Build + run local tests:
   - `anchor clean && anchor build && anchor test`
   - Test file: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/programs/w3b_protocol/tests/programs-w3b-protocol.ts`

Upgrade (in place):
- Use Solana CLI deploy targeting existing program ID:
  - `solana program deploy -u devnet <path-to-so> --program-id 9xZaf2... --upgrade-authority ~/.config/solana/id.json`

Post-upgrade validation:
- `solana program show -u devnet 9xZaf2...`
- Capture upgrade signature + confirm program executable

Acceptance:
- Devnet program upgraded without changing program ID.

### 3.2 Step 5: Make Devnet Economically Non-Zero (Price + Supply)
Goal: make `buy_w3b` and `burn_w3b` executable in realistic conditions.

#### 3.2.1 Set realistic on-chain price
Mechanism:
- Use my-app's `syncOnChainPrice(...)` pipeline (requires operator keypair env):
  - Source code: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/lib/price-sync.ts`
- Add a CLI wrapper script (new):
  - `my-app/scripts/sync_price_cli.ts`
  - Fetch Goldback USD + SOL USD -> compute lamports -> call set_w3b_price via `syncOnChainPrice`

Acceptance:
- `w3b_price_lamports > 0` on devnet ProtocolState.

#### 3.2.2 Seed reserves + mint treasury supply (FAST DEVNET SEED)
Mechanism (devnet only):
- Add a seeding script (new):
  - `w3b-token/services/api/scripts/devnet_seed_reserves_and_mint.ts`
- Script does:
  1. Fetch ProtocolState (w3bMint, treasury, totalSupply, provenReserves, lastProofTimestamp)
  2. Pick `targetReserves` >= totalSupply (default 5000)
  3. Call:
     - `updateMerkleRoot(root, targetReserves)`
     - `submitProof(dummyHash, targetReserves)` (dummy hash OK because program checks reserve count match only)
     - `mintW3B(delta)` to treasury (ensures treasury has spendable supply)

Acceptance:
- Treasury token account has >0 W3B
- totalSupply <= provenReserves
- lastProofTimestamp is recent (mint staleness check satisfied)

#### 3.2.3 Devnet verification script
Add (new):
- `w3b-token/services/api/scripts/devnet_verify_buy_burn_points.ts`

It validates:
- buy succeeds with `userProfile: null`
- burn succeeds with `userProfile: null` and creates RedemptionRequest PDA
- buy/burn fail when provided wrong profile PDA
- buy/burn update points when a valid on-chain UserProfile is provided

Acceptance:
- PASS/FAIL summary + tx signatures for each scenario.

---

## 4) PHASE 4 (NEW): Checkout Loyalty Points (Off-chain, Mainnet-credible)

### 4.1 Problem to solve
Today, direct checkout constructs payments client-side and posts to an external webhook.
For loyalty/points integrity, we must ensure:
- Points are awarded only for verified paid orders
- Orders are idempotent (no double-award)
- Private payment does not force wallet linkage unless user opts in

### 4.1.1 Phase 4 Implementation Notes (Repo)
Prisma:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/prisma/schema.prisma`
  - Added `DirectCheckoutOrder`
  - Added `LoyaltyPointsEvent`
- Migration: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/prisma/migrations/20260213200331_phase4_direct_checkout_loyalty/migration.sql`

API:
- `POST /api/checkout/direct/create`
  - File: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/checkout/direct/create/route.ts`
  - Server computes canonical subtotal/shipping/total and returns stable `memo = GoldBack Order: <orderId>`
  - Returns expected payment amount (`expectedLamports` or `expectedUsdcBaseUnits`) as strings (JSON-safe)
- `POST /api/checkout/direct/confirm`
  - File: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/checkout/direct/confirm/route.ts`
  - Verifies tx memo + SOL/USDC payment to merchant, decrements stock, upserts points event (idempotent)
  - Fires fulfillment webhook server-side (keeps current n8n URL as fallback)
- `GET /api/loyalty/balance`
  - File: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/loyalty/balance/route.ts`
  - Returns points balance + latest events for `/settings`

Frontend wiring:
- Checkout: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/checkout/page.tsx`
  - Calls create -> builds tx with stable memo and server-quoted amount -> confirm -> shows success
  - Private payment explicitly does not award points yet (Phase 4 scope)
- Settings: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/settings/page.tsx`
  - Displays loyalty points balance (calls `/api/loyalty/balance`)

Production env:
- Add `MERCHANT_WALLET_ADDRESS` (server-side) to avoid hardcoding merchant recipient.
- RPC for verification uses `NEXT_PUBLIC_RPC_ENDPOINT` (fallbacks to `PROTOCOL_CONFIG.rpcEndpoint`).

### 4.2 Data model (Prisma)
Add new models in `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/prisma/schema.prisma`:

1. `DirectCheckoutOrder`
- id (uuid/cuid)
- walletAddress (nullable for private or opt-out)
- currency (SOL|USDC|PRIVATE)
- amountUsd (Decimal)
- txSignature (unique)
- status (Created|Paid|Failed|Cancelled)
- createdAt/updatedAt
- items snapshot (Json)
- memo/orderRef (string, unique)

2. `LoyaltyPointsEvent`
- id
- source (direct_checkout|sp3nd|burn|buy|manual)
- sourceRef (orderId or txSignature) UNIQUE (idempotency)
- walletAddress nullable (for privacy opt-out)
- points (Int)
- status (PendingClaim|Attributed)
- createdAt

We will compute "current points balance" by summing events by walletAddress.

### 4.3 Server-driven direct checkout (mainnet-ready)
Add API:
1. `POST /api/checkout/create`
- Server computes canonical totals from products + shipping rules
- Returns:
  - orderId
  - recipient wallet
  - currency
  - amount (lamports or USDC base units)
  - memo including stable order ref (e.g. `GoldBack Order <orderId>`)
- Stores `DirectCheckoutOrder` with status Created

2. `POST /api/checkout/confirm`
- Input: orderId, txSignature
- Server verifies on-chain tx actually paid the expected recipient + amount + mint (if USDC)
- Marks order Paid
- Writes `LoyaltyPointsEvent` (idempotent via unique sourceRef)
- Returns points awarded

Update client:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/checkout/page.tsx`
  - Stop posting to external webhook for core accounting.
  - Use `/api/checkout/create` to get memo + amounts
  - After confirmTransaction, call `/api/checkout/confirm` to award points

### 4.4 SP3ND/Amazon orders
Add:
- When SP3ND payment tx is confirmed, call a server endpoint to mark order Paid and award points.
- Tie points sourceRef to `sp3ndOrderId` or `order_number` (unique).

### 4.5 Private payment opt-in
In `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/checkout/page.tsx`:
- Add UI toggle: "Earn points with this wallet (links purchase)"
- If opt-out:
  - store points event with `walletAddress = null` and `status = PendingClaim`
  - return a claim code (or require signed message later) to attach to wallet
- If opt-in:
  - attribute points to wallet immediately

Acceptance (Phase 4):
- A paid direct checkout order results in exactly 1 points event.
- User can see their points balance in UI (new component or settings).
- Private payment can complete without permanently attributing wallet unless opted-in.

---

## 5) PHASE 5 (FUTURE): On-chain Claim / Migration to Protocol UserProfile
Goal: make off-chain loyalty points "token-linked" on-chain in a way that is not forgeable.

Preferred approach:
- Introduce a new on-chain instruction `claim_offchain_points(voucher, signature)` OR an ed25519-instructions-based voucher validation flow.
- User signs and pays for the tx; program verifies the voucher was issued by a trusted issuer key and not replayed (nonce).
- Program updates on-chain `UserProfile.points` accordingly.
- This avoids having a backend operator key sign on-chain writes.

Acceptance (Phase 5):
- User with off-chain points can claim them into on-chain UserProfile on mainnet.
- Replay attempts fail.
- Claims are idempotent and auditable.

---

## Out of Scope (This doc)
- Audit, multisig governance, production key management (tracked separately)
- Full mainnet deployment runbook beyond claim mechanism
