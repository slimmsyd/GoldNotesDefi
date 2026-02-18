# GoldBack Mobile App (Expo + Native Wallet Adapter)

## Environment Profiles
Use one of these templates:
1. `.env.development.example`
2. `.env.staging.example`
3. `.env.production.example`

For local emulator development:
1. `cp .env.development.example .env`
2. keep `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000` if backend runs on host machine.

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

## Security Notes
1. Backend production baseline must set `MOBILE_AUTH_ALLOW_DEV_SIGNER=false`.
2. Wallet signature auth (`solana_ed25519`) is primary for production.
