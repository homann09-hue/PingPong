# Aurora mobile client

Flutter 3.44.6 client for iOS 13+, Android API 24+, and Web. Game settlement,
wallet grants, progression, social state, and store entitlements remain server
authoritative.

## Local targets

From the repository root:

```sh
./scripts/flutterw analyze
./scripts/flutterw test
./scripts/flutterw build web --release --no-web-resources-cdn
./scripts/flutterw build apk --debug
./scripts/flutterw build ios --simulator --debug --no-codesign
```

Android emulator development resolves the local API at `10.0.2.2:8080`; iOS
Simulator uses `localhost:8080`. Release builds must provide an HTTPS endpoint
with `--dart-define=API_URL=https://api.example.com`.

The client creates or resumes a server-side guest session automatically.
Short-lived access tokens remain memory-only; the installation identifier and
rotating refresh credential use iOS Keychain, Android Keystore-backed encrypted
storage, or secure-context Web storage. Android cloud backup is disabled to
avoid restoring ciphertext without its hardware-bound key. Web releases must
use HTTPS and retain the repository's CSP/XSS protections. See
`docs/work-packages/phase11-client-session.md`.

Native billing uses Flutter's maintained `in_app_purchase` plugin. Product IDs
must exist in App Store Connect and Google Play Console before catalog queries
return localized prices. See `docs/work-packages/phase10-native-store.md`.
