import 'dart:convert';

import 'package:aurora_mobile/services/auth_session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  const baseUrl = 'https://api.aurora.test';
  const installationId = '00000000-0000-4000-8000-000000000123';

  test(
    'parallel bootstrap creates one guest and keeps access token in memory',
    () async {
      var guestCalls = 0;
      final storage = MemorySessionStorage();
      final client = MockClient((request) async {
        expect(request.url.path, '/v1/auth/guest');
        guestCalls++;
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body, {'installationId': installationId, 'platform': 'ios'});
        return _tokens(201, access: 'access-1', refresh: _token('r'));
      });
      final session = AuthSessionManager(
        baseUrl: baseUrl,
        client: client,
        storage: storage,
        platform: 'ios',
        installationIdFactory: () => installationId,
      );

      final tokens = await Future.wait(
        List.generate(10, (_) => session.accessToken()),
      );

      expect(tokens, everyElement('access-1'));
      expect(guestCalls, 1);
      expect(
        await storage.read('aurora.identity.installation-id.v1'),
        installationId,
      );
      expect(
        await storage.read('aurora.identity.refresh-token.v1'),
        _token('r'),
      );
    },
  );

  test(
    'installation identity is stable before authentication bootstrap',
    () async {
      final storage = MemorySessionStorage();
      final session = AuthSessionManager(
        baseUrl: baseUrl,
        client: MockClient((_) async => http.Response('', 500)),
        storage: storage,
        platform: 'android',
        installationIdFactory: () => installationId,
      );

      expect(await session.installationId(), installationId);
      expect(await session.installationId(), installationId);
    },
  );

  test(
    'authenticated DELETE refreshes once and preserves its method',
    () async {
      final storage = MemorySessionStorage();
      var deleteCalls = 0;
      final client = MockClient((request) async {
        if (request.url.path == '/v1/auth/guest') {
          return _tokens(201, access: 'old', refresh: _token('o'));
        }
        if (request.url.path == '/v1/auth/refresh') {
          return _tokens(200, access: 'new', refresh: _token('n'));
        }
        expect(request.method, 'DELETE');
        deleteCalls++;
        return http.Response('', deleteCalls == 1 ? 401 : 204);
      });
      final session = AuthSessionManager(
        baseUrl: baseUrl,
        client: client,
        storage: storage,
        platform: 'android',
        installationIdFactory: () => installationId,
      );

      final response = await AuthenticatedHttpClient(client, session).delete(
        Uri.parse('$baseUrl/v1/messaging/installations/$installationId'),
      );

      expect(response.statusCode, 204);
      expect(deleteCalls, 2);
    },
  );

  test('stored refresh token rotates without creating another guest', () async {
    final storage = MemorySessionStorage();
    await storage.write('aurora.identity.refresh-token.v1', _token('a'));
    var guestCalls = 0;
    final client = MockClient((request) async {
      if (request.url.path == '/v1/auth/guest') guestCalls++;
      expect(request.url.path, '/v1/auth/refresh');
      expect(jsonDecode(request.body), {'refreshToken': _token('a')});
      return _tokens(200, access: 'access-2', refresh: _token('b'));
    });
    final session = AuthSessionManager(
      baseUrl: baseUrl,
      client: client,
      storage: storage,
      platform: 'android',
    );

    expect(await session.accessToken(), 'access-2');
    expect(guestCalls, 0);
    expect(await storage.read('aurora.identity.refresh-token.v1'), _token('b'));
  });

  test('access token refreshes proactively before server expiry', () async {
    final storage = MemorySessionStorage();
    var now = DateTime.utc(2026, 7, 15, 12);
    var refreshCalls = 0;
    final client = MockClient((request) async {
      if (request.url.path == '/v1/auth/guest') {
        return _tokens(201, access: 'access-old', refresh: _token('o'));
      }
      refreshCalls++;
      return _tokens(200, access: 'access-new', refresh: _token('n'));
    });
    final session = AuthSessionManager(
      baseUrl: baseUrl,
      client: client,
      storage: storage,
      platform: 'ios',
      now: () => now,
      installationIdFactory: () => installationId,
    );

    expect(await session.accessToken(), 'access-old');
    now = now.add(const Duration(minutes: 14, seconds: 31));
    expect(await session.accessToken(), 'access-new');
    expect(refreshCalls, 1);
  });

  test(
    'invalid refresh returns to stable installation guest identity',
    () async {
      final storage = MemorySessionStorage();
      await storage.write('aurora.identity.refresh-token.v1', _token('x'));
      await storage.write('aurora.identity.installation-id.v1', installationId);
      final paths = <String>[];
      final client = MockClient((request) async {
        paths.add(request.url.path);
        if (request.url.path == '/v1/auth/refresh') {
          return http.Response('{"code":"INVALID_REFRESH_TOKEN"}', 401);
        }
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['installationId'], installationId);
        return _tokens(201, access: 'replacement', refresh: _token('y'));
      });
      final session = AuthSessionManager(
        baseUrl: baseUrl,
        client: client,
        storage: storage,
        platform: 'web',
      );

      expect(await session.accessToken(), 'replacement');
      expect(paths, ['/v1/auth/refresh', '/v1/auth/guest']);
    },
  );

  test(
    'transient refresh failure never creates a replacement account',
    () async {
      final storage = MemorySessionStorage();
      await storage.write('aurora.identity.refresh-token.v1', _token('z'));
      var guestCalls = 0;
      final client = MockClient((request) async {
        if (request.url.path == '/v1/auth/guest') guestCalls++;
        return http.Response('{"code":"UNAVAILABLE"}', 503);
      });
      final session = AuthSessionManager(
        baseUrl: baseUrl,
        client: client,
        storage: storage,
        platform: 'ios',
      );

      await expectLater(session.accessToken(), throwsStateError);
      expect(guestCalls, 0);
      expect(
        await storage.read('aurora.identity.refresh-token.v1'),
        _token('z'),
      );
    },
  );

  test(
    'authenticated client refreshes once and retries rejected request',
    () async {
      final storage = MemorySessionStorage();
      var protectedCalls = 0;
      var refreshCalls = 0;
      final client = MockClient((request) async {
        switch (request.url.path) {
          case '/v1/auth/guest':
            return _tokens(201, access: 'access-old', refresh: _token('o'));
          case '/v1/auth/refresh':
            refreshCalls++;
            return _tokens(200, access: 'access-new', refresh: _token('n'));
          case '/v1/profile':
            protectedCalls++;
            final authorization = request.headers['authorization'];
            if (authorization == 'Bearer access-old') {
              return http.Response('{"code":"UNAUTHORIZED"}', 401);
            }
            expect(authorization, 'Bearer access-new');
            return http.Response('{"ok":true}', 200);
          default:
            return http.Response('not found', 404);
        }
      });
      final session = AuthSessionManager(
        baseUrl: baseUrl,
        client: client,
        storage: storage,
        platform: 'ios',
        installationIdFactory: () => installationId,
      );
      final authenticated = AuthenticatedHttpClient(client, session);

      final responses = await Future.wait([
        authenticated.get(Uri.parse('$baseUrl/v1/profile')),
        authenticated.get(Uri.parse('$baseUrl/v1/profile')),
      ]);

      expect(
        responses.map((response) => response.statusCode),
        everyElement(200),
      );
      expect(protectedCalls, 4);
      expect(refreshCalls, 1);
    },
  );

  test('logout revokes and deletes the local refresh credential', () async {
    final storage = MemorySessionStorage();
    await storage.write('aurora.identity.refresh-token.v1', _token('q'));
    final client = MockClient((request) async {
      expect(request.url.path, '/v1/auth/logout');
      expect(jsonDecode(request.body), {'refreshToken': _token('q')});
      return http.Response('', 204);
    });
    final session = AuthSessionManager(
      baseUrl: baseUrl,
      client: client,
      storage: storage,
      platform: 'android',
    );

    await session.logout();

    expect(await storage.read('aurora.identity.refresh-token.v1'), isNull);
  });
}

http.Response _tokens(
  int status, {
  required String access,
  required String refresh,
  int expiresIn = 900,
}) => http.Response(
  jsonEncode({
    'tokenType': 'Bearer',
    'accessToken': access,
    'accessTokenExpiresIn': expiresIn,
    'refreshToken': refresh,
    'refreshTokenExpiresAt': '2030-01-01T00:00:00.000Z',
    'playerId': '00000000-0000-4000-8000-000000000999',
  }),
  status,
  headers: const {'content-type': 'application/json'},
);

String _token(String value) => value * 43;
