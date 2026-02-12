# Phase 1 Execution Report (Devnet, Mock then Hybrid Live)

## Run Metadata
- Branch: `codex/phase1-verify-rehearsal`
- Baseline commit: `5bd7b1a0261eba558cd0f375eeb3d8b9be3f146e`
- Baseline timestamp (UTC): `2026-02-12T00:35:51Z`
- Scope: Phase 1 verification and rehearsal only (no protocol redeploy, no mainnet actions)

## Step 0: Branch and Baseline
- `git checkout -b codex/phase1-verify-rehearsal` executed and pushed.
- Remote branch established: `origin/codex/phase1-verify-rehearsal`.
- Baseline captured before test execution.

## Step 1: Security Verification Matrix

### 1A) `my-app` admin auth and cron auth
Files under test:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/lib/admin-auth.ts`
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/admin/auto-verify/route.ts`
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/cron/update-rate/route.ts`

Results:
- `admin_valid_signed` -> `500` (auth passed, downstream runtime error)
  - Evidence: response logs contain `Request authenticated via wallet`.
  - Runtime blocker: `Cannot read properties of undefined (reading '_bn')` in `route.ts` while constructing `Program`.
- `admin_non_allowlisted` -> `401` with `Wallet is not on admin allowlist`.
- `admin_bad_signature` -> `401` with `Invalid wallet signature`.
- `admin_stale_timestamp` -> `401` with `Wallet auth signature is stale`.
- `cron_no_auth` -> `401` (`Unauthorized`).
- `cron_with_auth` -> `200` with success payload and updated timestamps.

Interpretation:
- Auth hardening is working (reject paths behave correctly).
- Success path after auth currently blocked by runtime bug in auto-verify route.

### 1A.2) Auto-verify webhook secret path
Results:
- `webhook_no_secret` -> `401` (`Missing wallet auth payload`).
- `webhook_with_secret` -> `500` (auth passed, same downstream runtime error).
  - Evidence: response logs contain `Request authenticated via webhook`.

### 1B) Issuance service protected route auth
File under test:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api/src/server.ts`

Results:
- `POST /api/v1/goldback/new_batch`
  - without auth -> `401`
  - with auth -> `200`
- `PATCH /api/v1/redemption/:id/claim`
  - without auth -> `401`
  - with auth -> `500` (route reached business logic; invalid UUID input used in test)
- `PATCH /api/v1/redemption/:id/confirm`
  - without auth -> `401`
  - with auth -> `500` (route reached business logic; invalid UUID input used in test)
- `PATCH /api/v1/redemption/:id/cancel`
  - without auth -> `401`
  - with auth -> `500` (route reached business logic; invalid UUID input used in test)

Interpretation:
- Auth middleware is enforced on all intended privileged routes.
- Authenticated requests pass through guardrails and fail later only due synthetic test payload IDs.

### 1C) Privacy backend CORS
File under test:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/privacy-cash-backend/src/index.ts`

Environment used:
- `NODE_ENV=production`
- `PRIVACY_ALLOWED_ORIGINS=https://www.w3bs.fun,http://localhost:3000`

Results (`OPTIONS /api/deposit/create`):
- Allowed origin `https://www.w3bs.fun` -> `204`, header includes `Access-Control-Allow-Origin: https://www.w3bs.fun`.
- Disallowed origin `https://evil.example` -> `500`, server log: `Not allowed by CORS`.

Interpretation:
- Production allowlist behavior is correct.

### 1D) Daily cron cadence lock
File:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/vercel.json`

Result:
- Confirmed unchanged: `"schedule": "0 0 * * *"` (daily).

## Step 2: Tooling and Env Preflight
Working directory:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api`

Versions:
- `anchor-cli 0.32.1`
- `solana-cli 3.0.13`
- `nargo 1.0.0-beta.18`
- `bb 3.0.0-nightly.20260102`

