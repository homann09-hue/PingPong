import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Public Supabase Auth configuration supplied at build time.
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabasePublishableKey = String.fromEnvironment(
  'SUPABASE_PUBLISHABLE_KEY',
);

Future<void> initializeExternalAccountAuth() async {
  if (supabaseUrl.isEmpty || supabasePublishableKey.isEmpty) return;
  await Supabase.initialize(url: supabaseUrl, anonKey: supabasePublishableKey);
}

/// Obtains provider proof only; Aurora remains the account/session authority.
class ExternalAccountAuth {
  bool get available =>
      supabaseUrl.isNotEmpty && supabasePublishableKey.isNotEmpty;
  GoTrueClient get _auth => Supabase.instance.client.auth;
  Stream<AuthState> get changes => _auth.onAuthStateChange;
  Session? get currentSession => available ? _auth.currentSession : null;

  Future<void> startOAuth(String provider) async {
    if (!available) throw StateError('Supabase Auth ist nicht konfiguriert');
    final oauthProvider = switch (provider) {
      'apple' => OAuthProvider.apple,
      'google' => OAuthProvider.google,
      _ => throw ArgumentError.value(provider, 'provider'),
    };
    await _auth.signInWithOAuth(
      oauthProvider,
      redirectTo: kIsWeb
          ? '${Uri.base.origin}/'
          : 'com.aurora.socialcasino://login-callback',
    );
  }

  Future<Session?> signInWithEmail(String email, String password) async =>
      (await _auth.signInWithPassword(
        email: email,
        password: password,
      )).session;

  Future<Session?> createEmailAccount(String email, String password) async =>
      (await _auth.signUp(
        email: email,
        password: password,
        emailRedirectTo: kIsWeb
            ? '${Uri.base.origin}/'
            : 'com.aurora.socialcasino://login-callback',
      )).session;

  Future<void> resetPassword(String email) => _auth.resetPasswordForEmail(
    email,
    redirectTo: kIsWeb
        ? '${Uri.base.origin}/'
        : 'com.aurora.socialcasino://login-callback',
  );

  Future<void> updatePassword(String password) =>
      _auth.updateUser(UserAttributes(password: password));
  Future<void> signOut() => available ? _auth.signOut() : Future.value();
}
