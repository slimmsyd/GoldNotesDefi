# Checkout Flow

This directory contains the checkout page for purchasing physical Goldbacks using crypto.

## Payment Methods

The checkout supports three payment methods:

1.  **USDC**: Standard stablecoin payment. The user sends USDC directly to the merchant wallet.
2.  **SOL**: Native Solana payment. The user sends SOL directly to the merchant wallet.
3.  **Private Payment (via Privacy Cash)**: A privacy-preserving SOL payment that breaks the on-chain link between the user's main wallet and the purchase.

## Private Payment Flow

The **Private Payment** option uses [Privacy Cash](https://privacycash.mintlify.app/) to shield the user's funds before sending them to the merchant. This provides **wealth privacy**, not transaction anonymity.

### Why Use Private Payment?

When a user pays with standard SOL or USDC, the merchant (and any public observer) can see the user's full wallet address. From this address, anyone can view:
-   The user's total portfolio value.
-   Their entire transaction history.
-   All other assets they hold.

For customers purchasing gold as a hedge for wealth preservation, revealing their total crypto net worth to a merchant (or in a public transaction) is a significant privacy concern.

**Private Payment solves this by:**
1.  **Shielding**: The user deposits SOL into the Privacy Cash pool. Their funds are now commingled with thousands of other users.
2.  **Unshielding**: The user withdraws SOL from the pool *directly to the merchant*. The public transaction shows `Privacy Pool → Merchant`, with no link back to the user's original wallet.

### User Flow

1.  At checkout, user selects "Private Payment."
2.  A modal explains the privacy benefit and shows the fee breakdown.
3.  User clicks "Start Private Payment."
4.  User signs a message to unlock their Privacy Cash account (this derives an encryption key from their wallet).
5.  System deposits funds into the privacy pool.
6.  System generates a zero-knowledge proof.
7.  System withdraws funds directly to the merchant.
8.  Order is confirmed.

### Fees

Privacy Cash charges a withdrawal fee:
-   **0.35%** of the withdrawal amount
-   **+ 0.006 SOL** fixed fee

This fee is passed through to the user and displayed clearly before they confirm.

### Mobile Recovery

If the user's mobile wallet app (e.g., Phantom) reloads the page during the payment process, the shielded state is persisted in `localStorage`. The next time they visit checkout, they will be prompted to recover their shielded funds and complete the payment.

## Files

-   `page.tsx`: Main checkout page with cart, details, and payment steps.
-   `../components/checkout/private-payment-flow.tsx`: Multi-step UI for the private payment experience.
-   `../lib/privacy-cash-service.ts`: Wrapper service for the `privacycash` SDK.
