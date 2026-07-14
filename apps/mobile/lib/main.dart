import 'package:flutter/material.dart';
import 'models/game_definition.dart';
import 'screens/lobby_screen.dart';
import 'screens/slot_screen.dart';

void main() => runApp(const AuroraApp());

class AuroraApp extends StatelessWidget {
  const AuroraApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Aurora Casino',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      fontFamily: 'AuroraSans',
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xffffc52f),
        brightness: Brightness.dark,
      ),
      scaffoldBackgroundColor: const Color(0xff071a37),
      splashFactory: InkRipple.splashFactory,
      useMaterial3: true,
    ),
    home: _initialScreen(),
  );

  Widget _initialScreen() {
    final requestedGame = Uri.base.queryParameters['game'];
    final matches = games.where((game) => game.id == requestedGame);
    if (matches.isEmpty) return const LobbyScreen();
    return SlotScreen(
      game: matches.first,
      balance: 8400000,
      level: 12,
      xp: 625,
      vipPoints: 2450,
    );
  }
}
