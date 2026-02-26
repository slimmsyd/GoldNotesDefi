# W3B Liquid Staking Architecture

This document outlines the proposed architecture and critical considerations for implementing a **Staking and Liquid Staking** feature for the `$W3B` token on Solana.

## 1. The Core Concept

Since `$W3B` is backed 1:1 by physical Goldbacks, creating a Liquid Staking derivative (e.g., `stW3B`) allows users to earn yield while maintaining token liquidity for DeFi use cases.

When a user stakes their `$W3B` in the protocol's Stake Pool, they receive `stW3B` in return. `stW3B` acts as a receipt token that appreciates in value against `$W3B` as the pool accrues yield.

## 2. Yield Generation: Protocol Revenue Sharing

**The Challenge:** Gold itself does not naturally generate yield. To provide an APY for staking `$W3B`, we must capture value from the token's ecosystem.

**The Solution:** We will implement **Protocol Revenue Sharing**. This is the safest, most robust, and regulatorily compliant method for a physical-backed asset. 

By enabling the **SPL Token-2022 Transfer Fee Extension** on the `$W3B` token, the protocol automatically collects a small percentage (e.g., 0.1%) of every `$W3B` transfer. These collected fees are routed to a Protocol Treasury wallet.

Periodically, the `w3b_staking` contract will sweep these fees from the Treasury and inject them into the Stake Pool. Because the amount of `$W3B` in the pool increases while the supply of `$stW3B` receipt tokens remains constant, the "Exchange Rate" of `$stW3B` goes up.

*This creates a positive feedback loop: as `$W3B` gains adoption and transfer volume increases, the APY for stakers also increases, without relying on risky third-party lending protocols.*

## 3. Smart Contract Architecture (Solana / Anchor)

We will introduce a new Anchor program: `w3b_staking`.

### Accounts
- **`StakePool` (PDA):** Stores the global state of the staking protocol (total `$W3B` deposited, total `stW3B` minted, fee parameters, and the exchange rate).
- **`Vault` (Token Account):** A PDA owned by the `StakePool` that securely holds the staked `$W3B`.
- **`stW3B Mint`:** The SPL Token (Token-2022) mint that represents the liquid staked asset.

### Key Instructions
1. **`InitializePool`:** Creates the `StakePool`, `Vault` and `stW3B Mint`.
2. **`Deposit`:** User transfers `$W3B` into the `Vault`. The program mints `stW3B` to the user based on the current exchange rate.
3. **`Withdraw` / `Unstake`:** User burns `stW3B`. The program un-locks and transfers `$W3B` back to the user.
4. **`InjectYield`:** An instruction (permissioned or permissionless) to deposit additional `$W3B` into the `Vault` without minting new `stW3B`, thereby increasing the exchange rate for all existing stakers.

The exchange rate formula is simply:
`Exchange Rate = (Total W3B in Vault) / (Total stW3B Minted)`

## 4. Integration with Existing "Sacred Issuance"

Adding a staking layer sits perfectly **on top** of the existing architecture without breaking the Zero-Knowledge proofs:

- The off-chain API, Noir ZK proofs, and base `$W3B` minting process remain completely unaffected.
- The ZK circuit proves that physical Goldbacks equal the total supply of `$W3B`.
- The `w3b_staking` program just locks up some of that circulating `$W3B`. `$stW3B` is fully backed by on-chain `$W3B`, which is backed by the ZK-proven physical Goldbacks.

## 5. Things to Consider to Develop

1. **Token-2022 Features:** We can use the **Interest-Bearing Extension** natively available in Token-2022 for the `stW3B` token. This allows the UI to automatically show the yield accruing over time natively in wallets (like Phantom).
2. **Liquidity & Lockups:** Should unstaking be instantaneous, or should there be an un-bonding curve (e.g., 3-day wait) to protect protocol liquidity? If lending is used for yield, a wait time is usually required.
3. **Regulatory:** Staking physical assets and offering APY can trigger different security regulations than simply offering a physical-backed stablecoin.

## Next Steps

1. Configure the **Token-2022 Transfer Fee Extension** during the initialization of the `$W3B` mint.
2. Determine if there should be **lockup periods** for unstaking.
3. Initialize the `w3b_staking` Anchor workspace and build the fee-sweeping mechanism.
