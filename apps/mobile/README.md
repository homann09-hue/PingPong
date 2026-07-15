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

Native billing uses Flutter's maintained `in_app_purchase` plugin. Product IDs
must exist in App Store Connect and Google Play Console before catalog queries
return localized prices. See `docs/work-packages/phase10-native-store.md`.
