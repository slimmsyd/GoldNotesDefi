# GoldBack Mobile App (Expo + Native Wallet Adapter)

## Hackathon Submission Path
This app is the Android submission target for the hackathon.

Submission defaults:
1. Build from `mobile-app/`, not the web app.
2. Use the `preview` EAS profile as the primary submission APK.
3. Use a public backend target, not the local emulator host mapping.
4. Treat dApp Store publishing as post-submission follow-up.

Why this counts as significant mobile-specific development:
1. Native Expo/React Native Android app with a checked-in `android/` project.
2. Solana Mobile Wallet Adapter dependencies and Expo dev client workflow.
3. Mobile-specific navigation, wallet UI, persistence, and restart recovery.
4. Native mobile checkout flow for physical GoldBack purchases.

## Environment Profiles
Use one of these templates:
1. `.env.development.example`
2. `.env.staging.example`
3. `.env.production.example`

For local emulator development:
1. `cp .env.development.example .env`
2. keep `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000` if backend runs on host machine.

For submission builds:
1. Do not use the `development` profile.
2. Use `preview` so the APK points to a reviewer-reachable backend.
3. Verify the target API URL before recording the demo or shipping the APK.

## Native Dev Client Run (required for Solana MWA)
1. `npm install`
2. `npm run android:dev-client`
3. `npm run start:dev-client`

Do not use Expo Go for wallet flows. MWA requires a native binary.

## Android Release Signing
Configure one of:
1. `android/keystore.properties` (copy from `android/keystore.properties.example`)
2. Environment variables:
   - `GOLDBACK_UPLOAD_STORE_FILE`
   - `GOLDBACK_UPLOAD_STORE_PASSWORD`
   - `GOLDBACK_UPLOAD_KEY_ALIAS`
   - `GOLDBACK_UPLOAD_KEY_PASSWORD`

Local release build (fails if signing is missing):
1. `npm run android:release:local`

## EAS Build Profiles
Configured in `eas.json`:
1. `development` (internal dev client apk)
2. `preview` (internal apk)
3. `production` (store apk)

Commands:
1. `npm run eas:build:dev`
2. `npm run eas:build:preview`
3. `npm run eas:build:prod`

These scripts use `npx eas-cli`, so a global `eas` install is not required.

Recommended submission artifact:
1. `npm run eas:build:preview`
2. Archive the resulting APK filename, commit hash, backend URL, and checksum.

Local release builds:
1. Require Java 17+ and release signing configuration.
2. Are a secondary validation path if EAS preview succeeds first.

## Security Notes
1. Backend production baseline must set `MOBILE_AUTH_ALLOW_DEV_SIGNER=false`.
2. Wallet signature auth (`solana_ed25519`) is primary for production.
