import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'push_messaging_contracts.dart';

PushProviderClient createPushProviderClient() => FirebasePushProviderClient();

class FirebasePushProviderClient implements PushProviderClient {
  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  @override
  Stream<String> get tokenRefreshes => _messaging.onTokenRefresh;

  @override
  Future<void> initialize(PushFirebaseConfiguration configuration) async {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: configuration.apiKey,
          appId: configuration.appId,
          messagingSenderId: configuration.messagingSenderId,
          projectId: configuration.projectId,
          authDomain: _nonEmpty(configuration.authDomain),
          storageBucket: _nonEmpty(configuration.storageBucket),
        ),
      );
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    }
  }

  @override
  Future<bool> isSupported() => _messaging.isSupported();

  @override
  Future<PushPermissionStatus> permissionStatus() async => _mapStatus(
    (await _messaging.getNotificationSettings()).authorizationStatus,
  );

  @override
  Future<PushPermissionStatus> requestPermission() async => _mapStatus(
    (await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    )).authorizationStatus,
  );

  @override
  Future<String?> apnsToken() => _messaging.getAPNSToken();

  @override
  Future<String?> token({String? vapidKey, String? serviceWorkerScriptPath}) =>
      _messaging.getToken(
        vapidKey: vapidKey,
        serviceWorkerScriptPath: serviceWorkerScriptPath,
      );

  @override
  Future<void> deleteToken() => _messaging.deleteToken();

  static String? _nonEmpty(String? value) =>
      value == null || value.isEmpty ? null : value;

  static PushPermissionStatus _mapStatus(AuthorizationStatus status) =>
      switch (status) {
        AuthorizationStatus.authorized => PushPermissionStatus.authorized,
        AuthorizationStatus.provisional => PushPermissionStatus.provisional,
        AuthorizationStatus.denied => PushPermissionStatus.denied,
        AuthorizationStatus.notDetermined => PushPermissionStatus.notDetermined,
      };
}
