# WGB Staking Build — Analysis, Status & Roadmap

## What Was Built (Completed Feb 24, 2026)

### Phase 1: Full W3B → WGB Rename

All references to the old `W3B` token name were renamed to `WGB` across the entire monorepo — approximately 80+ files touched.

**Files changed by area:**

| Area | Scope |
|------|-------|
| Anchor program (`w3b_protocol`) | `lib.rs` (V1 + V2), `Cargo.toml`, `Anchor.toml`, test files |
| Frontend (`my-app/`) | `wgb-program.ts` (renamed from `w3b-program.ts`), `protocol-constants.ts`, `solana-program.ts`, `price-sync.ts`, `price-cohesion.ts`, all swap/redeem/dashboard/vault components, API routes, `.env*` files |
| Mobile app (`mobile-app/`) | `wgb-program.ts` (renamed), `env.ts`, all screens, `eas.json` |
| Backend scripts (`w3b-token/services/api/scripts/`) | 14 scripts updated (setup_token, submit_proof, devnet seeds, migrate, reset, etc.) |
| Environment variables | `NEXT_PUBLIC_W3B_*` → `NEXT_PUBLIC_WGB_*` (frontend), `EXPO_PUBLIC_W3B_*` → `EXPO_PUBLIC_WGB_*` (mobile) |

**Key renames within Rust/TS:**
- `W3BError` → `WGBError`
- `w3b_mint` → `wgb_mint` (account field)
- `w3b_price_lamports` → `wgb_price_lamports`
- `mint_w3b` / `buy_w3b` / `burn_w3b` → `mint_wgb` / `buy_wgb` / `burn_wgb`
- `createBuyW3bInstruction` → `createBuyWgbInstruction` (and all similar helpers)

### Phase 1E: Transfer Fee Extension Added to Mint

The `setup_token.ts` script was updated to create the WGB mint with the **Token-2022 Transfer Fee Extension**:

```typescript
createInitializeTransferFeeConfigInstruction(
    mintKeypair.publicKey,
    protocolStatePda,          // transferFeeConfigAuthority
    protocolStatePda,          // withdrawWithheldAuthority
    10,                        // feeBasisPoints = 0.1%
    BigInt(1000),              // maxFee = 1000 tokens
    TOKEN_2022_PROGRAM_ID
)
```

- The `ProtocolState` PDA is the fee authority, meaning only the program can update fee params or harvest withheld fees
- This was impossible to add post-mint — the clean devnet reset made this possible

### Phase 2: `wgb_staking` Anchor Program

**Program ID (devnet):** `HWufoUDwQDXPDwcyECk1PHmBJi4ziFY913U7jfSoLqy2`  
**IDL uploaded at:** `ELobKG98n4pDW7p4a8rvh7ddEXPfBLetkGxzvjxmRanS`

**Location:** `w3b-token/programs/wgb_staking/`

#### Accounts
- **`StakePool` PDA** (seeds: `["stake_pool"]`) — global state: `total_wgb_deposited`, `total_st_wgb_minted`, `authority`, `wgb_mint`, `st_wgb_mint`, `vault`, `fee_basis_points`, `unbonding_period`, `is_paused`

#### Instructions

| Instruction | Access | Description |
|-------------|--------|-------------|
| `initialize_pool` | Admin only | Creates StakePool PDA, links WGB mint + stWGB mint + vault |
| `deposit` | Public | Transfer WGB → vault, mint stWGB at exchange rate |
| `withdraw` | Public | Burn stWGB → return WGB from vault at exchange rate |
| `inject_yield` | Permissionless | Deposit WGB without minting stWGB (raises exchange rate) |
| `set_paused` | Admin only | Pause/unpause the pool |

