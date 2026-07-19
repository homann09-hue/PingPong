import 'package:flutter/material.dart';
import 'models/game_definition.dart';
import 'screens/lobby_screen.dart';
import 'screens/slot_screen.dart';
import 'services/external_account_auth.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeExternalAccountAuth();
  runApp(const AuroraApp());
}

class AuroraApp extends StatelessWidget {
  const AuroraApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Aurora Casino',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      fontFamily: 'AuroraSans',
      brightness: Brightness.dark,
      colorScheme:
          ColorScheme.fromSeed(
            seedColor: const Color(0xffff42dc),
            brightness: Brightness.dark,
          ).copyWith(
            primary: const Color(0xffff42dc),
            secondary: const Color(0xffffd54b),
            tertiary: const Color(0xff54eaff),
            surface: const Color(0xff19072f),
          ),
      scaffoldBackgroundColor: const Color(0xff071a37),
      splashFactory: InkRipple.splashFactory,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: ZoomPageTransitionsBuilder(),
          TargetPlatform.macOS: ZoomPageTransitionsBuilder(),
          TargetPlatform.windows: ZoomPageTransitionsBuilder(),
          TargetPlatform.linux: ZoomPageTransitionsBuilder(),
        },
      ),
      cardTheme: CardThemeData(
        color: const Color(0xee19072f),
        shadowColor: const Color(0x88f03cff),
        elevation: 10,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0x99ffcf49)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: const Color(0xff18062d),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0xffffd64a), width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          textStyle: const TextStyle(fontWeight: FontWeight.w900),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
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
