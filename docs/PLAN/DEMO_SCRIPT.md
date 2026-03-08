# GoldBack Mobile - Submission Demo Script

**Platform:** Android APK  
**Network:** Solana Devnet  
**Duration:** 4-5 minutes  
**Primary goal:** prove this is a native mobile app with meaningful Android-specific work, not a web wrapper

---

## Pre-Demo Checklist

Before recording, verify these are ready:

- [ ] The demo build is the same APK profile you plan to submit
- [ ] Backend target used by the APK is reachable and stable
- [ ] Gold Collection loads product data and imagery
- [ ] Wallet flow is ready on Android if you plan to show real wallet auth
- [ ] Checkout create/confirm path succeeds on the demo environment
- [ ] Pending checkout recovery has been tested once before recording
- [ ] The app is not being shown inside Expo Go

If real wallet flow is unstable on the recording device, keep the demo focused on:
1. Native app shell
2. Shop and checkout
3. Verification surfaces
4. Restart recovery

---

## Act 1 - Native Mobile Entry

> "This is the GoldBack mobile app running as a native Android build. It is not a PWA wrapper or a direct web port."

Show:
1. App icon on Android
2. App launch into the branded mobile flow
3. Bottom-tab navigation
4. Global wallet entry point

Call out:
1. Native React Native app structure
2. Android build pipeline
3. Mobile-specific navigation and state handling

---

## Act 2 - Gold Collection Commerce Flow

> "The primary mobile experience is direct purchase of physical GoldBacks from a native mobile commerce flow."

Navigate to:
1. `Shop`
2. Scroll through the Gold Collection
3. Show live rate and product imagery

Call out:
1. Mobile-optimized product layout
2. Wallet-first commerce design
3. Backend-driven catalog and price data

---

## Act 3 - Checkout on Mobile

> "Users can move from collection to checkout inside the mobile app and complete the direct purchase flow."

Show:
1. Add an item to cart
2. Open `Checkout`
3. Move through `Cart -> Details -> Payment`
4. Show wallet-aware payment path

Call out:
1. Mobile checkout is not a screenshot of the web UI
2. State persists locally for restart recovery
3. User/account calls are protected by mobile auth

If payment is demonstrated live:
1. Create the order
2. Show payment state
3. Confirm the order result

---

## Act 4 - Recovery and Reliability

> "This app includes mobile-specific persistence and restart recovery so interrupted checkout does not leave the user stranded."

Show one of:
1. Previously saved pending checkout being recovered after reopen
2. Orders / loyalty state after successful flow

Call out:
1. AsyncStorage-backed recovery
2. Mobile state continuity after restart
3. This behavior was built specifically for the Android app

---

## Act 5 - Web3 Verification Surface

> "Beyond checkout, the mobile app includes Web3-native verification surfaces for the protocol."

Navigate to:
1. `Web3`
2. `Dashboard`
3. `Vault`
4. `Redeem` if stable in the demo environment

Point out:
1. WGB price visibility
2. Protocol status / reserves / proof trail
3. Redemption and wallet-aware views

Important:
1. If swap is gated as coming soon, say so directly
2. Do not demo unfinished flows as if they are live

---

## Closing Statement

> "We started with an existing web platform, but the hackathon work was the native Android application: native runtime, native wallet path, native navigation, mobile checkout, persistence, and mobile-specific UX. This is the foundation for Solana mobile distribution."

---

## Talking Points

| Question | Answer |
|---|---|
| "Why is this not just a web app?" | "Because the submission is a native Android app in `mobile-app/` with a checked-in `android/` project, native navigation, mobile state, and Solana mobile wallet integration." |
| "Why not Expo Go?" | "Solana Mobile Wallet Adapter requires a native binary, so we use a native dev client and APK build path." |
| "What is the strongest mobile-specific feature?" | "Native Android wallet-ready architecture plus mobile checkout and restart recovery for physical GoldBack purchases." |
| "Is dApp Store publishing done?" | "Not required by the deadline. The app is being prepared so winners can publish after results." |
