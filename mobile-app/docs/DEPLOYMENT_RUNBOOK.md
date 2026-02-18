# Mobile Deployment Runbook (Android, Solana MWA)

## 1) Toolchain Gate
1. Java 17+
2. Android SDK + platform tools
3. Emulator/device available via `adb devices`

## 2) Native Runtime Gate
1. `npm run android:dev-client`
2. `npm run start:dev-client`
3. Verify no `SolanaMobileWalletAdapter could not be found` runtime error.

## 3) Backend Connectivity Gate
1. Set `EXPO_PUBLIC_API_BASE_URL` to reachable host for target environment.
2. Validate:
   - `/api/auth/challenge`
   - `/api/auth/verify`
   - `/api/checkout/direct/create`
   - `/api/checkout/direct/confirm`

## 4) Production Auth Gate
In backend environment:
1. `MOBILE_AUTH_ALLOW_DEV_SIGNER=false`
2. `MOBILE_AUTH_JWT_SECRET` set
3. `MOBILE_AUTH_TOKEN_TTL_SECONDS` set

## 5) Android Signing Gate
Configure release keystore credentials:
1. `android/keystore.properties` from template, OR
2. `GOLDBACK_UPLOAD_*` env vars

Local signed release check:
1. `npm run android:release:local`

## 6) EAS Artifact Gate
1. `npm run eas:build:preview`
2. `npm run eas:build:prod`
3. Store resulting APK metadata and checksums.

## 7) Functional Smoke Gate
1. Wallet connect
2. Wallet-signed auth (`solana_ed25519`)
3. Protected APIs return 200 with bearer token
4. SOL direct checkout create -> sign/send -> confirm
5. Pending checkout recovery finalizes exactly once after restart

## 8) Distribution Gate (Solana dApp Store)
1. Prepare app metadata/screenshots.
2. Build release APK.
3. Submit via dApp Store publisher workflow.