Required env presence check (values not printed):
- `SOLANA_RPC_URL`: present
- `SOLANA_KEYPAIR_PATH`: missing, default exists at `~/.config/solana/id.json`
- `SUPABASE_URL`: present
- `SUPABASE_ANON_KEY`: present

## Step 3: Mock Serialization Pass
Commands executed:
- `USE_MOCK_DATA=true MOCK_SERIAL_COUNT=20 npm run generate-prover`
- `npm run prove-batches`
- `TS_NODE_TRANSPILE_ONLY=1 npm run submit-proof`

Artifacts produced:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/circuits/reserve_proof/target/batches/manifest.json` (mock run produced batch config before live overwrite)
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/circuits/reserve_proof/target/batches/proofs/proof_manifest.json` (updated later by live pass)
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/circuits/reserve_proof/target/batches/proofs/audit_1770858871119.json`

Outcome:
- Local proof generation and verification succeeded.
- On-chain submit failed: `ReserveCountMismatch (6007)`.
- No successful submit tx signature produced in this mock pass.

## Step 4: Hybrid Live Supabase Pass (Single Controlled Run)
Commands executed:
- `npm run generate-prover` (live Supabase mode)
- `npm run prove-batches`
- `TS_NODE_TRANSPILE_ONLY=1 npm run submit-proof`

Live artifacts:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/circuits/reserve_proof/target/batches/manifest.json`
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/circuits/reserve_proof/target/batches/proofs/proof_manifest.json`
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/circuits/reserve_proof/target/batches/proofs/audit_1770859146637.json`

Pre/post evidence captured:
- Supabase serial count: `1`
- Parsed protocol account (`raw layout offsets`) shows:
  - `w3bMint`: `G8iL4yvsctALHZbz9nVP2gsw1A1x1kzjfZ7iHLDnHoYZ`
  - `treasury`: `F2vQ2a3ahHyN9KtLbPXfGj6n7Yms7veVEiCgmjfwviaX`
  - `w3bPriceLamports`: `1` (not zero; no contingency needed)
- Script pre-state from submit step:
  - `Current Supply: 0`
  - `Total Proven (submission input): 1`
  - `Mint Delta: 1`

Outcome:
- Local proof verification succeeded.
- On-chain submit failed again with `ReserveCountMismatch (6007)`.
- No successful live submit tx signature produced.

## Additional Blockers Observed
1. `my-app` auto-verify route success path fails after auth:
- Error: `Cannot read properties of undefined (reading '_bn')`
- Location: `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/app/api/admin/auto-verify/route.ts:261`
- Effect: both wallet-auth and webhook-auth requests authenticate correctly but fail before submitting on-chain updates.

2. `submit-proof.ts` strict TypeScript typing error:
- `authority` account key mismatch in typed account map.
- Runtime execution requires `TS_NODE_TRANSPILE_ONLY=1` as a temporary workaround for this phase run.

## Acceptance Criteria Status
1. Security gates return expected status codes: **Partially met**
- Unauthorized paths consistently return `401`.
- Authorized paths pass auth; one downstream runtime blocker remains in `my-app` auto-verify success path.

2. Mock pass fully succeeds with tx evidence: **Not met**
- Proof generation/verifications pass, on-chain submit fails `ReserveCountMismatch`.

3. Live pass fully succeeds with deterministic state delta: **Not met**
- Same on-chain submit failure (`ReserveCountMismatch`).

4. No redeploy/address rotation/mainnet changes: **Met**

5. Evidence captured on isolated branch: **Met**

## Cron Cadence Confirmation
- Explicitly unchanged and still daily due Vercel Hobby:
  - `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/vercel.json`
  - `"schedule": "0 0 * * *"`

## Recommended Follow-up Before Phase 2
1. Fix `my-app` auto-verify runtime constructor/account typing issue in route handler.
2. Resolve on-chain `ReserveCountMismatch` root/count compatibility in proof submission flow.
3. Re-run Phase 1 mock/live submit until tx signatures are produced for both passes.
