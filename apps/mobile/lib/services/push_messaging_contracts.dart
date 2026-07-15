/// Operating-system notification authorization visible to application code.
enum PushPermissionStatus { authorized, provisional, denied, notDetermined }

/// Public Firebase client settings supplied with `--dart-define`.
class PushFirebaseConfiguration {
  const PushFirebaseConfiguration({
    required this.apiKey,
    required this.appId,
    required this.messagingSenderId,
    required this.projectId,
    this.authDomain,
    this.storageBucket,
    this.webVapidKey,
  });

  factory PushFirebaseConfiguration.fromEnvironment() =>
      const PushFirebaseConfiguration(
        apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
        appId: String.fromEnvironment('FIREBASE_APP_ID'),
        messagingSenderId: String.fromEnvironment(
          'FIREBASE_MESSAGING_SENDER_ID',
        ),
        projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
        authDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
        storageBucket: String.fromEnvironment('FIREBASE_STORAGE_BUCKET'),
        webVapidKey: String.fromEnvironment('FIREBASE_WEB_VAPID_KEY'),
      );

  final String apiKey;
  final String appId;
  final String messagingSenderId;
  final String projectId;
  final String? authDomain;
  final String? storageBucket;
  final String? webVapidKey;

  bool get isConfigured =>
      apiKey.isNotEmpty &&
      appId.isNotEmpty &&
      messagingSenderId.isNotEmpty &&
      projectId.isNotEmpty;

  String? get serviceWorkerScriptPath {
    if (!isConfigured) return null;
    final query = <String, String>{
      'apiKey': apiKey,
      'appId': appId,
      'messagingSenderId': messagingSenderId,
      'projectId': projectId,
    };
    final normalizedAuthDomain = _nonEmpty(authDomain);
    final normalizedStorageBucket = _nonEmpty(storageBucket);
    if (normalizedAuthDomain != null) {
      query['authDomain'] = normalizedAuthDomain;
    }
    if (normalizedStorageBucket != null) {
      query['storageBucket'] = normalizedStorageBucket;
    }
    return Uri(
      path: '/firebase-messaging-sw.js',
      queryParameters: query,
    ).toString();
  }

  static String? _nonEmpty(String? value) =>
      value == null || value.isEmpty ? null : value;
}

/// Narrow provider boundary that keeps token lifecycle logic unit-testable.
abstract interface class PushProviderClient {
  Stream<String> get tokenRefreshes;
  Future<void> initialize(PushFirebaseConfiguration configuration);
  Future<bool> isSupported();
  Future<PushPermissionStatus> permissionStatus();
  Future<PushPermissionStatus> requestPermission();
  Future<String?> apnsToken();
  Future<String?> token({String? vapidKey, String? serviceWorkerScriptPath});
  Future<void> deleteToken();
}
