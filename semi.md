# semi.md — GoldBack Project Reference

> **Use this file as the single reference for the GoldBack ($W3B/WGB) codebase.** When asked to "refer to semi.md" or "use semi.md", use this document for context, paths, and decisions.

---

## 1. What This Project Is

- **GoldBack ($W3B / WGB)** — Privacy-preserving Real World Asset (RWA) platform on Solana.
- **Goal:** Bridge physical Goldbacks (gold currency) with digital velocity: prove reserves with ZK, mint tokens, let users buy/burn/redeem and spend via crypto or Privacy Cash.
- **Monorepo layout:**
  - **`w3b-token/`** — Issuance: Anchor programs (`w3b_protocol`, `wgb_staking`), Noir ZK circuits, Supabase serial registry, issuance API.
  - **`my-app/`** — Next.js 16 frontend: swap, shop, vault/transparency, checkout, Amazon/SP3ND bridge.
  - **`privacy-cash-backend/`** — Node service for Privacy Cash (ZK spend-proofs); needs writable filesystem (not Vercel serverless).
  - **`mobile-app/`** — Expo + Solana MWA; parity with web (dashboard, checkout SOL-only in spec).

---

## 2. How to Run the Full Stack (4 Terminals)

| # | Where | Command | Port |
|---|--------|---------|------|
| 1 | repo root | `solana-test-validator --reset` | — |
| 2 | `w3b-token/services/api` | `npm install && npm run dev` | 3001 |
| 3 | `privacy-cash-backend` | `npm install && PORT=3002 npm run dev` | 3002 |
| 4 | `my-app` | `npm install && NEXT_PUBLIC_PRIVACY_CASH_API=http://localhost:3002 npm run dev` | 3000 |

- **App:** http://localhost:3000  
- **Issuance API:** http://localhost:3001  
- Env: `w3b-token/.env`, `privacy-cash-backend/.env` (see root README). `my-app` can use `.env.local`; no `.env.example` in repo for it.

---

## 3. Phase History (Summary)

- **Phase 0 (Security):** Rotate secrets; store only in platform env (Vercel, etc.). Log in `docs/SECURITY_ROTATION_LOG.md`.
- **Phase 1 (Verify):** Proof pipeline fixed: update reserves → submit proof → mint. Guardrails: do not reduce reserves below supply (submit-proof + auto-verify). Devnet resync done; batch "Value" shows cents. See `docs/PHASE1_EXECUTION_REPORT.md`.
- **Phase 2 (Locked):** Devnet program ID `9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6`. UserProfile optional for buy/burn; points off-chain now, on-chain claim later. See `docs/PHASE_PLAN.md`.
- **Phase 3 (Devnet readiness):** Scripts: `my-app/scripts/sync_price_cli.ts`, `w3b-token/services/api/scripts/devnet_seed_reserves_and_mint.ts`, `devnet_verify_buy_burn_points.ts`. Report blocked on RPC/env in one run; runbooks are the source of truth. See `docs/PHASE3_EXECUTION_REPORT.md`.
- **Phase 4 (Checkout loyalty):** Server-driven checkout: `POST /api/checkout/direct/create`, `POST /api/checkout/direct/confirm`, `GET /api/loyalty/balance`. Idempotent points; reconciliation queries in `my-app/docs/PHASE4_OPERATIONS_RUNBOOK.md`.
- **Phase 5 (Future):** On-chain claim of off-chain points (voucher/signature, no backend signing on-chain). See `docs/PHASE_PLAN.md`.

---

## 4. Key Concepts

- **Issuance loop:** Physical serials → Supabase → Noir prover → Merkle root + proof on-chain → `mint_wgb` to treasury. Scripts in `w3b-token/services/api/scripts/` (generate-prover, prove-batches, submit-proof). Guardrails prevent reserves < supply unless `ALLOW_INSOLVENT_UPDATE=true`.
- **Devnet resync:** If UI shows insolvent (reserves < supply), add serials in Supabase so count ≥ supply, then run pipeline with **mint delta 0**. See `docs/DEVNET_RESYNC_PLAN.md`.
- **Checkout:** Direct SOL/USDC to merchant; or Private Payment (Privacy Cash: shield → withdraw to merchant). Create order via API, then confirm after on-chain payment. See `my-app/src/app/checkout/README.md`.
- **Loyalty:** Points from direct checkout (and other sources); stored in `LoyaltyPointsEvent`; balance via `/api/loyalty/balance`. Private payment can opt out of wallet linkage.
- **Pricing:** On-chain `wgb_price_lamports` is execution source of truth. DB/cron for observability. Recovery: `POST /api/admin/price/sync` (with webhook secret) or `sync_price_cli.ts`.

