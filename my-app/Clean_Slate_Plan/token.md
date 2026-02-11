Great questions. Here's where things stand:
Will a purchase work right now? No -- 3 blockers:
Price is zero. The reset zeroed out w3b_price_lamports. An operator needs to call set_w3b_price first (this happens automatically via the auto-verify pipeline when it scrapes the Goldback rate, or you can set it manually).
Treasury is empty. Total supply is 0 -- no tokens have been minted into the treasury. The buy_w3b instruction tries to transfer W3B from the treasury to the buyer, so if there's nothing to transfer, it fails. You need to run the verify pipeline (add serials, submit proof, mint tokens) to stock the treasury.
UserProfile PDA required. The swap UI doesn't call init_user_profile before buy_w3b. First-time buyers will fail because Anchor expects the UserProfile PDA to exist (even though it's marked Option in the code, the bump constraint still requires it). Either the UI needs to bundle an init_user_profile instruction before the buy, or we make user_profile truly optional.
To make a test purchase work, you'd need to:
Set the price via set_w3b_price (or let auto-verify do it)
Add test serials, submit proof, and mint tokens into the treasury
Fix the user profile flow (either auto-init in the UI or remove the bump constraint)
Is this mainnet ready? Not yet. Here's what's missing:
No audit. The smart contract hasn't been audited. For a financial protocol handling real money, this is non-negotiable.
No multisig. The authority is a single keypair. Mainnet should use a multisig (Squads, Realms) so no single person can drain the treasury or pause the protocol.
Keypair in .env files. The authority private key is in plain text in .env.local and w3b-token/.env. On mainnet, this should be in a hardware wallet or HSM.
Public devnet RPC. You're using Helius devnet. Mainnet needs a paid, rate-limited RPC with failover.
No rate limiting on the API. The goldback-rate endpoint, auto-verify webhook, and others have no authentication or rate limiting beyond basic checks.
Token-2022 transfer uses deprecated transfer instead of transfer_checked. This is a warning in the build output -- it should be fixed for production.
No error recovery. If the auto-verify pipeline fails mid-way (e.g., minted but didn't update Supabase), there's no reconciliation logic.
P2P fulfillment is on-chain but untested. claim_redemption, confirm_delivery exist in the contract but have no frontend UI or end-to-end testing.
Yield is state-only. The yield fields exist in ProtocolState but the distribution cron doesn't exist yet.
What would the next phase be?
Realistically, in order of priority:
Fix the 3 blockers above so the buy flow works end-to-end on devnet (price, treasury supply, user profile)
End-to-end test the full loop: add serials -> verify -> mint -> buy -> redeem
Build the redemption UI (the Redeem tab exists but needs the shipping form and status tracker)
Security hardening -- multisig authority, move keypairs to secure storage, add rate limiting
Audit the smart contract
Mainnet deployment with real Goldback serials
Want me to fix the 3 blockers so you can test a purch