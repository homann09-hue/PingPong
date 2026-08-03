import 'package:aurora_mobile/services/casino_api.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('resolveCasinoApiBase', () {
    test('uses HTTPS configuration without a trailing slash', () {
      expect(
        resolveCasinoApiBase(
          configuredBase: 'https://api.example.test/',
          isWeb: false,
          platform: TargetPlatform.iOS,
          isDebug: false,
          webOrigin: 'https://casino.example.test',
        ),
        'https://api.example.test',
      );
    });

    test('requires an explicit endpoint for native release builds', () {
      expect(
        () => resolveCasinoApiBase(
          configuredBase: '',
          isWeb: false,
          platform: TargetPlatform.iOS,
          isDebug: false,
          webOrigin: 'https://casino.example.test',
        ),
        throwsStateError,
      );
    });

    test('rejects cleartext endpoints in release builds', () {
      expect(
        () => resolveCasinoApiBase(
          configuredBase: 'http://api.example.test',
          isWeb: false,
          platform: TargetPlatform.android,
          isDebug: false,
          webOrigin: 'https://casino.example.test',
        ),
        throwsStateError,
      );
    });

    test('keeps emulator defaults limited to debug builds', () {
      expect(
        resolveCasinoApiBase(
          configuredBase: '',
          isWeb: false,
          platform: TargetPlatform.android,
          isDebug: true,
          webOrigin: 'http://localhost:8080',
        ),
        'http://10.0.2.2:8080',
      );
    });

    test('uses the current origin for web deployments', () {
      expect(
        resolveCasinoApiBase(
          configuredBase: '',
          isWeb: true,
          platform: TargetPlatform.linux,
          isDebug: false,
          webOrigin: 'https://casino.example.test',
        ),
        'https://casino.example.test',
      );
    });
  });
}
