# GoldBack Mobile Submission Brief

## Short Submission Narrative
GoldBack Mobile is a native Android application that brings physical GoldBack commerce and protocol visibility onto Solana mobile. The team already had a web platform, but the hackathon work focused on building a real mobile app rather than shipping a wrapper or minimal port. The Android app includes a checked-in native project, Solana Mobile Wallet Adapter support, mobile-specific navigation, wallet entry, protected mobile auth, checkout persistence, and restart recovery for direct physical GoldBack purchases.

This submission is intentionally Android-first. The app demonstrates that physical GoldBack purchasing and Web3 verification flows can live in a mobile-native experience built for Solana wallets and Android distribution. It is the foundation for post-hackathon dApp Store publication.

## Why This Is Significant Mobile-Specific Development
1. Native Expo/React Native app with a checked-in `android/` project.
2. Solana Mobile Wallet Adapter runtime support requiring a native binary.
3. Mobile-specific bottom-tab navigation and wallet sheet UX.
4. Local persistence and restart recovery for interrupted mobile flows.
5. Mobile checkout flow for physical GoldBack purchasing.

## Suggested Deck Outline
1. Problem
   - Physical gold is difficult to use in digital and mobile-native commerce.
2. Solution
   - GoldBack Mobile brings GoldBack purchasing and protocol visibility into a native Android experience on Solana.
3. Why Mobile
   - The phone is the primary commerce device. Native wallet access and mobile recovery are critical.
4. What We Built During the Hackathon
   - Native Android app shell
   - Solana mobile wallet-ready architecture
   - Gold Collection shopping flow
   - Mobile checkout and restart recovery
   - Web3 dashboard / vault / redeem surfaces
5. Architecture
   - `mobile-app` for Android client
   - `my-app` backend APIs for auth, catalog, checkout, orders, loyalty, protocol status, redemption
6. Demo Flow
   - Launch app
   - Browse Gold Collection
   - Checkout flow
   - Recovery / verification surface
7. Roadmap
   - dApp Store publication
   - stronger wallet signing path
   - production hardening and release signing

## Form-Safe Claims
Use these exact claims in the form or narration:
1. This submission is a native Android app.
2. It is not a PWA wrapper.
3. The mobile build includes significant new Android-specific development.
4. dApp Store publishing is planned after submission, not required by the deadline.