#### Exchange Rate Math
```
Exchange Rate = total_wgb_deposited / total_st_wgb_minted

Deposit:  st_wgb_minted = amount * total_st_wgb_minted / total_wgb_deposited
Withdraw: wgb_returned  = st_wgb_burned * total_wgb_deposited / total_st_wgb_minted
```
All arithmetic uses u128 intermediaries (multiply-before-divide) to prevent overflow.

#### Test Coverage
10 test cases covering:
- Pool initialization
- First deposit (1:1 rate)
- Second user deposit
- Yield injection (exchange rate increase verification)
- Withdrawal at appreciated rate (2x return)
- Zero amount rejection
- Pause/unpause behavior
- Full withdrawal (pool drain to 0/0)

---

## Scalability & Maintainability Analysis

### What's Working Well

**1. Clean Program Separation**
The `wgb_staking` program is fully decoupled from `wgb_protocol`. They share only the WGB token mint as a communication point — there are no cross-program state dependencies. This means:
- Each program can be upgraded, audited, and bug-fixed independently
- The staking program can be deployed on any SPL Token-2022 asset, not just WGB
- A security issue in staking doesn't compromise the issuance protocol (and vice versa)

**2. Permissionless Yield Injection**
`inject_yield` requires no admin signature — anyone can deposit WGB to increase the exchange rate. This is intentional and correct: it means the fee-sweep mechanism can be automated by a simple keeper bot, a cron job, or even be called by users directly. No single point of failure.

**3. Modular File Structure**
Each instruction lives in its own file (`instructions/deposit.rs`, etc.). As the program grows with new features (unbonding queues, governance, reward boosts), new files can be added without touching existing logic.

**4. Event Emission**
Every state-changing instruction emits a structured event (`Deposited`, `Withdrawn`, `YieldInjected`, `PoolInitialized`). This is critical for off-chain indexers to reconstruct exchange rate history, track user positions, and power the frontend without expensive RPC polling.

### Known Technical Risks

**1. Rounding Attack on First Deposit (HIGH — needs fixing before mainnet)**

The current implementation sets `st_wgb_amount = amount` on the first deposit (when the pool is empty). A sophisticated attacker can:
1. Deposit 1 WGB → receive 1 stWGB
2. Directly `inject_yield` with 999 WGB → exchange rate becomes 1000:1
3. Any subsequent depositor who deposits fewer than 1000 WGB gets 0 stWGB back (rounds to zero)

**Mitigation options:**
- Require a minimum first deposit (e.g., 100 WGB)
- Use a virtual offset — permanently add a "phantom" 1000 WGB to the denominator:
  ```
  st_wgb = amount * (total_st_wgb + VIRTUAL_OFFSET) / (total_wgb + VIRTUAL_OFFSET)
  ```
- Use ERC-4626's dead shares pattern: at pool initialization, mint a small amount of stWGB to a dead address that can never be claimed

**2. Transfer Fee Deduction on Vault Deposits (MEDIUM)**

When a user calls `deposit(100)`, the WGB Transfer Fee Extension deducts 0.1% from the transfer before the vault receives it. At 100 WGB with 0.1% fee, the vault receives 99 WGB but `total_wgb_deposited` is incremented by 100. Over time this creates a small discrepancy between the tracked state and the actual vault balance.

**Mitigation:** Read the vault's token balance delta after the transfer instead of trusting the input `amount`:
```rust
let vault_before = ctx.accounts.vault.amount;
// ... do transfer ...
let vault_after = ctx.accounts.vault.reload()?.amount;
let actual_received = vault_after - vault_before;
// Use actual_received for state update
```

**3. Integer Arithmetic Precision (LOW)**

WGB has 0 decimals. This means the exchange rate is expressed as a ratio of whole integers. A user holding 1 stWGB when the rate is 1.5 WGB/stWGB will only get 1 WGB back (floor division), effectively losing 0.5 WGB to the pool.

This is acceptable behavior for integer tokens, but the UI must clearly communicate the exchange rate so users understand the rounding.

**4. No Unbonding Queue**

