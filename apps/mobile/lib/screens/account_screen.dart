import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/casino_api.dart';
import '../services/external_account_auth.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final api = CasinoApi();
  final external = ExternalAccountAuth();
  final email = TextEditingController();
  final password = TextEditingController();
  StreamSubscription<AuthState>? authChanges;
  Map<String, dynamic>? account, save;
  List<Map<String, dynamic>> sessions = const [];
  bool busy = false;
  String? message;

  @override
  void initState() {
    super.initState();
    if (external.available) {
      authChanges = external.changes.listen((state) {
        if (state.event == AuthChangeEvent.signedIn && state.session != null)
          unawaited(_acceptExternal(state.session!));
      });
    }
    unawaited(_load());
  }

  @override
  void dispose() {
    authChanges?.cancel();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final values = await Future.wait([
        api.accountStatus(),
        api.accountSessions(),
        api.cloudSave(),
      ]);
      if (mounted)
        setState(() {
          account = values[0] as Map<String, dynamic>;
          sessions = values[1] as List<Map<String, dynamic>>;
          save = values[2] as Map<String, dynamic>;
        });
    } on StateError catch (error) {
      if (mounted) setState(() => message = error.message);
    }
  }

  Future<void> _acceptExternal(Session session) async {
    final provider = session.user.appMetadata['provider'] as String? ?? 'email';
    await _run(() async {
      await api.signInWithProvider(provider, session.accessToken);
      await _load();
    }, 'Konto sicher verknüpft.');
  }

  Future<void> _run(Future<void> Function() operation, String success) async {
    if (busy) return;
    setState(() {
      busy = true;
      message = null;
    });
    try {
      await operation();
      if (mounted) setState(() => message = success);
    } catch (error) {
      if (mounted)
        setState(
          () => message = error.toString().replaceFirst('Bad state: ', ''),
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _emailLogin(bool create) async => _run(() async {
    final session = create
        ? await external.createEmailAccount(email.text.trim(), password.text)
        : await external.signInWithEmail(email.text.trim(), password.text);
    if (session != null)
      await api.signInWithProvider('email', session.accessToken);
    await _load();
  }, create ? 'Bestätigungs-E-Mail gesendet.' : 'Angemeldet.');

  @override
  Widget build(BuildContext context) {
    final providers = ((account?['providers'] as List?) ?? const [])
        .cast<String>();
    return Scaffold(
      appBar: AppBar(title: const Text('KONTO & CLOUD SAVE')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            children: [
              Row(
                children: [
                  Icon(
                    providers.length == 1 && providers.first == 'guest'
                        ? Icons.warning_amber_rounded
                        : Icons.verified_user_rounded,
                    color: providers.length == 1 && providers.first == 'guest'
                        ? Colors.orangeAccent
                        : const Color(0xff72e1c8),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          providers.length == 1 && providers.first == 'guest'
                              ? 'GASTKONTO'
                              : 'CLOUD-GESCHÜTZT',
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        Text(
                          providers.join(' · '),
                          style: const TextStyle(color: Colors.white60),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: busy || !external.available
                          ? null
                          : () => external.startOAuth('apple'),
                      icon: const Icon(Icons.apple),
                      label: Text(
                        providers.contains('apple')
                            ? 'Apple verbunden'
                            : 'Mit Apple',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: busy || !external.available
                          ? null
                          : () => external.startOAuth('google'),
                      icon: const Icon(Icons.g_mobiledata),
                      label: Text(
                        providers.contains('google')
                            ? 'Google verbunden'
                            : 'Mit Google',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'E-Mail'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(labelText: 'Passwort'),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  FilledButton(
                    onPressed: busy || !external.available
                        ? null
                        : () => _emailLogin(false),
                    child: const Text('ANMELDEN'),
                  ),
                  OutlinedButton(
                    onPressed: busy || !external.available
                        ? null
                        : () => _emailLogin(true),
                    child: const Text('KONTO ERSTELLEN'),
                  ),
                  TextButton(
                    onPressed: busy || !external.available
                        ? null
                        : () => _run(
                            () => external.resetPassword(email.text.trim()),
                            'Reset-Link gesendet.',
                          ),
                    child: const Text('PASSWORT VERGESSEN?'),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          _card(
            title: 'CLOUD SAVE',
            children: [
              Text(
                'Version ${save?['version'] ?? 0}',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Text(
                'Coins, Gems und XP sind immer serverautoritativ. Geräteeinstellungen werden konfliktfrei versioniert.',
                style: TextStyle(color: Colors.white60),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: busy || save == null
                    ? null
                    : () => _run(() async {
                        save = await api
                            .updateCloudSave(save!['version'] as int, {
                              ...((save!['data'] as Map?)
                                      ?.cast<String, dynamic>() ??
                                  {}),
                              'lastMobileSyncAt': DateTime.now()
                                  .toUtc()
                                  .toIso8601String(),
                            });
                      }, 'Cloud Save aktualisiert.'),
                icon: const Icon(Icons.cloud_upload_rounded),
                label: const Text('DIESES GERÄT SYNCHRONISIEREN'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _card(
            title: 'AKTIVE SITZUNGEN',
            children: sessions
                .map(
                  (session) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.devices_rounded),
                    title: Text((session['platform'] as String).toUpperCase()),
                    subtitle: Text('Zuletzt ${session['lastUsedAt']}'),
                    trailing: TextButton(
                      onPressed: busy
                          ? null
                          : () => _run(() async {
                              await api.revokeAccountSession(
                                session['id'] as String,
                              );
                              await _load();
                            }, 'Sitzung beendet.'),
                      child: const Text('ABMELDEN'),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          _card(
            title: 'DATENSCHUTZ & SICHERHEIT',
            children: [
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () => _run(() async {
                        final data = await api.privacyExport();
                        if (context.mounted)
                          await showDialog<void>(
                            context: context,
                            builder: (_) => AlertDialog(
                              title: const Text('Datenschutzexport'),
                              content: SelectableText(
                                const JsonEncoder.withIndent(
                                  '  ',
                                ).convert(jsonDecode(data)),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('SCHLIESSEN'),
                                ),
                              ],
                            ),
                          );
                      }, 'Export erstellt.'),
                icon: const Icon(Icons.download_rounded),
                label: const Text('DATENSCHUTZEXPORT'),
              ),
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () => _run(() async {
                        await api.logoutAll();
                        await external.signOut();
                        if (context.mounted) Navigator.pop(context);
                      }, 'Alle Sitzungen beendet.'),
                icon: const Icon(Icons.logout_rounded),
                label: const Text('AUF ALLEN GERÄTEN ABMELDEN'),
              ),
              TextButton.icon(
                style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
                onPressed: busy
                    ? null
                    : () async {
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('Konto löschen?'),
                            content: const Text(
                              'Das Konto wird dauerhaft gesperrt und alle Sitzungen werden beendet.',
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(context, false),
                                child: const Text('ABBRECHEN'),
                              ),
                              FilledButton(
                                onPressed: () => Navigator.pop(context, true),
                                child: const Text('LÖSCHEN'),
                              ),
                            ],
                          ),
                        );
                        if (confirmed == true)
                          await _run(() async {
                            await api.deleteAccount();
                            await external.signOut();
                            if (context.mounted) Navigator.pop(context);
                          }, 'Konto gelöscht.');
                      },
                icon: const Icon(Icons.delete_forever_rounded),
                label: const Text('KONTO LÖSCHEN'),
              ),
            ],
          ),
          if (message != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                message!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xffffd66b),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _card({String? title, required List<Widget> children}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xff111f35),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: Colors.white12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (title != null) ...[
          Text(
            title,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: Color(0xffffd66b),
            ),
          ),
          const SizedBox(height: 12),
        ],
        ...children,
      ],
    ),
  );
}
