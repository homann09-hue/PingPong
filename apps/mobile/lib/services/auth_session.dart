import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// Minimal persistence boundary for opaque identity credentials.
abstract interface class SessionStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Deterministic non-persistent adapter used by tests and unsupported targets.
class MemorySessionStorage implements SessionStorage {
  final Map<String, String> _values = {};

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<void> write(String key, String value) async => _values[key] = value;

  @override
  Future<void> delete(String key) async => _values.remove(key);
}

/// Keychain/Keystore/WebCrypto-backed credential storage adapter.
class SecureSessionStorage implements SessionStorage {
  SecureSessionStorage({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock_this_device,
            ),
            aOptions: AndroidOptions(storageNamespace: 'aurora_identity'),
          );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Selects secure persistence only on the three supported client platforms.
SessionStorage createDefaultSessionStorage() {
  if (kIsWeb ||
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.android) {
    return SecureSessionStorage();
  }
  return MemorySessionStorage();
}

/// Returns the identity API's supported platform discriminator.
String currentClientPlatform() => kIsWeb
    ? 'web'
    : defaultTargetPlatform == TargetPlatform.iOS
    ? 'ios'
    : 'android';

/// Owns guest bootstrap, proactive rotation, and memory-only access tokens.
class AuthSessionManager {
  AuthSessionManager({
    required this.baseUrl,
    required this.client,
    required this.storage,
    required this.platform,
    DateTime Function()? now,
    String Function()? installationIdFactory,
  }) : _now = now ?? DateTime.now,
       _installationIdFactory = installationIdFactory ?? _newUuid;

  static const _installationIdKey = 'aurora.identity.installation-id.v1';
  static const _refreshTokenKey = 'aurora.identity.refresh-token.v1';

  final String baseUrl;
  final http.Client client;
  final SessionStorage storage;
  final String platform;
  final DateTime Function() _now;
  final String Function() _installationIdFactory;

  String? _accessToken;
  DateTime? _accessTokenRefreshAt;
  String? _playerId;
  Future<void>? _sessionOperation;

  String? get playerId => _playerId;

  /// Stable app-install identity shared by authentication and push registration.
  Future<String> installationId() async {
    var value = await storage.read(_installationIdKey);
    if (value != null) return value;
    value = _installationIdFactory();
    await storage.write(_installationIdKey, value);
    return value;
  }

  Future<String> accessToken() async {
    if (_hasUsableAccessToken) return _accessToken!;
    await _establishSerialized();
    return _requireAccessToken();
  }

  Future<String> refreshAfterUnauthorized(String rejectedToken) async {
    if (_accessToken != null &&
        _accessToken != rejectedToken &&
        _hasUsableAccessToken) {
      return _accessToken!;
    }
    await _establishSerialized(forceRefresh: true);
    return _requireAccessToken();
  }

  Future<void> logout() async {
    final active = _sessionOperation;
    if (active != null) await active;
    final refreshToken = await storage.read(_refreshTokenKey);
    try {
      if (refreshToken != null) {
        await client.post(
          Uri.parse('$baseUrl/v1/auth/logout'),
          headers: const {'content-type': 'application/json'},
          body: jsonEncode({'refreshToken': refreshToken}),
        );
      }
    } finally {
      await storage.delete(_refreshTokenKey);
      _clearMemorySession();
    }
  }

  /// Exchanges a Supabase-verified Apple, Google, or email session for Aurora credentials.
  Future<void> signInWithProvider({
    required String provider,
    required String providerAccessToken,
  }) async {
    if (!const {'apple', 'google', 'email'}.contains(provider) ||
        providerAccessToken.length < 32) {
      throw ArgumentError('Ungültige Provider-Anmeldung');
    }
    final currentAccessToken = await accessToken();
    final response = await client.post(
      Uri.parse('$baseUrl/v1/auth/provider'),
      headers: {
        'authorization': 'Bearer $currentAccessToken',
        'content-type': 'application/json',
      },
      body: jsonEncode({
        'provider': provider,
        'providerAccessToken': providerAccessToken,
        'installationId': await installationId(),
        'platform': platform,
      }),
    );
    if (response.statusCode != 201) {
      throw StateError(
        'Anmeldung konnte nicht verknüpft werden (${response.statusCode})',
      );
    }
    await _acceptTokens(response);
  }

  /// Revokes every active device session and clears credentials on this device.
  Future<void> logoutAll() async {
    final token = await accessToken();
    try {
      final response = await client.post(
        Uri.parse('$baseUrl/v1/auth/logout-all'),
        headers: {'authorization': 'Bearer $token'},
      );
      if (response.statusCode != 200) {
        throw StateError(
          'Sitzungen konnten nicht beendet werden (${response.statusCode})',
        );
      }
    } finally {
      await storage.delete(_refreshTokenKey);
      _clearMemorySession();
    }
  }

  bool get _hasUsableAccessToken {
    final refreshAt = _accessTokenRefreshAt;
    return _accessToken != null &&
        refreshAt != null &&
        _now().isBefore(refreshAt);
  }

