# Testing MWA with Mock Wallet

Use the [Solana Mobile Mock MWA Wallet](https://github.com/solana-mobile/mock-mwa-wallet) to test wallet connect and signing without a real wallet app.

## Setup (one-time)

Mock wallet is cloned at repo root:

```bash
# From repo root (already done)
git clone https://github.com/solana-mobile/mock-mwa-wallet.git
```

Build and install on the emulator:

```bash
# Create local.properties if missing
echo "sdk.dir=$HOME/Library/Android/sdk" > mock-mwa-wallet/local.properties

# Build (fix CRLF on gradlew if needed: sed -i '' 's/\r$//' mock-mwa-wallet/gradlew)
cd mock-mwa-wallet && ./gradlew assembleDebug && cd ..

# Install on connected device/emulator
adb install -r mock-mwa-wallet/app/build/outputs/apk/debug/app-debug.apk
```

## Optional: Use a specific key (e.g. devnet SOL)

In `mock-mwa-wallet/local.properties` add:

```
sdk.dir=/path/to/Android/sdk
privateKey=<BASE58_OR_BASE64_ED25519_PRIVATE_KEY>
```

Rebuild and reinstall. The mock wallet will sign with that key (use only for testing).

## How to test

1. **Start the emulator** and ensure **GoldBack app** and **Mock MWA Wallet** are both installed.
2. **Open Mock MWA Wallet** on the emulator.
3. Tap **"Authenticate"** to enable wallet signing for 15 minutes.
4. **Open the GoldBack app** and trigger the wallet connection flow (e.g. Connect Wallet, Sign in, or any action that calls MWA `authorize`).
5. **Mock MWA Wallet** should appear as a compatible wallet; approve the authorization.
6. After that, transaction and message signing from GoldBack will show the mock wallet’s approval UI.

## Reference

- [Mock MWA Wallet repo](https://github.com/solana-mobile/mock-mwa-wallet)
- [Solana Mobile Wallet Adapter docs](https://docs.solanamobile.com/mobile-wallet-adapter/mobile-apps)
