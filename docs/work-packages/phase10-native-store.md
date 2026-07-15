# Phase 10 — Native StoreKit and Google Play Billing

## Supported toolchain

- Flutter `3.44.6` / Dart `3.12.2`
- `in_app_purchase 3.3.0` maintained by flutter.dev
- iOS 13 or newer, bundle ID `com.aurora.socialcasino`
- Android API 24 or newer, application ID `com.aurora.socialcasino`

CI pins Flutter and compiles Web, Android debug APK, and an unsigned iOS
Simulator app. Production Android signing deliberately has no debug-key
fallback; release signing is supplied by the protected delivery environment.

## Purchase lifecycle

1. Subscribe to the platform purchase stream before catalog loading.
2. Query only product IDs returned by the authoritative API and render only the
   provider's localized price string.
3. Attach the opaque Aurora player UUID as the platform account identifier.
4. Keep pending purchases pending. Never grant virtual value locally.
5. Send PURCHASED/restored proof to the Aurora API.
6. After the idempotent wallet grant succeeds, complete the provider purchase.
7. If the process stops between steps 5 and 6, provider redelivery replays the
   same transaction without duplicating the grant, then retries completion.

`starter-vault` is configured as a non-consumable so the provider prevents a
second charge and can restore the original transaction. Repeatable packages are
consumables with automatic consumption disabled until server delivery succeeds.

## Store setup gate

Create every version-controlled product ID from `store-products.ts` in both
store consoles with matching product type. Localized title, description, price,
tax category, territories, agreements, banking, and sandbox/license testers are
external release configuration and must be completed before device QA.

On macOS select a full Xcode installation, not Command Line Tools:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -runFirstLaunch
```

Android builds require `ANDROID_HOME` pointing to an installed Android SDK.
Release builds provide the production HTTPS `API_URL`; cleartext networking is
enabled only in the generated Android debug manifest for emulator development.
