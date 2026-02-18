# Phase 3 Execution Report (Hard-Gated)

Last updated: 2026-02-17 (America/Los_Angeles)  
Scope: Phase 3 close-out for devnet readiness (`Step 4 + Step 5`) before Phase 4 continuation  
Status: **Blocked / In Progress**

## 1) Environment Snapshot

### Tooling Versions
```bash
solana-cli 3.0.13 (src:90098d26; feat:3604001754, client:Agave)
anchor-cli 0.32.1
v24.10.0
11.6.1
```

### Solana CLI Config
```bash
Config File: /Users/sydneysanders/.config/solana/cli/config.yml
RPC URL: https://api.devnet.solana.com
WebSocket URL: wss://api.devnet.solana.com/ (computed)
Keypair Path: /Users/sydneysanders/.config/solana/mainnet-wallet.json
Commitment: confirmed
```

Notes:
- Cluster is configured to `devnet` (expected).
- Keypair path is `mainnet-wallet.json`; verify this is intended for devnet operator actions before deploy/mint.

## 2) Commands Run (Exact)

### WS-A Preflight
```bash
solana --version && anchor --version && node -v && npm -v
solana config get
solana program show -u devnet 9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6
```

Observed:
```bash
Error: AccountNotFound: pubkey=9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6: error sending request for url (https://api.devnet.solana.com/)
```

### WS-B Build/Test
```bash
cd w3b-token/programs/w3b_protocol
anchor clean && anchor build
anchor test
```

Observed:
- `anchor clean && anchor build`: **success**.
- `anchor test`: **failed** with host runtime panic:
```bash
thread 'main' panicked at .../system-configuration-0.5.1/src/dynamic_store.rs:154:1:
Attempted to create a NULL object.
```
- Additional note from build:
  - Anchor dependency mismatch warning (`@coral-xyz/anchor ^0.30.1` vs CLI `0.32.1`).

## 3) On-Chain Before/After State Table

| Item | Before | After | Status |
|---|---:|---:|---|
| Program account reachable | Not captured (RPC/account lookup failed) | Not captured | Blocked |
| Program executable | Not captured | Not captured | Blocked |
| Upgrade authority verified | Not captured | Not captured | Blocked |
| `w3b_price_lamports` | Not captured | Not captured | Pending WS-C |
| `proven_reserves` | Not captured | Not captured | Pending WS-D |
| `total_supply` | Not captured | Not captured | Pending WS-D |
| Treasury token balance | Not captured | Not captured | Pending WS-D |

## 4) Upgrade Evidence (WS-B / Step 4)

Required artifacts (pending):
- [ ] Pre-upgrade `solana program show -u devnet 9xZaf2...`
- [ ] Deploy command + tx signature
- [ ] Post-upgrade `solana program show -u devnet 9xZaf2...`
- [ ] Proof of same program ID and executable state

Current state:
- [ ] Not executed to completion in this environment due devnet lookup failure.

## 5) Price + Reserve + Supply Evidence (WS-C / WS-D)

### New Script Added (WS-C)
Path:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/scripts/sync_price_cli.ts`

Interface:
```bash
npx ts-node my-app/scripts/sync_price_cli.ts --network devnet [--target-lamports <n>] [--force]
```

Expected output:
- JSON with `onChainBefore`, `onChainAfter`, and `syncResult.tx`.

### New Script Added (WS-D)
Path:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api/scripts/devnet_seed_reserves_and_mint.ts`

Interface:
```bash
cd w3b-token/services/api
npx ts-node scripts/devnet_seed_reserves_and_mint.ts --target-reserves 5000 --mint-delta auto
```

Semantics:
- Ingestion-aligned reserve delta minting:
  - `reserveDelta = max(0, targetReserves - currentReserves)`
  - `mintAmount = reserveDelta` (or bounded manual override)
- Explicitly prevents minting above reserve increase (no burn-gap backfill).

Expected output:
- JSON with `pre`, `post`, tx ids for `updateMerkleRoot`, `submitProof`, `mintW3B`, plus checks:
  - `treasuryHasSupply`
  - `supplyLeqReserves`
  - `proofFreshForMint`

Execution evidence:
- [ ] Pending live run from operator machine.

## 6) Verification Scenario Matrix (WS-E)

### New Script Added
Path:
- `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api/scripts/devnet_verify_buy_burn_points.ts`

Interface:
```bash
cd w3b-token/services/api
npx ts-node scripts/devnet_verify_buy_burn_points.ts --amount 1 --fund-sol 0.2
```

Machine-readable output:
- JSON with `results[]`:
  - `buy_null_profile`
  - `burn_null_profile`
  - `buy_wrong_profile_rejected`
  - `valid_profile_points_update`

Expected each scenario to include:
- `pass`
- `txSignature` (where applicable)
- `explorerUrl` (where applicable)

Execution evidence:
- [ ] Pending live run from operator machine.

## 7) `/app` Devnet Smoke Evidence (WS-F)

Required capture:
- [ ] `/app` launch with devnet env
- [ ] Buy path succeeds once (tx link)
- [ ] Burn path succeeds once (tx link)
- [ ] No blocking simulation/runtime errors
- [ ] Screenshots attached

Execution evidence:
- [ ] Pending.

## 8) Phase 3 Acceptance Checklist (Hard Gate)

- [ ] Program upgraded in place at `9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6`
- [ ] Upgrade authority and executable state verified post-upgrade
- [ ] On-chain price non-zero and confirmed
- [ ] Treasury has spendable W3B and `totalSupply <= provenReserves`
- [ ] Buy/Burn/Points scenarios pass on devnet with tx evidence
- [ ] This report contains final evidence and pass/fail matrix

## 9) Final Verdict

**Current verdict: `Blocked`**  
Reason:
1. Devnet program account lookup failed in this environment (`AccountNotFound`/RPC request failure).
2. `anchor test` failed locally with host runtime panic (`Attempted to create a NULL object`), so local test gate is not closed yet.
3. Live WS-C/WS-D/WS-E/WS-F executions are pending operator run with working RPC and deploy authority context.

## 10) Next Operator Commands (Run in Order)

```bash
# 1) Re-verify program visibility and authority on devnet
solana program show -u devnet 9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6

# 2) Upgrade in place (if needed)
cd /Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/programs/w3b_protocol
anchor build
solana program deploy -u devnet target/deploy/w3b_protocol.so --program-id 9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6 --upgrade-authority /Users/sydneysanders/.config/solana/mainnet-wallet.json

# 3) Price sync (Phase 3 WS-C)
cd /Users/sydneysanders/Desktop/Code_Projects/GoldBackProject
npx ts-node my-app/scripts/sync_price_cli.ts --network devnet

# 4) Ingestion-aligned reserve/supply seed (WS-D)
cd /Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/w3b-token/services/api
npx ts-node scripts/devnet_seed_reserves_and_mint.ts --target-reserves 5000 --mint-delta auto

# 5) Behavioral verification matrix (WS-E)
npx ts-node scripts/devnet_verify_buy_burn_points.ts --amount 1 --fund-sol 0.2
```

