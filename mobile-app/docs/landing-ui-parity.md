# Landing UI Parity (Web -> Mobile, Android-Safe Apple Style)

## Goal
- Deliver a premium first impression on mobile by upgrading `Splash` and the top of `Shop`, while preserving existing commerce and wallet behavior.

## Source References
- Web visual direction:
  - `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/components/hero.tsx`
  - `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/my-app/src/components/shop-gold-backs-content.tsx`
- Mobile implementation targets:
  - `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/mobile-app/src/screens/splash/SplashScreen.tsx`
  - `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/mobile-app/src/screens/shop/ShopScreen.tsx`
  - `/Users/sydneysanders/Desktop/Code_Projects/GoldBackProject/mobile-app/src/navigation/index.tsx`

## Web-to-Mobile Mapping
- Web hero headline/subheadline -> mobile splash title/subtitle and shop hero copy.
- Web premium surface and spacing rhythm -> mobile tokenized card surfaces and consistent paddings/radii.
- Web commerce cue ("collection" + rate) -> mobile shop hero with `goldbackRate` and `rateUpdatedAt`.
- Web wallet visibility -> mobile top-right wallet action on Shop/Checkout.

## Android-Safe Apple Style Decisions
- Use native stack with iOS large-title options enabled conditionally on iOS only.
- Keep Android with polished opaque headers and compact wallet action button.
- Use React Native `Animated` for motion polish (fade/translate/scale), avoiding new heavy native dependencies.
- Use shared token system in `src/theme/tokens.ts` to keep visual consistency and simplify future platform variants.

## Data and Visual Reliability
- Mobile catalog continues to use backend facade (`/api/shop/catalog`).
- Product visuals use normalized `imageUrl` and fallback placeholder when missing/invalid.
- No direct Supabase SDK integration in mobile for this phase.

## Deferred (Out of Scope This Pass)
- Zeego context menus.
- `@gorhom/bottom-sheet` migration.
- Segmented control package integration.
- Haptics package integration (can be added in a low-risk follow-up pass).
