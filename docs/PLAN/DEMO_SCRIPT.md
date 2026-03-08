# GoldBack Protocol — Demo Script

**Network:** Solana Devnet  
**Duration:** ~5 minutes  
**Prerequisites:** Phantom wallet connected, funded with devnet SOL

---

## Pre-Demo Checklist

Before presenting, verify these are ready:

- [ ] `npm run dev` is running in `my-app/`
- [ ] Phantom wallet is set to **Devnet** network
- [ ] Demo wallet (`2XLYMjni...`) has at least **1 SOL** on devnet
- [ ] `PRICE_HEALTH_BYPASS_LOCAL=true` is set in `.env.local`
- [ ] Protocol has WGB in treasury (run `npm run seed-devnet` if starting fresh)

---

## Act 1 — The Problem We Solve

> *"Physical gold is hard to own. It's hard to verify, hard to transfer, and impossible to use digitally. Goldbacks are physical gold currency — but until now, they had no digital presence. We change that."*

**Open:** `http://localhost:3001` (homepage)

- Point to the **hero section** — "Physical Gold. Digital Proof."
- Scroll to the **How It Works** section — show the 3-step flow: Physical → Proof → Token
- Point to **Asset Backing** and **Proven Reserves** metrics on the dashboard

---

## Act 2 — The Dashboard

> *"Every WGB token is backed 1:1 by a physical Goldback. You can verify this at any time, on-chain, in real time."*

**Navigate to:** `/app` (dashboard)

Point out:
1. **Asset Backing** — Total WGB backed by proven physical reserves
2. **Circulating Supply** — Tokens currently in circulation
3. **Reserves** — Number of physical Goldbacks in the vault
4. **Audit Batches** — Each batch of Goldbacks proven via ZK proof

> *"Each batch is cryptographically proven using a Zero-Knowledge circuit. Not trusted — proven."*

---

## Act 3 — Buying WGB (The Swap)

> *"Now let's actually buy some WGB. I'll pay with SOL and receive Goldback-backed tokens directly to my wallet."*

**Navigate to:** `/app/swap`

1. Connect Phantom wallet (top right)
2. Set **Pay** to `SOL`, enter an amount (e.g. `0.5 SOL`)
3. Observe **Receive** auto-calculates in WGB (`1 WGB = ~0.046 SOL`)
4. Click **Review Swap**

> *"The system checks price health before confirming — the on-chain price is synced with the live Goldback market rate."*

5. Review the swap summary screen
6. Click **Confirm Swap**
7. Approve in Phantom wallet
8. ✅ Show **"Swap Complete!"** screen with Solana Explorer link

> *"The SOL goes directly to the protocol treasury. WGB tokens are transferred from the vault to my wallet instantly. No intermediary."*

**Show:** Header balance updates with new WGB value in USD

---

## Act 4 — The Vault (Redeem / Burn)

> *"WGB is redeemable. You can burn your tokens to claim the physical Goldbacks they represent. Let's initiate a redemption."*

**Navigate to:** `/app/swap` → click **Redeem / BURN** tab

1. Enter amount to redeem (e.g. `1 WGB`)
2. Click **Review Redemption**
3. Review the redemption request summary
4. Click **Confirm** and approve in Phantom

> *"The tokens are burned on-chain. This creates a redemption request tied to your wallet — the protocol now owes you physical Goldbacks."*

5. ✅ Show **"Redemption Initiated"** confirmation

---

## Act 5 — The Admin Dashboard

> *"Behind the scenes, the protocol operator can see all pending redemptions, verify batches, and mint new tokens as physical Goldbacks are received."*

**Navigate to:** `/app/admin`

Point out:
1. **Pending Batches** — Goldbacks received but not yet proven
2. **Verify Now** button — triggers ZK proof submission on-chain
3. **Redemption Requests** — user burn requests awaiting physical fulfillment
4. **Protocol Stats** — live on-chain metrics

---

## Act 6 — The Value Proposition

> *"What we've just seen is the full loop:"*

```
Physical Goldback
      ↓
  ZK Proof (Noir circuit)
      ↓
  Merkle Root anchored on Solana
      ↓
  WGB Minted to Treasury
      ↓
  User Buys WGB with SOL
      ↓
  User Burns WGB → Redemption Request
      ↓
  Physical Goldback shipped
```

> *"Every step is verifiable on-chain. No trust required."*

---

## Reset After Demo

To clean up the devnet state after the demo:

```bash
cd w3b-token/services/api
npm run reset         # Wipes chain state and Supabase
npm run simulate      # Re-seeds 10 test Goldbacks
npm run full-pipeline # Proves + mints
npx ts-node scripts/set_price.ts  # Restores price
```

---

## Talking Points (If Asked)

| Question | Answer |
|---|---|
| "Is this mainnet ready?" | "The protocol is production-grade. We're on devnet for the demo. Mainnet deployment is the next phase." |
| "What stops someone from minting unlimited WGB?" | "Only the protocol authority can call `mint_wgb`, and only after a ZK proof is submitted proving physical reserves exist." |
| "What's the transfer fee?" | "Currently 0% during the demo. The Transfer Fee Extension is in place — we can activate yield-bearing mechanics for stakers in phase 2." |
| "What's the Goldback price tied to?" | "The live spot price of 1/1000 troy oz gold. It updates automatically via our price sync pipeline." |
