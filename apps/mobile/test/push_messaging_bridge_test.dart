import 'dart:async';

import 'package:aurora_mobile/services/push_messaging_bridge.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const configured = PushFirebaseConfiguration(
    apiKey: 'public-api-key',
    appId: '1:123:web:abc',
    messagingSenderId: '123',
    projectId: 'aurora-test',
    authDomain: 'aurora-test.firebaseapp.com',
    webVapidKey: 'public-vapid-key',
  );

  test('unconfigured bridge never initializes or fabricates a token', () async {
    final provider = FakePushProvider();
    final bridge = PushMessagingBridge(
      provider: provider,
      configuration: const PushFirebaseConfiguration(
        apiKey: '',
        appId: '',
        messagingSenderId: '',
        projectId: '',
      ),
    );

    await bridge.initialize();

    expect(bridge.available, isFalse);
    expect(await bridge.token(), isNull);
    expect(provider.initializeCalls, 0);
    expect(provider.tokenCalls, 0);
  });

  test('web token uses VAPID key and configured background worker', () async {
    final provider = FakePushProvider(tokenValue: 'web-token');
    final bridge = PushMessagingBridge(
      provider: provider,
      configuration: configured,
      isWeb: true,
      platform: TargetPlatform.android,
    );

    await bridge.initialize();
    final token = await bridge.token();

    expect(token, 'web-token');
    expect(provider.lastVapidKey, 'public-vapid-key');
    final worker = Uri.parse(provider.lastServiceWorkerScriptPath!);
    expect(worker.path, '/firebase-messaging-sw.js');
    expect(worker.queryParameters['projectId'], 'aurora-test');
    expect(worker.queryParameters['apiKey'], 'public-api-key');
  });

  test('iOS waits for APNs before requesting an FCM token', () async {
    final provider = FakePushProvider(tokenValue: 'fcm-token');
    final bridge = PushMessagingBridge(
      provider: provider,
      configuration: configured,
      isWeb: false,
      platform: TargetPlatform.iOS,
    );
    await bridge.initialize();

    expect(await bridge.token(), isNull);
    expect(provider.tokenCalls, 0);

    provider.apnsTokenValue = 'apns-token';
    expect(await bridge.token(), 'fcm-token');
    expect(provider.tokenCalls, 1);
  });

  test(
    'permission, rotation and deletion stay provider authoritative',
    () async {
      final provider = FakePushProvider(
        permission: PushPermissionStatus.notDetermined,
      );
      final bridge = PushMessagingBridge(
        provider: provider,
        configuration: configured,
        isWeb: false,
        platform: TargetPlatform.android,
      );
      await bridge.initialize();

      expect(
        await bridge.permissionStatus(),
        PushPermissionStatus.notDetermined,
      );
      provider.permission = PushPermissionStatus.authorized;
      expect(await bridge.requestPermission(), PushPermissionStatus.authorized);

      final rotations = <String>[];
      final subscription = bridge.tokenRefreshes.listen(rotations.add);
      provider.tokenController.add('rotated-token');
      await Future<void>.delayed(Duration.zero);
      expect(rotations, ['rotated-token']);

      await bridge.deleteToken();
      expect(provider.deleteCalls, 1);
      await subscription.cancel();
      await provider.dispose();
    },
  );
}

class FakePushProvider implements PushProviderClient {
  FakePushProvider({
    this.tokenValue,
    this.permission = PushPermissionStatus.authorized,
  });

  final StreamController<String> tokenController =
      StreamController<String>.broadcast();
  final String? tokenValue;
  PushPermissionStatus permission;
  String? apnsTokenValue;
  int initializeCalls = 0;
  int tokenCalls = 0;
  int deleteCalls = 0;
  String? lastVapidKey;
  String? lastServiceWorkerScriptPath;

  @override
  Stream<String> get tokenRefreshes => tokenController.stream;

  @override
  Future<void> initialize(PushFirebaseConfiguration configuration) async {
    initializeCalls++;
  }

  @override
  Future<bool> isSupported() async => true;

  @override
  Future<PushPermissionStatus> permissionStatus() async => permission;

  @override
  Future<PushPermissionStatus> requestPermission() async => permission;

  @override
  Future<String?> apnsToken() async => apnsTokenValue;

  @override
  Future<String?> token({
    String? vapidKey,
    String? serviceWorkerScriptPath,
  }) async {
    tokenCalls++;
    lastVapidKey = vapidKey;
    lastServiceWorkerScriptPath = serviceWorkerScriptPath;
    return tokenValue;
  }

  @override
  Future<void> deleteToken() async {
    deleteCalls++;
  }

  Future<void> dispose() => tokenController.close();
}