---

## 5. Important Paths and Scripts

- **Issuance API:** `w3b-token/services/api` — `npm run generate-prover`, `npm run prove-batches`, `npm run submit-proof`; scripts: `submit_proof.ts`, `devnet_seed_reserves_and_mint.ts`, `devnet_verify_buy_burn_points.ts`, `setup_token.ts`.
- **Admin/verify:** `my-app` — auto-verify route (update root + proof + mint); price sync via `/api/admin/price/sync` or `my-app/scripts/sync_price_cli.ts`.
- **Checkout API:** `my-app/src/app/api/checkout/direct/create`, `confirm`; loyalty: `my-app/src/app/api/loyalty/balance`.
- **Staking (future):** `w3b-token/programs/wgb_staking`; Transfer Fee on WGB mint; `inject_yield` permissionless. Risks: first-depositor rounding, transfer fee on vault — see `docs/PLAN/Future_Features/wgb_staking_build_analysis.md`.

---

## 6. Environment and Config

- **w3b-token:** `.env` — GOLDAPI_API_KEY, SUPABASE_*, SOLANA_RPC_URL, DATABASE_URL, DIRECT_URL, SERVICE_API_SECRET.
- **privacy-cash-backend:** `.env` — PORT=3002 (local), SOLANA_RPC_URL, PRIVACY_ALLOWED_ORIGINS.
- **my-app:** No `.env.example` in repo; use `.env.local` or platform env. For local: NEXT_PUBLIC_PRIVACY_CASH_API=http://localhost:3002. Demo: PRICE_HEALTH_BYPASS_LOCAL=true possible.
- **mobile-app:** `.env` — EXPO_PUBLIC_* (API base URL, RPC, WGB program/mint/treasury/state PDA). Use native dev client for wallet flows.

---

## 7. Docs Quick Index

| Doc | Purpose |
|-----|--------|
| `README.md` | Project overview, stack, 4-terminal run instructions |
| `docs/PHASE_PLAN.md` | Phase 2/3/4/5 scope, checkout loyalty design |
| `docs/PHASE1_EXECUTION_REPORT.md` | Verify rehearsal, proof order fix, guardrails, resync addendum |
| `docs/PHASE3_EXECUTION_REPORT.md` | Devnet upgrade/price/seed/verify scripts; blocked run notes |
| `docs/DEVNET_RESYNC_PLAN.md` | Resync when reserves < supply; UI value fix; guardrails |
| `docs/SECURITY_ROTATION_LOG.md` | Phase 0 secrets rotation checklist |
| `my-app/docs/PHASE4_OPERATIONS_RUNBOOK.md` | Checkout/loyalty certification, reconciliation queries, price sync |
| `my-app/src/app/checkout/README.md` | Checkout flow, Private Payment, fees |
| `my-app/DEPLOYMENT.md` | Env, network, Vercel, RPC recommendations |
| `privacy-cash-backend/README.md` | Why separate backend; deploy e.g. Railway |
| `docs/PLAN/DEMO_SCRIPT.md` | ~5 min devnet demo script |
| `docs/PLAN/Future_Features/wgb_staking_build_analysis.md` | WGB staking build, risks, next phases |
| `docs/PLAN/Future_Features/w3b_liquid_staking_architecture.md` | Liquid staking design (stW3B, transfer fee, yield) |
| `mobile-app/README.md`, `docs/*` | Mobile env, EAS, deployment, dashboard/checkout parity specs |
| `my-app/Clean_Slate_Plan/token.md` | Original three blockers (price, treasury, UserProfile); “not mainnet” list |

---

## 8. Current State (as of this write)

- **main** is the branch with latest commit (merge from codex/devnet-resync-guardrails).
- **Devnet:** Program ID fixed; optional UserProfile; guardrails in place. Resync and batch value fix applied per Phase 1 addendum.
- **Not mainnet-ready per Clean Slate:** Audit, multisig, key management, rate limiting, transfer_checked, reconciliation, redemption UI, etc. — see `Clean_Slate_Plan/token.md` and security runbooks.

---

*When in doubt, prefer this file plus the specific doc from §7 for depth.*
