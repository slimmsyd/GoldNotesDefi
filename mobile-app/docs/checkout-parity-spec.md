# Checkout Parity Spec (Web -> Mobile, SOL-Only)

## Scope
- Preserve web checkout design direction and behavior patterns from `my-app/src/app/checkout/page.tsx`.
- Adapt layout and controls for mobile vertical flow.
- Keep SOL direct checkout only in this phase.
- Prioritize visual parity on `2. DETAILS` while aligning `1. CART` and `3. PAYMENT`.

## Included Behaviors
- 3-step progression: `1. CART -> 2. DETAILS -> 3. PAYMENT`.
- Step gating:
  - Cannot continue without direct cart items.
  - Details must have name/email/address and a selected shipping method.
- Step clickability:
  - `1. CART` is clickable from details/payment.
  - `2. DETAILS` is clickable only from payment.
  - `3. PAYMENT` is a non-clickable status label.
- Empty cart handling in cart step.
- Pending recovery:
  - Resume and finalize saved `{ orderId, txSignature }` on app load.
  - Recovery is silent in UI (no debug/pending JSON output).
- Post-success cleanup:
  - Clear pending checkout.
  - Clear local cart.
  - Clear remote cart (when authenticated).
- Success state:
  - Show order id, tx signature, points awarded, and balance.

## Explicitly Excluded
- USDC payment flow.
- Private Payment flow.
- Amazon/SP3ND checkout branch UI.

## Visual Direction Mapping
- Keep wallet-first commerce header with top-right wallet action.
- Use web-like checkout shell:
  - back link row (`Back to Home`)
  - centered `CHECKOUT` title
  - slash-delimited progress labels.
- Use details-step styling with micro uppercase labels and underline inputs.
- Keep shipping methods explicit and selectable.
- Keep rounded corners aligned with Home/Shop language.
- Keep status messaging visible during payment lifecycle.

## Data Contracts (Mobile Consumption)
- `GET /api/shop/catalog`
  - Includes normalized `imageUrl` for mobile-safe rendering.
- `GET /api/checkout/shipping-options`
  - Returns required and available shipping methods for subtotal/international state.
- `GET /api/user/profile` and `POST /api/user/profile`
  - For prefill and optional save of shipping info.
- `POST /api/checkout/direct/create`
- `POST /api/checkout/direct/confirm`

## Mobile Validation Checklist
- Add/remove direct items and see subtotal update.
- Toggle international shipping and verify shipping options refresh.
- Save shipping profile when authenticated.
- Execute SOL payment and confirm points + order completion.
- Force close during pending state and verify single recovery finalization.
- Confirm no `Recovered Pending` block or debug JSON appears in checkout UI.