The current `withdraw` is instant. If a lockup period (`unbonding_period > 0`) were ever enabled, the code path currently creates an `UnbondingRequest` PDA instead of an immediate transfer — but that PDA struct and the `claim_unbonding` instruction are not yet implemented. Setting `unbonding_period > 0` would leave users unable to claim their WGB.

---

## Next Logical Phases

### Phase 3: Frontend Staking UI

Build the `/app/stake` page following the existing swap interface patterns.

**Scope:**
- New route: `my-app/src/app/app/stake/page.tsx`
- New component: `my-app/src/components/app/stake/stake-interface.tsx`
- Tabs: "Stake" | "Unstake"
- Display: current exchange rate, user's stWGB balance, estimated WGB on unstake, APY estimate
- Transaction flow matching the existing multi-step pattern: input → review → processing → success
- Update `app-header.tsx` to include stWGB balance in the portfolio display
- Add "Stake" link to the app navigation

**New library file needed:** `my-app/src/lib/wgb-staking-program.ts`
- Instruction builders: `createStakeInstruction`, `createUnstakeInstruction`
- State reader: `fetchStakePoolState` (reads `StakePool` PDA)
- Helper: `calculateAPY` (estimate based on historical `YieldInjected` events)

### Phase 4: Fee Sweep Automation

Implement the yield flywheel — periodically harvest WGB transfer fees from the protocol treasury and inject them into the staking vault.

**Scope:**
1. A new Anchor instruction on `wgb_protocol`: `harvest_transfer_fees`
   - Uses Token-2022's `harvest_withheld_tokens_to_mint` and `withdraw_withheld_tokens_from_mint` CPIs
   - Transfers collected fees from the WGB mint's withheld balance to a fee treasury account
2. A new API route: `my-app/src/app/api/cron/inject-staking-yield/route.ts`
   - Reads withheld fee balance from the WGB mint
   - Calls `harvest_transfer_fees` on `wgb_protocol`
   - Calls `inject_yield` on `wgb_staking`
   - Runs on a schedule (e.g., daily via Vercel cron)
3. Add to `vercel.json` cron config alongside existing `update-rate`

### Phase 5: Unbonding Queue (Optional)

If regulatory guidance or liquidity management requires a lockup period before unstaking.

**Scope:**
- New account: `UnbondingRequest` PDA (seeds: `["unbonding", user, request_id]`)
- Modified `withdraw` instruction: creates `UnbondingRequest` instead of immediate transfer when `unbonding_period > 0`
- New instruction: `claim_unbonding` — transfers WGB to user after the lockup period elapses
- Frontend: "Pending Unstakes" section showing countdown timers

### Phase 6: Rounding Attack Hardening

Before any mainnet deployment, implement one of the mitigation strategies for the first-depositor rounding attack described in the risk analysis above. The recommended approach is the ERC-4626 dead shares pattern as it requires no ongoing parameter tuning.

### Phase 7: Mainnet Deployment

- Audit `wgb_staking` program (recommended: OtterSec or Neodyme)
- Regenerate program keypair for mainnet (separate from devnet)
- Update all `NEXT_PUBLIC_WGB_*` env vars with mainnet addresses
- Configure Transfer Fee parameters (consider starting at 5 bps to test before increasing)
- Monitor exchange rate and TVL via on-chain event indexing

---

## Current Devnet Addresses

| Component | Address |
|-----------|---------|
| `wgb_protocol` Program | `9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6` |
| `wgb_staking` Program | `HWufoUDwQDXPDwcyECk1PHmBJi4ziFY913U7jfSoLqy2` |
| `wgb_staking` IDL Account | `ELobKG98n4pDW7p4a8rvh7ddEXPfBLetkGxzvjxmRanS` |

> Note: WGB mint and treasury addresses will be regenerated on the next `setup_token.ts` run (which now includes the Transfer Fee Extension).
