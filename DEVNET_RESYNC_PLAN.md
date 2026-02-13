# Devnet Resync Plan (Counts + Price Display + Guardrails)

Goal: get devnet protocol state back into sync now, and prevent it from drifting into insolvency again.

Scope: devnet only. No mainnet actions.

## Current Problem (Why UI Shows Insolvency)
- On-chain state currently has `proven_reserves = 1` but `total_supply = 20`.
- Coverage ratio is `1 / 20 = 5%`, so UI correctly shows Under-collateralized.
- Treasury holding `20` only means the minted tokens are sitting in the treasury token account; it does not mean reserves are verified.

## Secondary Problem (Why Batch "Value" Shows "$10" Instead Of "$10.15")
- Batch "Value" is formatted with `maximumFractionDigits: 0`, so `$10.15` renders as `$10`.
- "W3B Price" uses 2 decimals, so it shows `$10.15`.

## Recovery Strategy (Recommended)
Raise `proven_reserves` to match existing supply.

Target: `proven_reserves = 20` and `total_supply = 20`.

Method: insert/dev-import enough dev serials so Supabase has 20 serials, then rerun the live pipeline to update the on-chain Merkle root + proof timestamp.

Expected mint delta during resync: 0 (since supply already equals target reserves).

---

## A) Get Protocol Back In Sync (Target: proven_reserves = 20, total_supply = 20)

### A1) Preflight: confirm Supabase serial count (live)
Working dir:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api`

Command:
- `npm run generate-prover`

Observe:
- Console prints: `Fetched X serials from Supabase`

Pass condition:
- `X` must be 20 before proceeding to submit proof.

### A2) Seed Supabase dev serials up to 20
Why:
- If Supabase only has 1 serial, the prover manifest can only claim 1 reserve. Submitting that keeps the protocol insolvent.

Approach:
1. Start issuance service locally (writes to DB configured in env).
   - `npm run dev`
2. Insert serials via protected endpoint.
   - `POST /api/v1/goldback/new_batch`
   - include `Authorization: Bearer ${SERVICE_API_SECRET}`
3. Insert enough new serials so total becomes 20.

Evidence:
- Service logs show batch received and a new Merkle root computed.
- Re-run `npm run generate-prover` until it prints `Fetched 20 serials from Supabase`.

### A3) Submit the live pipeline to devnet (should mint 0)
Working dir:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api`

Commands:
1. `npm run generate-prover` (must produce 20 serials)
2. `npm run prove-batches`
3. `npm run submit-proof`

Expected behavior:
- Script prints `Current Supply: 20`, `Total Proven: 20`, `Mint Delta: 0`.
- It submits `update_merkle_root` tx and `submit_proof` tx(s).
- No mint tx (mint delta is 0).

Post-check:
- UI shows `Reserves 20`, `20 minted`, coverage ~100%, insolvency banner cleared.

---

## B) Fix UI "Value" Display (So $10.15 shows as $10.15)

File:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/components/app/dashboard/mempool-blocks.tsx`

Change:
- Replace whole-dollar formatting with 2-decimal formatting for batch "Value".

Acceptance:
- When `serialCount=1` and `goldbackPrice=10.15`, "Value" renders $10.15 (not $10).

---

## C) Guardrails: Prevent Writer Paths From Creating Insolvency Again

### C1) Guardrail in submit-proof script (dev ops)
File:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api/scripts/submit_proof.ts`

Behavior:
- Before updating root/reserves, fetch on-chain pre-state and refuse to proceed if `manifest_total_serials < preState.totalSupply`.

Optional override:
- `ALLOW_INSOLVENT_UPDATE=true` bypasses the guard for extreme dev recovery (default false).

### C2) Guardrail in my-app auto-verify route (admin button)
File:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/admin/auto-verify/route.ts`

Behavior:
- Before calling `updateMerkleRoot`, compare Supabase serial count vs on-chain `total_supply`.
- If Supabase count is lower, return an error and do not submit anything.

Acceptance:
- "Verify Now" cannot drive reserves below supply.

---

## D) Update Phase 1 Evidence Report
File:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/PHASE1_EXECUTION_REPORT.md`

Add:
- Supabase serial count before/after seeding.
- Devnet tx signatures for update + submit (and mint should be absent if delta 0).
- UI metrics after resync (reserves/supply/coverage).
- Note explaining prior "$10" rounding behavior and the fix.

---

## Acceptance Criteria
1. On-chain `proven_reserves == 20` and `total_supply == 20`.
2. Resync run produces no mint tx (delta 0).
3. Guardrails prevent accidental reserve decreases below current supply.
4. UI batch "Value" displays cents and matches the shown W3B price (e.g., $10.15).