  Future<void> _establishSerialized({bool forceRefresh = false}) async {
    final active = _sessionOperation;
    if (active != null) {
      await active;
      return;
    }
    if (!forceRefresh && _hasUsableAccessToken) return;
    final operation = _establish();
    _sessionOperation = operation;
    try {
      await operation;
    } finally {
      if (identical(_sessionOperation, operation)) _sessionOperation = null;
    }
  }

  Future<void> _establish() async {
    final refreshToken = await storage.read(_refreshTokenKey);
    if (refreshToken != null) {
      final refreshed = await client.post(
        Uri.parse('$baseUrl/v1/auth/refresh'),
        headers: const {'content-type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      );
      if (refreshed.statusCode == 200) {
        await _acceptTokens(refreshed);
        return;
      }
      if (refreshed.statusCode != 400 && refreshed.statusCode != 401) {
        throw StateError(
          'Session konnte nicht erneuert werden (${refreshed.statusCode})',
        );
      }
      await storage.delete(_refreshTokenKey);
      _clearMemorySession();
    }
    await _createGuestSession();
  }

  Future<void> _createGuestSession() async {
    final installationId = await this.installationId();
    final response = await client.post(
      Uri.parse('$baseUrl/v1/auth/guest'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode({
        'installationId': installationId,
        'platform': platform,
      }),
    );
    if (response.statusCode != 201) {
      throw StateError(
        'Gast-Sitzung konnte nicht erstellt werden (${response.statusCode})',
      );
    }
    await _acceptTokens(response);
  }

  Future<void> _acceptTokens(http.Response response) async {
    final Object? decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      throw StateError('Identity-Antwort ist ungültig');
    }
    if (decoded is! Map<String, dynamic> ||
        decoded['tokenType'] != 'Bearer' ||
        decoded['accessToken'] is! String ||
        decoded['refreshToken'] is! String ||
        decoded['accessTokenExpiresIn'] is! int ||
        decoded['playerId'] is! String) {
      throw StateError('Identity-Antwort ist unvollständig');
    }
    final accessToken = decoded['accessToken'] as String;
    final refreshToken = decoded['refreshToken'] as String;
    final expiresIn = decoded['accessTokenExpiresIn'] as int;
    final playerId = decoded['playerId'] as String;
    if (accessToken.isEmpty ||
        refreshToken.length < 32 ||
        expiresIn <= 0 ||
        playerId.isEmpty) {
      throw StateError('Identity-Antwort enthält ungültige Werte');
    }

    // Persist the rotated opaque token before publishing the access token to
    // callers. Access tokens deliberately remain memory-only.
    await storage.write(_refreshTokenKey, refreshToken);
    _accessToken = accessToken;
    _playerId = playerId;
    final refreshLeadSeconds = min(30, max(0, expiresIn - 1));
    _accessTokenRefreshAt = _now().add(
      Duration(seconds: expiresIn - refreshLeadSeconds),
    );
  }

  String _requireAccessToken() {
    final token = _accessToken;
    if (token == null) throw StateError('Keine aktive Sitzung');
    return token;
  }

  void _clearMemorySession() {
    _accessToken = null;
    _accessTokenRefreshAt = null;
    _playerId = null;
  }

  static String _newUuid() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }
}

/// Adds authorization and performs a single refresh-and-retry after `401`.
class AuthenticatedHttpClient {
  AuthenticatedHttpClient(this.client, this.session);

  final http.Client client;
  final AuthSessionManager session;

  Future<http.Response> get(Uri uri, {Map<String, String>? headers}) =>
      _send('GET', uri, headers: headers);

  Future<http.Response> post(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) => _send('POST', uri, headers: headers, body: body);

  Future<http.Response> put(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) => _send('PUT', uri, headers: headers, body: body);

  Future<http.Response> delete(Uri uri, {Map<String, String>? headers}) =>
      _send('DELETE', uri, headers: headers);

  Future<http.Response> _send(
    String method,
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    final token = await session.accessToken();
    var response = await _sendOnce(method, uri, token, headers, body);
    if (response.statusCode != 401) return response;
    final refreshedToken = await session.refreshAfterUnauthorized(token);
    response = await _sendOnce(method, uri, refreshedToken, headers, body);
    return response;
  }

  Future<http.Response> _sendOnce(
    String method,
    Uri uri,
    String token,
    Map<String, String>? headers,
    Object? body,
  ) {
    final requestHeaders = <String, String>{...?headers};
    requestHeaders['authorization'] = 'Bearer $token';
    return switch (method) {
      'GET' => client.get(uri, headers: requestHeaders),
      'POST' => client.post(uri, headers: requestHeaders, body: body),
      'PUT' => client.put(uri, headers: requestHeaders, body: body),
      'DELETE' => client.delete(uri, headers: requestHeaders),
      _ => throw UnsupportedError('Unsupported HTTP method: $method'),
    };
  }
}
