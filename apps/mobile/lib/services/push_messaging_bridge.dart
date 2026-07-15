import 'package:flutter/foundation.dart';

import 'push_messaging_contracts.dart';
import 'push_messaging_provider.dart';

export 'push_messaging_contracts.dart';

/// FCM token lifecycle shared by Android, iOS/APNs and Web Push.
class PushMessagingBridge {
  PushMessagingBridge({
    PushProviderClient? provider,
    PushFirebaseConfiguration? configuration,
    bool? isWeb,
    TargetPlatform? platform,
  }) : _provider = provider ?? createPushProviderClient(),
       _configuration =
           configuration ?? PushFirebaseConfiguration.fromEnvironment(),
       _isWeb = isWeb ?? kIsWeb,
       _platform = platform ?? defaultTargetPlatform;

  final PushProviderClient _provider;
  final PushFirebaseConfiguration _configuration;
  final bool _isWeb;
  final TargetPlatform _platform;
  bool _available = false;
  bool _initialized = false;

  bool get available => _available;
  String get provider => 'fcm';
  Stream<String> get tokenRefreshes =>
      _available ? _provider.tokenRefreshes : const Stream.empty();

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    if (!_configuration.isConfigured ||
        (_isWeb && (_configuration.webVapidKey?.isEmpty ?? true))) {
      return;
    }
    try {
      await _provider.initialize(_configuration);
      _available = await _provider.isSupported();
    } on Object {
      // Provider initialization is an external boundary. The client remains
      // usable without push and never substitutes a fabricated token.
      _available = false;
      _initialized = false;
    }
  }

  Future<PushPermissionStatus> permissionStatus() async {
    if (!_available) return PushPermissionStatus.denied;
    return _provider.permissionStatus();
  }

  Future<PushPermissionStatus> requestPermission() async {
    if (!_available) return PushPermissionStatus.denied;
    return _provider.requestPermission();
  }

  Future<String?> token() async {
    if (!_available) return null;
    if (!_isWeb && _platform == TargetPlatform.iOS) {
      final apnsToken = await _provider.apnsToken();
      if (apnsToken == null || apnsToken.isEmpty) return null;
    }
    return _provider.token(
      vapidKey: _isWeb ? _configuration.webVapidKey : null,
      serviceWorkerScriptPath: _isWeb
          ? _configuration.serviceWorkerScriptPath
          : null,
    );
  }

  Future<void> deleteToken() async {
    if (_available) await _provider.deleteToken();
  }
}
