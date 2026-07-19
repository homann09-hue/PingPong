import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/game_definition.dart';
import '../services/casino_api.dart';
import '../widgets/top_hud.dart';

class SlotScreen extends StatefulWidget {
  const SlotScreen({
    super.key,
    required this.game,
    required this.balance,
    required this.level,
    required this.xp,
    required this.vipPoints,
    this.gems = 320,
    this.api,
  });
  final GameDefinition game;
  final int balance, level, xp, vipPoints, gems;
  final CasinoApi? api;
  @override
  State<SlotScreen> createState() => _SlotScreenState();
}

class _SlotScreenState extends State<SlotScreen> with TickerProviderStateMixin {
  late final CasinoApi api;
  late final AnimationController ambientController;
  late final AnimationController winController;
  late final AnimationController paylineController;
  Timer? welcomePresentationTimer;
  final random = Random();
  late int balance, level, xp, vipPoints;
  int bet = 100, win = 0, free = 0;
  List<int> betSteps = const [100, 200, 500, 1000, 2000, 5000, 10000];
  String evaluationLabel = '20 LINES';
  int spins = 0, totalWon = 0, totalFreeSpins = 0;
  int autoSpinsRemaining = 0;
  bool autoplay = false, stopAutoplayRequested = false, turbo = false;
  Map<String, int> jackpotPools = const {
    'MINI': 500000,
    'MINOR': 5000000,
    'GRAND': 50000000,
  };
  bool spinning = false;
  bool intenseWin = false;
  String? error, featureMode;
  String? winDetail;
  String? presentationTitle, presentationSubtitle;
  int presentationSequence = 0;
  IconData presentationIcon = Icons.auto_awesome_rounded;
  Set<String> winningCells = {};
  Set<String> clearingCells = {};
  List<PaylineWinView> winningPaylines = const [];
  List<int> reelStopEpochs = List<int>.filled(5, 0);
  List<List<String>> grid = [
    ['A', 'K', 'Q'],
    ['J', 'W', 'K'],
    ['Q', 'A', 'S'],
    ['K', 'J', 'A'],
    ['W', 'Q', 'J'],
  ];
  @override
  void initState() {
    super.initState();
    ambientController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );
    winController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    paylineController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
    );
    api = widget.api ?? CasinoApi();
    balance = widget.balance;
    level = widget.level;
    xp = widget.xp;
    vipPoints = widget.vipPoints;
    _loadJackpots();
    _loadPaytableMetadata();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _showWelcomePresentation();
    });
    unawaited(
      api.trackEvent('screen.viewed', screen: 'slot', slotId: widget.game.id),
    );
  }

  @override
  void dispose() {
    welcomePresentationTimer?.cancel();
    ambientController.dispose();
    winController.dispose();
    paylineController.dispose();
    super.dispose();
  }

  void _showWelcomePresentation() {
    if (!mounted) return;
    welcomePresentationTimer?.cancel();
    final sequence = ++presentationSequence;
    setState(() {
      presentationTitle = 'WELCOME TO\n${widget.game.name.toUpperCase()}';
      presentationSubtitle = 'WILD POWER • BONUS FEATURES • JACKPOTS';
      presentationIcon = Icons.local_fire_department_rounded;
    });
    welcomePresentationTimer = Timer(const Duration(milliseconds: 1800), () {
      if (!mounted || sequence != presentationSequence) return;
      setState(() {
        presentationTitle = null;
        presentationSubtitle = null;
      });
    });
  }

  Future<void> _loadJackpots() async {
    try {
      final pools = await api.jackpots();
      if (!mounted) return;
      setState(
        () => jackpotPools = {for (final pool in pools) pool.tier: pool.amount},
      );
    } on StateError {
      // Seed values keep offline startup and widget tests usable.
    }
  }

  Future<void> _loadPaytableMetadata() async {
    try {
      final paytable = await api.paytable(widget.game.id);
      if (!mounted) return;
      setState(() {
        betSteps = paytable.betSteps;
        if (!betSteps.contains(bet)) bet = betSteps.first;
        evaluationLabel = paytable.evaluationType == 'ways'
            ? '${paytable.ways ?? ''} WAYS'.trim()
            : '${paytable.lines} LINES';
      });
    } on StateError {
      // Bundled defaults remain usable while metadata is temporarily offline.
    }
  }

  Future<void> _showFeaturePresentation({
    required String title,
    required String subtitle,
    required IconData icon,
    Duration hold = const Duration(milliseconds: 820),
  }) async {
    if (!mounted) return;
    final sequence = ++presentationSequence;
    setState(() {
      presentationTitle = title;
      presentationSubtitle = subtitle;
      presentationIcon = icon;
    });
    await Future<void>.delayed(
      turbo ? const Duration(milliseconds: 260) : hold,
    );
    if (!mounted || sequence != presentationSequence) return;
    setState(() {
      presentationTitle = null;
      presentationSubtitle = null;
    });
    await Future<void>.delayed(Duration(milliseconds: turbo ? 80 : 260));
  }

  Future<void> _showWinLadder(SpinResponse result) async {
    final multiplier = result.win ~/ max(1, bet);
    final stages = <(String, IconData)>[
      ('BIG WIN', Icons.stars_rounded),
      if (multiplier >= 25 || result.maxWinReached)
        ('SUPER WIN', Icons.auto_awesome_rounded),
      if (multiplier >= 50 || result.maxWinReached)
        ('MEGA WIN', Icons.workspace_premium_rounded),
      if (result.maxWinReached) ('MAX WIN', Icons.emoji_events_rounded),
    ];
    for (final stage in stages) {
      await _showFeaturePresentation(
        title: stage.$1,
        subtitle: '${_fmt(result.win)} COINS • $multiplier× BET',
        icon: stage.$2,
        hold: const Duration(milliseconds: 620),
      );
    }
  }

  Future<SpinResponse?> spin({bool bonusBuy = false}) async {
    final wager = bet * (bonusBuy ? widget.game.bonusBuyMultiplier ?? 1 : 1);
    if (spinning || balance < wager) {
      if (balance < wager) {
        setState(() => error = 'Nicht genug Coins für diesen Einsatz.');
        await _showInsufficientCoins(wager);
      }
      return null;
    }
    unawaited(HapticFeedback.mediumImpact());
    ambientController.repeat(reverse: true);
    winController
      ..stop()
      ..value = 0;
    paylineController
      ..stop()
      ..value = 0;
    setState(() {
      spinning = true;
      win = 0;
      free = 0;
      error = null;
      featureMode = bonusBuy ? 'BONUS BUY' : 'GOOD LUCK';
      winDetail = null;
      intenseWin = false;
      winningCells = {};
      clearingCells = {};
      winningPaylines = const [];
      reelStopEpochs = List<int>.filled(max(1, grid.length), 0);
    });
    SpinResponse? response;
    Object? requestError;
    final request = api
        .spin(widget.game.id, bet, bonusBuy: bonusBuy)
        .then<void>(
          (value) => response = value,
          onError: (Object exception) {
            requestError = exception;
          },
        );
    for (var i = 0; i < 7; i++) {
      await Future<void>.delayed(Duration(milliseconds: turbo ? 18 : 65));
      if (!mounted) return null;
      setState(
        () => grid = List.generate(
          5,
          (_) => List.generate(
            3,
            (_) => ['A', 'K', 'Q', 'J', 'W', 'S'][random.nextInt(6)],
          ),
        ),
      );
    }
    try {
      await request;
      if (requestError != null) throw requestError!;
      final r = response!;
      if (!mounted) return null;
      final freeRounds = r.rounds
          .where((round) => round.phase == 'free_spin')
          .length;
      var displayedWin = 0;
      var freeSpinsIntroduced = false;
      var respinsIntroduced = false;
      for (
        var roundPosition = 0;
        roundPosition < r.rounds.length;
        roundPosition++
      ) {
        final round = r.rounds[roundPosition];
        final nextRound = roundPosition + 1 < r.rounds.length
            ? r.rounds[roundPosition + 1]
            : null;
        if (!mounted) return null;
        if (round.phase == 'bonus') {
          await _showFeaturePresentation(
            title: switch (round.bonusMode) {
              'hold_and_win' => 'HOLD & WIN',
              'wheel' => 'WHEEL BONUS',
              'coin_collect' => 'COIN COLLECT',
              'jackpot' => '${round.bonusTier ?? 'MEGA'} JACKPOT',
              _ => 'BONUS GAME',
            },
            subtitle: switch (round.bonusMode) {
              'hold_and_win' => '3 RESPINS • COINS LOCKEN • JACKPOTS JAGEN',
              'wheel' => 'DAS PREMIUM-RAD WIRD AKTIVIERT',
              'coin_collect' => 'COINS SAMMELN • MULTIPLIKATOR AUFBAUEN',
              'jackpot' => 'PROGRESSIVER PREIS WIRD ENTHÜLLT',
              _ => 'WÄHLE DEINE SCHÄTZE',
            },
            icon: round.bonusMode == 'jackpot'
                ? Icons.emoji_events_rounded
                : Icons.auto_awesome_rounded,
          );
          await _showBonus(round);
        } else {
          if (round.phase == 'free_spin' && !freeSpinsIntroduced) {
            freeSpinsIntroduced = true;
            await _showFeaturePresentation(
              title: '$freeRounds FREE SPINS',
              subtitle: 'SPECIAL REELS • EXTRA WILDS • MULTIPLIKATOREN',
              icon: Icons.bolt_rounded,
            );
          } else if (round.phase == 'respin' && !respinsIntroduced) {
            respinsIntroduced = true;
            await _showFeaturePresentation(
              title: 'LOCK & RESPIN',
              subtitle: '3 RESPINS • LOCKED COINS • JACKPOT CHANCE',
              icon: Icons.lock_clock_rounded,
            );
          }
          displayedWin += round.win;
          await _revealGrid(round.grid);
          if (!mounted) return null;
          setState(() {
            win = displayedWin;
            winningCells = round.winningCells;
            winningPaylines = round.paylineWins;
            winDetail = round.winLabel;
            featureMode = switch (round.phase) {
              'free_spin' => 'FREE SPIN ${round.index} / $freeRounds',
              'cascade' =>
                round.featureLabel == null
                    ? 'CASCADE ${round.index}'
                    : '${round.featureLabel} • CASCADE ${round.index}',
              'respin' => '${round.featureLabel ?? 'RESPIN'} ${round.index}',
              _ => round.featureLabel,
            };
          });
          if (round.win > 0) {
            unawaited(winController.forward(from: 0));
            if (round.paylineWins.isNotEmpty) {
              unawaited(paylineController.forward(from: 0));
            }
          }
          final clearsIntoCascade =
              nextRound?.phase == 'cascade' && round.winningCells.isNotEmpty;
          if (clearsIntoCascade) {
            await Future<void>.delayed(
              Duration(milliseconds: turbo ? 90 : 680),
            );
            if (!mounted) return null;
            winController.stop();
            paylineController.stop();
            setState(() {
              clearingCells = round.winningCells;
              winningPaylines = const [];
              featureMode = 'CASCADE CHARGED • NEXT DROP';
            });
            unawaited(HapticFeedback.mediumImpact());
            await Future<void>.delayed(
              Duration(milliseconds: turbo ? 100 : 320),
            );
            if (!mounted) return null;
            setState(() => clearingCells = {});
          } else if (r.rounds.length > 1) {
            await Future<void>.delayed(
              Duration(milliseconds: turbo ? 120 : 520),
            );
          }
        }
      }
      if (!mounted) return null;
      setState(() {
        grid = r.rounds.lastWhere((round) => round.phase != 'bonus').grid;
        clearingCells = {};
        winningPaylines = r.rounds
            .lastWhere((round) => round.phase != 'bonus')
            .paylineWins;
        balance = r.balance;
        win = r.win;
        free = r.freeSpins;
        featureMode = r.maxWinReached
            ? 'MAX WIN • ${r.win ~/ bet}× BET'
            : r.winClass != null
            ? '${r.winClass} WIN • ${r.win ~/ bet}× BET'
            : free > 0
            ? '$free FREE SPINS COMPLETE'
            : null;
        jackpotPools = {for (final pool in r.jackpots) pool.tier: pool.amount};
        level = r.level;
        xp = r.xp;
        spins = r.spins;
        totalWon = r.totalWon;
        totalFreeSpins = r.totalFreeSpins;
        vipPoints = r.vipPoints;
      });
      if (r.win > 0) {
        final winMultiplier = r.win ~/ max(1, bet);
        intenseWin = r.maxWinReached || winMultiplier >= 10;
        unawaited(HapticFeedback.heavyImpact());
        unawaited(winController.forward(from: 0));
        if (intenseWin) {
          await _showWinLadder(r);
        }
      }
      unawaited(
        api.trackEvent(
          'slot.presentation_completed',
          screen: 'slot',
          slotId: widget.game.id,
        ),
      );
      return r;
    } on SpinException catch (exception) {
      if (!mounted) return null;
      if (exception.code == 'HIGH_ROLLER_MEMBERSHIP_REQUIRED') {
        setState(() {
          error = 'Deine High-Roller-Mitgliedschaft ist nicht mehr aktiv.';
          autoplay = false;
          stopAutoplayRequested = true;
        });
        await showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('HIGH ROLLER CLUB'),
            content: const Text(
              'Dieser exklusive Slot benötigt eine aktive Mitgliedschaft.',
            ),
            actions: [
              FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('ZUM CLUB'),
              ),
            ],
          ),
        );
        if (mounted) {
          Navigator.pop(context, {
            'balance': balance,
            'level': level,
            'xp': xp,
            'spins': spins,
            'totalWon': totalWon,
            'totalFreeSpins': totalFreeSpins,
            'vipPoints': vipPoints,
            'highRollerRequired': 1,
          });
        }
      } else {
        setState(() => error = 'Spin abgelehnt (${exception.code}).');
      }
      return null;
    } catch (e) {
      if (mounted) {
        setState(() => error = 'Verbindung verloren – noch einmal tippen.');
      }
      return null;
    } finally {
      ambientController
        ..stop()
        ..value = 0;
      if (mounted) {
        setState(() {
          spinning = false;
          clearingCells = {};
        });
      }
    }
  }

  Future<void> _revealGrid(List<List<String>> target) async {
    for (var reel = 0; reel < target.length; reel++) {
      if (!mounted) return;
      final triggerCount = target
          .take(reel + 1)
          .expand((column) => column)
          .where((symbol) => symbol == 'S' || symbol == 'B')
          .length;
      final anticipation = reel < target.length - 1 && triggerCount >= 2;
      setState(() {
        final next = [
          for (final column in grid) [...column],
        ];
        while (next.length <= reel) {
          next.add([...target[reel]]);
        }
        next[reel] = [...target[reel]];
        grid = next;
        while (reelStopEpochs.length < target.length) {
          reelStopEpochs.add(0);
        }
        reelStopEpochs[reel]++;
        if (anticipation) {
          featureMode = 'FEATURE CHANCE • REEL ${reel + 2}';
        }
      });
      unawaited(
        anticipation
            ? HapticFeedback.mediumImpact()
            : HapticFeedback.selectionClick(),
      );
      if (reel < target.length - 1) {
        await Future<void>.delayed(
          Duration(
            milliseconds: turbo
                ? (anticipation ? 90 : 24)
                : (anticipation ? 360 : 105),
          ),
        );
      }
    }
  }

  Future<void> _showInsufficientCoins(int wager) async {
    final destination = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('MEHR COINS BENÖTIGT'),
        content: Text(
          'Für diesen Spin fehlen ${_fmt(wager - balance)} Coins. Nutze kostenlose Boni oder öffne den Shop.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, 'rewards'),
            child: const Text('BONUS-CENTER'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, 'shop'),
            child: const Text('SHOP ÖFFNEN'),
          ),
        ],
      ),
    );
    if (!mounted || destination == null) return;
    Navigator.pop(context, {
      'balance': balance,
      'level': level,
      'xp': xp,
      'spins': spins,
      'totalWon': totalWon,
      'totalFreeSpins': totalFreeSpins,
      'vipPoints': vipPoints,
      if (destination == 'shop') 'openShop': 1,
      if (destination == 'rewards') 'openRewards': 1,
    });
  }

  Future<void> _startAutoplay(int count) async {
    if (spinning || autoplay || count <= 0) return;
    setState(() {
      autoplay = true;
      stopAutoplayRequested = false;
      autoSpinsRemaining = count;
    });
    try {
      while (mounted && !stopAutoplayRequested && autoSpinsRemaining > 0) {
        if (balance < bet) {
          setState(() => error = 'Autoplay gestoppt: nicht genug Coins.');
          break;
        }
        final result = await spin();
        if (!mounted || result == null) break;
        setState(() => autoSpinsRemaining -= 1);
        final bonusStarted = result.rounds.any(
          (round) => round.phase == 'bonus' || round.phase == 'free_spin',
        );
        final jackpotWon = result.rounds.any(
          (round) => round.bonusMode == 'jackpot',
        );
        final bigWin = result.maxWinReached || result.win >= bet * 20;
        if (bonusStarted || jackpotWon || bigWin) {
          setState(() {
            stopAutoplayRequested = true;
            featureMode = jackpotWon
                ? 'AUTOPLAY STOP • JACKPOT'
                : bonusStarted
                ? 'AUTOPLAY STOP • FEATURE'
                : 'AUTOPLAY STOP • BIG WIN';
          });
          break;
        }
        if (autoSpinsRemaining > 0 && !stopAutoplayRequested) {
          await Future<void>.delayed(Duration(milliseconds: turbo ? 120 : 450));
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          autoplay = false;
          stopAutoplayRequested = false;
          autoSpinsRemaining = 0;
        });
      }
    }
  }

  void _stopAutoplay() {
    if (!autoplay) return;
    setState(() {
      stopAutoplayRequested = true;
      featureMode = 'AUTOPLAY STOPPT NACH DIESEM SPIN';
    });
  }

  Future<void> _buyBonus() async {
    final multiplier = widget.game.bonusBuyMultiplier;
    if (multiplier == null || spinning || autoplay) return;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('BONUS KAUFEN?'),
        content: Text(
          'Starte das Bonusspiel sofort für ${_fmt(bet * multiplier)} Spielgeld-Coins.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('ABBRECHEN'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('BONUS STARTEN'),
          ),
        ],
      ),
    );
    if (accepted == true) await spin(bonusBuy: true);
  }

  Future<void> _showGameInfo() async {
    try {
      final paytable = await api.paytable(widget.game.id);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('${widget.game.name} • PAYTABLE'),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${paytable.evaluationType == 'ways' ? '${paytable.variableWays ? 'BIS ZU ' : ''}${paytable.ways ?? ''} WAYS' : '${paytable.lines} GEWINNLINIEN'}  •  RTP-ZIEL ${(paytable.targetRtp * 100).toStringAsFixed(1)}%  •  ${paytable.volatility.toUpperCase()}',
                    style: TextStyle(
                      color: widget.game.primary,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'MAX WIN ${paytable.maxWinMultiplier}×  •  MATH ${paytable.mathModelVersion}\nEINSÄTZE ${paytable.betSteps.map(_fmt).join(' • ')}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    paytable.evaluationType == 'ways'
                        ? 'Der angezeigte Einsatz ist der Gesamteinsatz. Gewinne entstehen aus gleichen Symbolen auf aufeinanderfolgenden Walzen; mehrere Treffer pro Walze erhöhen die Anzahl der Ways.'
                        : 'Der angezeigte Einsatz ist der Gesamteinsatz. Liniengewinne werden aus Gesamteinsatz ÷ Gewinnlinien berechnet.',
                  ),
                  const SizedBox(height: 14),
                  for (final entry in paytable.symbols.entries)
                    if ((entry.value['payouts'] as Map).isNotEmpty)
                      _PaytableRow(
                        symbol: entry.key,
                        definition: entry.value,
                        assetPath:
                            _symbolPaths[widget.game.symbolSet]?[entry.key],
                        color: widget.game.primary,
                      ),
                  const SizedBox(height: 10),
                  Text(widget.game.features),
                  const SizedBox(height: 12),
                  const Text(
                    'Nur virtuelle Spielgeld-Coins. Kein Geldwert, keine Übertragbarkeit und keine Auszahlung möglich.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('VERSTANDEN'),
            ),
          ],
        ),
      );
    } catch (_) {
      if (mounted) setState(() => error = 'Paytable momentan nicht verfügbar.');
    }
  }

  Future<void> _showBonus(SpinRoundView round) {
    final dialog = switch (round.bonusMode) {
      'wheel' => _WheelBonusDialog(
        reward: round.win,
        multiplier: round.bonusMultiplier ?? 1,
        segment: round.bonusSegment ?? 0,
        color: widget.game.primary,
        secondary: widget.game.secondary,
        backgroundAsset: widget.game.asset,
      ),
      'hold_and_win' => _HoldAndWinDialog(
        reward: round.win,
        multiplier: round.bonusMultiplier ?? 1,
        spots: round.bonusSpots ?? 6,
        boardSize: round.bonusBoardSize ?? 15,
        initialSpots: round.bonusInitialSpots,
        steps: round.bonusRespinSteps,
        primary: widget.game.primary,
        secondary: widget.game.secondary,
        backgroundAsset: widget.game.asset,
      ),
      'coin_collect' => _CoinCollectDialog(
        reward: round.win,
        multiplier: round.bonusMultiplier ?? 1,
        coins: round.bonusCoins,
        color: widget.game.primary,
        secondary: widget.game.secondary,
        backgroundAsset: widget.game.asset,
      ),
      'jackpot' => _JackpotDialog(
        reward: round.win,
        tier: round.bonusTier ?? 'MINI',
        color: widget.game.primary,
        secondary: widget.game.secondary,
        backgroundAsset: widget.game.asset,
      ),
      _ => _TreasurePickDialog(
        reward: round.win,
        multiplier: round.bonusMultiplier ?? 1,
        picks: round.bonusPickMultipliers,
        boardSize: round.bonusBoardSize ?? 3,
        primary: widget.game.primary,
        secondary: widget.game.secondary,
        backgroundAsset: widget.game.asset,
      ),
    };
    return showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black,
      barrierLabel: 'Bonus feature',
      transitionDuration: const Duration(milliseconds: 420),
      pageBuilder: (_, _, _) => dialog,
      transitionBuilder: (_, animation, _, child) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: .94, end: 1).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutBack),
          ),
          child: child,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop && (spinning || autoplay)) {
        _stopAutoplay();
        setState(() => error = 'Der aktuelle Spin wird sicher abgeschlossen.');
      } else if (!didPop) {
        Navigator.pop(context, {
          'balance': balance,
          'level': level,
          'xp': xp,
          'spins': spins,
          'totalWon': totalWon,
          'totalFreeSpins': totalFreeSpins,
          'vipPoints': vipPoints,
        });
      }
    },
    child: Scaffold(
      backgroundColor: const Color(0xff040817),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1320),
          child: Column(
            children: [
              TopHud(balance: balance, level: level, xp: xp, gems: widget.gems),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final desktop = constraints.maxWidth >= 900;
                    return Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.asset(widget.game.asset, fit: BoxFit.cover),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x66000000), Color(0xff080318)],
                            ),
                          ),
                        ),
                        AnimatedBuilder(
                          animation: ambientController,
                          builder: (context, child) => IgnorePointer(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment(
                                    -1 + ambientController.value * .7,
                                    -1,
                                  ),
                                  end: Alignment(
                                    1 - ambientController.value * .7,
                                    1,
                                  ),
                                  colors: [
                                    widget.game.primary.withValues(alpha: .18),
                                    Colors.transparent,
                                    widget.game.secondary.withValues(
                                      alpha: .24,
                                    ),
                                  ],
                                  stops: const [0, .48, 1],
                                ),
                              ),
                            ),
                          ),
                        ),
                        AnimatedBuilder(
                          animation: winController,
                          builder: (context, child) => IgnorePointer(
                            child: _WinCelebration(
                              progress: winController.value,
                              primary: widget.game.primary,
                              secondary: widget.game.secondary,
                              intense: intenseWin,
                            ),
                          ),
                        ),
                        AnimatedBuilder(
                          animation: winController,
                          builder: (context, child) {
                            final remaining = 1 - winController.value;
                            final amplitude = intenseWin ? 6.0 : 0.0;
                            final shakeX =
                                sin(winController.value * pi * 18) *
                                remaining *
                                amplitude;
                            final shakeY =
                                cos(winController.value * pi * 14) *
                                remaining *
                                amplitude *
                                .45;
                            return Transform.translate(
                              offset: Offset(shakeX, shakeY),
                              child: child,
                            );
                          },
                          child: SafeArea(
                            top: false,
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    IconButton(
                                      onPressed: spinning || autoplay
                                          ? null
                                          : () => Navigator.pop(context, {
                                              'balance': balance,
                                              'level': level,
                                              'xp': xp,
                                              'spins': spins,
                                              'totalWon': totalWon,
                                              'totalFreeSpins': totalFreeSpins,
                                              'vipPoints': vipPoints,
                                            }),
                                      icon: const Icon(Icons.arrow_back),
                                    ),
                                    Expanded(
                                      child: Text(
                                        widget.game.name,
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(
                                          fontSize: 22,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      onPressed: _showGameInfo,
                                      icon: const Icon(Icons.info_outline),
                                    ),
                                  ],
                                ),
                                if (desktop)
                                  _featureMasthead()
                                else
                                  _jackpots(),
                                SizedBox(
                                  height: desktop
                                      ? 42
                                      : (featureMode == null ? 0 : 42),
                                  child: AnimatedSwitcher(
                                    duration: const Duration(milliseconds: 220),
                                    child: featureMode == null
                                        ? const SizedBox.shrink()
                                        : Container(
                                            key: ValueKey(featureMode),
                                            margin: const EdgeInsets.only(
                                              top: 6,
                                            ),
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 18,
                                              vertical: 6,
                                            ),
                                            decoration: BoxDecoration(
                                              color: widget.game.secondary
                                                  .withValues(alpha: .92),
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                              border: Border.all(
                                                color: widget.game.primary,
                                                width: 2,
                                              ),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: widget.game.primary
                                                      .withValues(alpha: .5),
                                                  blurRadius: 12,
                                                ),
                                              ],
                                            ),
                                            child: Text(
                                              featureMode!,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                          ),
                                  ),
                                ),
                                const Spacer(),
                                _cabinet(desktop: desktop),
                                const SizedBox(height: 10),
                                if (!desktop && win > 0)
                                  TweenAnimationBuilder<int>(
                                    tween: IntTween(begin: 0, end: win),
                                    duration: const Duration(milliseconds: 850),
                                    curve: Curves.easeOutCubic,
                                    builder: (context, value, child) => Text(
                                      'WIN  ${_fmt(value)}',
                                      style: TextStyle(
                                        fontSize: desktop ? 34 : 28,
                                        fontWeight: FontWeight.w900,
                                        color: widget.game.primary,
                                        shadows: [
                                          Shadow(
                                            color: widget.game.primary,
                                            blurRadius: 18,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                if (!desktop && winDetail != null)
                                  Text(
                                    winDetail!,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.1,
                                    ),
                                  ),
                                if (error != null)
                                  Text(
                                    error!,
                                    style: const TextStyle(
                                      color: Colors.redAccent,
                                    ),
                                  ),
                                const Spacer(),
                                _controls(desktop: desktop),
                                SizedBox(height: desktop ? 0 : 18),
                              ],
                            ),
                          ),
                        ),
                        IgnorePointer(
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 320),
                            switchInCurve: Curves.easeOutBack,
                            switchOutCurve: Curves.easeInCubic,
                            transitionBuilder: (child, animation) =>
                                FadeTransition(
                                  opacity: animation,
                                  child: ScaleTransition(
                                    scale: Tween<double>(
                                      begin: .82,
                                      end: 1,
                                    ).animate(animation),
                                    child: child,
                                  ),
                                ),
                            child: presentationTitle == null
                                ? const SizedBox.shrink(
                                    key: ValueKey('feature-curtain-hidden'),
                                  )
                                : _FeatureCurtain(
                                    key: ValueKey(
                                      '$presentationTitle-$presentationSequence',
                                    ),
                                    title: presentationTitle!,
                                    subtitle: presentationSubtitle!,
                                    icon: presentationIcon,
                                    backgroundAsset: widget.game.asset,
                                    symbolPaths:
                                        _symbolPaths[widget.game.symbolSet]!,
                                    primary: widget.game.primary,
                                    secondary: widget.game.secondary,
                                  ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _featureMasthead() => Container(
    height: 54,
    margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    padding: const EdgeInsets.symmetric(horizontal: 14),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [
          const Color(0xee150323),
          widget.game.secondary.withValues(alpha: .9),
          const Color(0xee150323),
        ],
      ),
      border: Border.all(color: widget.game.primary, width: 2),
      borderRadius: BorderRadius.circular(14),
      boxShadow: [
        BoxShadow(
          color: widget.game.primary.withValues(alpha: .34),
          blurRadius: 15,
        ),
      ],
    ),
    child: Row(
      children: [
        Icon(Icons.local_fire_department, color: widget.game.primary, size: 30),
        const SizedBox(width: 8),
        Text(
          widget.game.name.toUpperCase(),
          style: TextStyle(
            color: const Color(0xffffec9a),
            fontSize: 23,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
            shadows: [
              Shadow(color: widget.game.secondary, blurRadius: 10),
              const Shadow(color: Colors.black, blurRadius: 4),
            ],
          ),
        ),
        const Spacer(),
        for (final feature in const [
          ('WILD POWER', Icons.auto_awesome),
          ('MEGA JACKPOT', Icons.workspace_premium),
          ('FREE SPINS', Icons.casino),
        ]) ...[
          Container(
            margin: const EdgeInsets.only(left: 8),
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
            decoration: BoxDecoration(
              color: const Color(0xcc08020f),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: widget.game.primary.withValues(alpha: .8),
              ),
            ),
            child: Row(
              children: [
                Icon(feature.$2, size: 15, color: widget.game.primary),
                const SizedBox(width: 5),
                Text(
                  feature.$1,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    ),
  );

  Widget _cabinet({required bool desktop}) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      if (desktop) ...[
        SizedBox(width: 74, height: 256, child: _paylineRail()),
        const SizedBox(width: 7),
      ],
      Expanded(child: _reels(desktop: desktop)),
      if (desktop) ...[
        const SizedBox(width: 7),
        SizedBox(width: 142, height: 256, child: _jackpotTower()),
      ],
    ],
  );

  Widget _paylineRail() {
    final winningLineNumbers = winningPaylines
        .map((win) => win.line + 1)
        .toSet();
    final displayedLines = <int>[
      ...winningLineNumbers,
      for (var line = 1; line <= 20; line++)
        if (!winningLineNumbers.contains(line)) line,
    ].take(5).toList();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xe8110324),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: widget.game.primary, width: 2),
        boxShadow: [
          BoxShadow(
            color: widget.game.secondary.withValues(alpha: .55),
            blurRadius: 14,
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            evaluationLabel,
            maxLines: 2,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          for (final line in displayedLines)
            Expanded(
              child: Center(
                child: AnimatedBuilder(
                  animation: paylineController,
                  builder: (context, child) {
                    final active = winningLineNumbers.contains(line);
                    final pulse = active
                        ? sin(paylineController.value * pi * 4).abs()
                        : 0.0;
                    return Transform.scale(
                      scale: 1 + pulse * .12,
                      child: Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: active
                                ? [Colors.white, widget.game.primary]
                                : [widget.game.primary, widget.game.secondary],
                          ),
                          border: Border.all(
                            color: active
                                ? const Color(0xfffff3a8)
                                : Colors.white,
                            width: active ? 3 : 2,
                          ),
                          boxShadow: active
                              ? [
                                  BoxShadow(
                                    color: widget.game.primary,
                                    blurRadius: 14 + pulse * 16,
                                    spreadRadius: 1 + pulse * 3,
                                  ),
                                ]
                              : null,
                        ),
                        child: Text(
                          '$line',
                          style: TextStyle(
                            color: active
                                ? const Color(0xff2a062e)
                                : Colors.white,
                            fontWeight: FontWeight.w900,
                            shadows: active
                                ? null
                                : const [
                                    Shadow(color: Colors.black, blurRadius: 3),
                                  ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _jackpotTower() {
    final tiers = [
      ('GRAND', jackpotPools['GRAND'] ?? 50000000),
      ('MAJOR', jackpotPools['MAJOR'] ?? 15000000),
      ('MINOR', jackpotPools['MINOR'] ?? 5000000),
      ('MINI', jackpotPools['MINI'] ?? 500000),
    ];
    return Container(
      padding: const EdgeInsets.all(7),
      decoration: BoxDecoration(
        color: const Color(0xe8110324),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: widget.game.primary, width: 2),
        boxShadow: [
          BoxShadow(
            color: widget.game.secondary.withValues(alpha: .55),
            blurRadius: 14,
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            'JACKPOTS',
            style: TextStyle(
              color: widget.game.primary,
              fontWeight: FontWeight.w900,
              letterSpacing: .8,
            ),
          ),
          const SizedBox(height: 4),
          for (final tier in tiers)
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(vertical: 3),
                padding: const EdgeInsets.symmetric(horizontal: 5),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xff22032d), Color(0xff06010c)],
                  ),
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(
                    color: widget.game.primary.withValues(alpha: .7),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      tier.$1,
                      style: TextStyle(
                        color: widget.game.primary,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    FittedBox(
                      child: Text(
                        _fmt(tier.$2),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _jackpots() => Row(
    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
    children: [
      for (final p in [
        ('GRAND', _fmt(jackpotPools['GRAND'] ?? 50000000)),
        ('MAJOR', _fmt(jackpotPools['MAJOR'] ?? 15000000)),
        ('MINOR', _fmt(jackpotPools['MINOR'] ?? 5000000)),
        ('MINI', _fmt(jackpotPools['MINI'] ?? 500000)),
      ])
        Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 2),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: .75),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: widget.game.primary),
            ),
            child: Column(
              children: [
                Text(
                  p.$1,
                  style: TextStyle(
                    fontSize: 9,
                    color: widget.game.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    p.$2,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
    ],
  );
  Widget _reels({required bool desktop}) => Center(
    child: AnimatedScale(
      scale: win > 0
          ? 1.018
          : spinning
          ? .985
          : 1,
      duration: Duration(milliseconds: spinning ? 120 : 280),
      curve: Curves.easeOutBack,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        constraints: BoxConstraints(maxWidth: desktop ? 960 : 760),
        height: desktop ? 256 : 300,
        margin: const EdgeInsets.symmetric(horizontal: 10),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              widget.game.primary,
              const Color(0xfffff1b7),
              widget.game.primary,
              widget.game.secondary,
            ],
            stops: const [0, .34, .72, 1],
          ),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: Colors.white.withValues(alpha: .65),
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: widget.game.primary.withValues(alpha: win > 0 ? .95 : .62),
              blurRadius: win > 0 ? 46 : 27,
              spreadRadius: win > 0 ? 6 : 1,
            ),
            BoxShadow(
              color: widget.game.secondary.withValues(alpha: .62),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: const Color(0xff13082d),
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: const Color(0xff3f176c), width: 2),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Row(
                children: [
                  for (var reel = 0; reel < grid.length; reel++)
                    Expanded(child: _animatedReel(reel)),
                ],
              ),
              if (winningPaylines.isNotEmpty)
                Positioned.fill(
                  child: IgnorePointer(
                    child: AnimatedBuilder(
                      animation: paylineController,
                      builder: (context, child) => CustomPaint(
                        key: const ValueKey('winning-payline-overlay'),
                        painter: _PaylinePainter(
                          wins: winningPaylines,
                          progress: paylineController.value,
                          reels: grid.length,
                          rows: grid.isEmpty ? 0 : grid.first.length,
                          primary: widget.game.primary,
                          secondary: widget.game.secondary,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _animatedReel(int reel) {
    final column = Column(
      children: [
        for (var row = 0; row < grid[reel].length; row++)
          Expanded(child: _symbol(grid[reel][row], reel, row)),
      ],
    );
    final epoch = reel < reelStopEpochs.length ? reelStopEpochs[reel] : 0;
    if (epoch == 0) return column;
    return TweenAnimationBuilder<double>(
      key: ValueKey('reel-stop-$reel-$epoch'),
      tween: Tween<double>(begin: 0, end: 1),
      duration: Duration(milliseconds: turbo ? 110 : 260),
      curve: Curves.easeOutCubic,
      child: column,
      builder: (context, progress, child) {
        final impulse = sin(progress * pi);
        return Transform.translate(
          offset: Offset(0, impulse * 5),
          child: Transform.scale(
            scale: 1 + impulse * .025,
            child: Stack(
              fit: StackFit.expand,
              children: [
                child!,
                IgnorePointer(
                  child: Opacity(
                    opacity: impulse * .32,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .08),
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: [
                          BoxShadow(
                            color: widget.game.primary,
                            blurRadius: 18,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _symbol(String symbol, int reel, int row) {
    final paths = _symbolPaths[widget.game.symbolSet]!;
    final assetPath = paths[symbol];
    final key = ValueKey(
      '$symbol-$reel-$row-${spinning ? random.nextInt(999) : 0}',
    );
    final winning = winningCells.contains('$reel:$row');
    final clearing = clearingCells.contains('$reel:$row');
    final cell = Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        gradient: RadialGradient(
          colors: winning
              ? [Colors.white, widget.game.primary]
              : const [Color(0xfffef2c4), Color(0xffdba850)],
        ),
        border: Border.all(
          color: winning ? Colors.white : const Color(0x664a2300),
          width: winning ? 3 : 1,
        ),
        boxShadow: winning
            ? [
                BoxShadow(
                  color: widget.game.primary,
                  blurRadius: 16,
                  spreadRadius: 2,
                ),
              ]
            : null,
      ),
      child: Stack(
        fit: StackFit.expand,
        alignment: Alignment.center,
        children: [
          if (symbol == 'C')
            const Icon(
              Icons.monetization_on_rounded,
              color: Color(0xffffc928),
              size: 48,
              shadows: [Shadow(color: Colors.white, blurRadius: 8)],
            )
          else if (symbol == 'M')
            Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  colors: [
                    Color(0xffffffff),
                    Color(0xffff35dc),
                    Color(0xff4815a9),
                  ],
                ),
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0xffff35dc),
                    blurRadius: 12,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Text(
                '×2',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 25,
                  fontWeight: FontWeight.w900,
                  shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                ),
              ),
            )
          else if (assetPath != null)
            Image.asset(
              assetPath,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.medium,
            )
          else
            Center(
              child: Text(
                const {'X': '10', 'Y': '9', 'Z': '8', 'T': '7'}[symbol] ??
                    symbol,
                style: TextStyle(
                  color: widget.game.secondary,
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  shadows: const [Shadow(color: Colors.white, blurRadius: 5)],
                ),
              ),
            ),
          if (symbol == 'B')
            Align(
              alignment: Alignment.bottomCenter,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: const Color(0xdd260047),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.white),
                ),
                child: const Text(
                  'BONUS',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
    final animatedCell = winning
        ? AnimatedBuilder(
            animation: winController,
            child: cell,
            builder: (context, child) {
              final pulse = sin(winController.value * pi * 3).abs();
              return Transform.scale(
                scale: 1 + pulse * (intenseWin ? .075 : .052),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.white.withValues(alpha: .45 + pulse * .55),
                      width: 1 + pulse * 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: widget.game.primary.withValues(
                          alpha: .38 + pulse * .55,
                        ),
                        blurRadius: 12 + pulse * 24,
                        spreadRadius: pulse * 3,
                      ),
                    ],
                  ),
                  child: child,
                ),
              );
            },
          )
        : cell;
    final cascadeCell = Stack(
      key: key,
      fit: StackFit.expand,
      clipBehavior: Clip.none,
      children: [
        AnimatedOpacity(
          opacity: clearing ? 0 : 1,
          duration: Duration(milliseconds: turbo ? 90 : 260),
          curve: Curves.easeInCubic,
          child: AnimatedScale(
            scale: clearing ? .18 : 1,
            duration: Duration(milliseconds: turbo ? 90 : 260),
            curve: Curves.easeInBack,
            child: AnimatedRotation(
              turns: clearing ? .08 : 0,
              duration: Duration(milliseconds: turbo ? 90 : 260),
              curve: Curves.easeInCubic,
              child: animatedCell,
            ),
          ),
        ),
        if (clearing)
          Positioned.fill(
            key: ValueKey('cascade-burst-$reel-$row'),
            child: _CascadeBurst(
              primary: widget.game.primary,
              secondary: widget.game.secondary,
              turbo: turbo,
            ),
          ),
      ],
    );
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 140),
      transitionBuilder: (child, animation) => SlideTransition(
        position: Tween(begin: const Offset(0, -.55), end: Offset.zero).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        ),
        child: FadeTransition(opacity: animation, child: child),
      ),
      child: cascadeCell,
    );
  }

  Widget _controls({required bool desktop}) {
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.game.bonusBuyMultiplier case final multiplier?) ...[
          OutlinedButton.icon(
            onPressed: spinning || autoplay ? null : _buyBonus,
            icon: const Icon(Icons.auto_awesome),
            label: Text('BUY BONUS  ${_fmt(bet * multiplier)}'),
            style: OutlinedButton.styleFrom(
              foregroundColor: widget.game.primary,
              side: BorderSide(color: widget.game.primary),
            ),
          ),
          const SizedBox(height: 8),
        ],
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FilterChip(
              selected: turbo,
              onSelected: autoplay
                  ? null
                  : (value) => setState(() => turbo = value),
              avatar: const Icon(Icons.bolt, size: 16),
              label: const Text('TURBO'),
              selectedColor: widget.game.primary,
              backgroundColor: const Color(0xdd19082e),
              side: BorderSide(color: widget.game.primary),
              labelStyle: TextStyle(
                color: turbo ? Colors.black : Colors.white,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(width: 8),
            PopupMenuButton<int>(
              enabled: !spinning && !autoplay,
              onSelected: _startAutoplay,
              itemBuilder: (_) => const [
                PopupMenuItem(value: 10, child: Text('10 AUTO SPINS')),
                PopupMenuItem(value: 25, child: Text('25 AUTO SPINS')),
                PopupMenuItem(value: 50, child: Text('50 AUTO SPINS')),
              ],
              child: Chip(
                avatar: const Icon(Icons.autorenew, size: 16),
                label: Text(autoplay ? 'AUTO $autoSpinsRemaining' : 'AUTO'),
                backgroundColor: const Color(0xdd19082e),
                side: BorderSide(color: widget.game.primary),
                labelStyle: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton.filled(
              constraints: const BoxConstraints.tightFor(width: 42, height: 42),
              onPressed: spinning || autoplay || betSteps.indexOf(bet) <= 0
                  ? null
                  : () => setState(
                      () => bet = betSteps[betSteps.indexOf(bet) - 1],
                    ),
              style: IconButton.styleFrom(
                backgroundColor: const Color(0xff3c1763),
                foregroundColor: const Color(0xffffdf58),
                side: BorderSide(color: widget.game.primary, width: 2),
              ),
              icon: const Icon(Icons.remove_rounded),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Column(
                children: [
                  Text(
                    '$evaluationLabel • BET',
                    style: const TextStyle(fontSize: 9),
                  ),
                  Text(
                    _fmt(bet),
                    style: TextStyle(
                      color: widget.game.primary,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      shadows: [
                        Shadow(color: widget.game.primary, blurRadius: 9),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            IconButton.filled(
              constraints: const BoxConstraints.tightFor(width: 42, height: 42),
              onPressed:
                  spinning ||
                      autoplay ||
                      betSteps.indexOf(bet) >= betSteps.length - 1
                  ? null
                  : () => setState(
                      () => bet = betSteps[betSteps.indexOf(bet) + 1],
                    ),
              style: IconButton.styleFrom(
                backgroundColor: const Color(0xff3c1763),
                foregroundColor: const Color(0xffffdf58),
                side: BorderSide(color: widget.game.primary, width: 2),
              ),
              icon: const Icon(Icons.add_rounded),
            ),
            const SizedBox(width: 8),
            AnimatedScale(
              scale: spinning
                  ? .92
                  : win > 0
                  ? 1.06
                  : 1,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutBack,
              child: Container(
                width: 136,
                height: 66,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xfffff5a6),
                      widget.game.primary,
                      widget.game.secondary,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: widget.game.primary.withValues(alpha: .85),
                      blurRadius: spinning ? 28 : 18,
                      spreadRadius: spinning ? 5 : 2,
                    ),
                  ],
                ),
                child: FilledButton(
                  onPressed: autoplay
                      ? _stopAutoplay
                      : spinning
                      ? null
                      : () => spin(),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xff35cf42),
                    disabledBackgroundColor: const Color(0xff1d7135),
                    foregroundColor: Colors.white,
                    shape: const StadiumBorder(),
                    side: const BorderSide(color: Colors.white, width: 2),
                  ),
                  child: spinning && !autoplay
                      ? const SizedBox.square(
                          dimension: 25,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          autoplay ? 'STOP $autoSpinsRemaining' : 'SPIN',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            shadows: [
                              Shadow(color: Colors.black54, blurRadius: 4),
                            ],
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
    if (!desktop) return content;
    return _desktopControls();
  }

  Widget _desktopControls() => Container(
    width: double.infinity,
    height: 82,
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xff8b189e), Color(0xff3b075f), Color(0xff170328)],
      ),
      border: Border(
        top: BorderSide(color: widget.game.primary, width: 2),
        bottom: BorderSide(color: widget.game.secondary, width: 2),
      ),
      boxShadow: [
        BoxShadow(
          color: widget.game.primary.withValues(alpha: .38),
          blurRadius: 18,
        ),
      ],
    ),
    child: Row(
      children: [
        if (widget.game.bonusBuyMultiplier case final multiplier?) ...[
          SizedBox(
            width: 165,
            child: OutlinedButton.icon(
              onPressed: spinning || autoplay ? null : _buyBonus,
              icon: const Icon(Icons.auto_awesome, size: 17),
              label: Text('BUY BONUS  ${_fmt(bet * multiplier)}'),
              style: OutlinedButton.styleFrom(
                foregroundColor: widget.game.primary,
                side: BorderSide(color: widget.game.primary, width: 2),
                padding: const EdgeInsets.symmetric(vertical: 15),
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
        FilterChip(
          selected: turbo,
          onSelected: autoplay
              ? null
              : (value) => setState(() => turbo = value),
          avatar: const Icon(Icons.bolt, size: 16),
          label: const Text('TURBO'),
          selectedColor: widget.game.primary,
          backgroundColor: const Color(0xdd19082e),
          side: BorderSide(color: widget.game.primary),
          labelStyle: TextStyle(
            color: turbo ? Colors.black : Colors.white,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(width: 7),
        PopupMenuButton<int>(
          enabled: !spinning && !autoplay,
          onSelected: _startAutoplay,
          itemBuilder: (_) => const [
            PopupMenuItem(value: 10, child: Text('10 AUTO SPINS')),
            PopupMenuItem(value: 25, child: Text('25 AUTO SPINS')),
            PopupMenuItem(value: 50, child: Text('50 AUTO SPINS')),
          ],
          child: Chip(
            avatar: const Icon(Icons.autorenew, size: 16),
            label: Text(autoplay ? 'AUTO $autoSpinsRemaining' : 'AUTO'),
            backgroundColor: const Color(0xdd19082e),
            side: BorderSide(color: widget.game.primary),
            labelStyle: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
        const SizedBox(width: 12),
        Container(
          height: 58,
          padding: const EdgeInsets.symmetric(horizontal: 5),
          decoration: BoxDecoration(
            color: const Color(0xcc090111),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: widget.game.primary, width: 2),
          ),
          child: Row(
            children: [
              IconButton.filled(
                constraints: const BoxConstraints.tightFor(
                  width: 40,
                  height: 40,
                ),
                onPressed: spinning || autoplay || betSteps.indexOf(bet) <= 0
                    ? null
                    : () => setState(
                        () => bet = betSteps[betSteps.indexOf(bet) - 1],
                      ),
                style: IconButton.styleFrom(
                  backgroundColor: const Color(0xff44156c),
                  foregroundColor: const Color(0xffffdf58),
                ),
                icon: const Icon(Icons.remove_rounded),
              ),
              SizedBox(
                width: 126,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '$evaluationLabel • BET',
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      _fmt(bet),
                      style: TextStyle(
                        color: widget.game.primary,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton.filled(
                constraints: const BoxConstraints.tightFor(
                  width: 40,
                  height: 40,
                ),
                onPressed:
                    spinning ||
                        autoplay ||
                        betSteps.indexOf(bet) >= betSteps.length - 1
                    ? null
                    : () => setState(
                        () => bet = betSteps[betSteps.indexOf(bet) + 1],
                      ),
                style: IconButton.styleFrom(
                  backgroundColor: const Color(0xff44156c),
                  foregroundColor: const Color(0xffffdf58),
                ),
                icon: const Icon(Icons.add_rounded),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Container(
            height: 58,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xcc08010e),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: widget.game.primary.withValues(alpha: .7),
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'GEWINN',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
                TweenAnimationBuilder<int>(
                  tween: IntTween(begin: 0, end: win),
                  duration: const Duration(milliseconds: 850),
                  curve: Curves.easeOutCubic,
                  builder: (context, value, child) => Text(
                    _fmt(value),
                    style: TextStyle(
                      color: win > 0 ? widget.game.primary : Colors.white70,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        AnimatedScale(
          scale: spinning
              ? .94
              : win > 0
              ? 1.04
              : 1,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutBack,
          child: Container(
            width: 174,
            height: 66,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(
                colors: [
                  const Color(0xfffff5a6),
                  widget.game.primary,
                  widget.game.secondary,
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: widget.game.primary.withValues(alpha: .8),
                  blurRadius: spinning ? 28 : 17,
                  spreadRadius: spinning ? 4 : 1,
                ),
              ],
            ),
            child: FilledButton(
              onPressed: autoplay
                  ? _stopAutoplay
                  : spinning
                  ? null
                  : () => spin(),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xffef4b2c),
                disabledBackgroundColor: const Color(0xff6d261f),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                side: const BorderSide(color: Colors.white, width: 2),
              ),
              child: spinning && !autoplay
                  ? const SizedBox.square(
                      dimension: 25,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      autoplay ? 'STOP $autoSpinsRemaining' : 'DREH!',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                      ),
                    ),
            ),
          ),
        ),
      ],
    ),
  );

  String _fmt(int v) => v.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );

  static const _symbolPaths = {
    'pharaoh': {
      'A': 'assets/symbols/pharaoh/pharaoh.png',
      'K': 'assets/symbols/pharaoh/scarab.png',
      'Q': 'assets/symbols/pharaoh/ankh.png',
      'J': 'assets/symbols/pharaoh/pyramid.png',
      'W': 'assets/symbols/pharaoh/wild.png',
      'S': 'assets/symbols/pharaoh/scatter.png',
      'B': 'assets/symbols/pharaoh/scatter.png',
    },
    'dragon': {
      'A': 'assets/symbols/dragon/dragon.png',
      'K': 'assets/symbols/dragon/egg.png',
      'Q': 'assets/symbols/dragon/sword.png',
      'J': 'assets/symbols/dragon/shield.png',
      'W': 'assets/symbols/dragon/wild.png',
      'S': 'assets/symbols/dragon/scatter.png',
      'B': 'assets/symbols/dragon/scatter.png',
    },
    'candy': {
      'A': 'assets/symbols/candy/bear.png',
      'K': 'assets/symbols/candy/lollipop.png',
      'Q': 'assets/symbols/candy/cupcake.png',
      'J': 'assets/symbols/candy/crown.png',
      'W': 'assets/symbols/candy/wild-v2.png',
      'S': 'assets/symbols/candy/scatter.png',
      'B': 'assets/symbols/candy/scatter.png',
    },
    'pirate': {
      'A': 'assets/symbols/pirate/captain.png',
      'K': 'assets/symbols/pirate/parrot.png',
      'Q': 'assets/symbols/pirate/compass.png',
      'J': 'assets/symbols/pirate/ship.png',
      'W': 'assets/symbols/pirate/wild.png',
      'S': 'assets/symbols/pirate/scatter.png',
      'B': 'assets/symbols/pirate/scatter.png',
    },
    'neon': {
      'A': 'assets/symbols/neon/star.png',
      'K': 'assets/symbols/neon/car.png',
      'Q': 'assets/symbols/neon/champagne.png',
      'J': 'assets/symbols/neon/diamond.png',
      'W': 'assets/symbols/neon/wild.png',
      'S': 'assets/symbols/neon/scatter.png',
      'B': 'assets/symbols/neon/scatter.png',
    },
    'frozen': {
      'A': 'assets/symbols/frozen/snowflake.png',
      'K': 'assets/symbols/frozen/wolf.png',
      'Q': 'assets/symbols/frozen/scepter.png',
      'J': 'assets/symbols/frozen/heart.png',
      'W': 'assets/symbols/frozen/wild.png',
      'S': 'assets/symbols/frozen/scatter.png',
      'B': 'assets/symbols/frozen/scatter.png',
    },
    'jungle': {
      'A': 'assets/symbols/jungle/jaguar.png',
      'K': 'assets/symbols/jungle/idol.png',
      'Q': 'assets/symbols/jungle/macaw.png',
      'J': 'assets/symbols/jungle/emerald.png',
      'W': 'assets/symbols/jungle/wild.png',
      'S': 'assets/symbols/jungle/scatter.png',
      'B': 'assets/symbols/jungle/scatter.png',
    },
    'vegas': {
      'A': 'assets/symbols/vegas/roulette.png',
      'K': 'assets/symbols/vegas/dice.png',
      'Q': 'assets/symbols/vegas/seven.png',
      'J': 'assets/symbols/vegas/chip.png',
      'W': 'assets/symbols/vegas/wild.png',
      'S': 'assets/symbols/vegas/scatter.png',
      'B': 'assets/symbols/vegas/scatter.png',
    },
  };
}

class _FeatureCurtain extends StatelessWidget {
  const _FeatureCurtain({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.backgroundAsset,
    required this.symbolPaths,
    required this.primary,
    required this.secondary,
  });

  final String title, subtitle, backgroundAsset;
  final IconData icon;
  final Map<String, String> symbolPaths;
  final Color primary, secondary;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final desktop = constraints.maxWidth >= 900;
      final symbolSize = desktop ? 94.0 : 62.0;
      return Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            backgroundAsset,
            fit: BoxFit.cover,
            color: const Color(0xaa12000b),
            colorBlendMode: BlendMode.multiply,
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                radius: .82,
                colors: [
                  primary.withValues(alpha: .38),
                  secondary.withValues(alpha: .82),
                  const Color(0xf5080012),
                ],
                stops: const [0, .58, 1],
              ),
            ),
          ),
          Center(
            child: Container(
              constraints: BoxConstraints(maxWidth: desktop ? 960 : 350),
              margin: EdgeInsets.symmetric(horizontal: desktop ? 28 : 18),
              padding: EdgeInsets.symmetric(
                horizontal: desktop ? 54 : 22,
                vertical: desktop ? 30 : 22,
              ),
              decoration: BoxDecoration(
                color: const Color(0xdd120018),
                borderRadius: BorderRadius.circular(desktop ? 34 : 26),
                border: Border.all(color: primary, width: 3),
                boxShadow: [
                  BoxShadow(
                    color: primary.withValues(alpha: .65),
                    blurRadius: 42,
                    spreadRadius: 5,
                  ),
                  BoxShadow(
                    color: secondary.withValues(alpha: .7),
                    blurRadius: 70,
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: desktop ? 64 : 52,
                    height: desktop ? 64 : 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Colors.white, primary, secondary],
                      ),
                      boxShadow: [BoxShadow(color: primary, blurRadius: 24)],
                    ),
                    child: Icon(
                      icon,
                      color: const Color(0xff210229),
                      size: desktop ? 36 : 29,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: const Color(0xfffff1a8),
                      fontSize: desktop ? 52 : 31,
                      height: .95,
                      fontWeight: FontWeight.w900,
                      letterSpacing: desktop ? 1.2 : .4,
                      shadows: [
                        Shadow(color: primary, blurRadius: 18),
                        Shadow(
                          color: secondary,
                          blurRadius: 5,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: desktop ? 15 : 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: desktop ? 1.7 : .8,
                    ),
                  ),
                  SizedBox(height: desktop ? 20 : 14),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final symbol in const ['W', 'S', 'A']) ...[
                        Container(
                          width: symbolSize,
                          height: symbolSize,
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: const Color(0xcc050008),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: symbol == 'S' ? Colors.white : primary,
                              width: symbol == 'S' ? 3 : 2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: primary.withValues(alpha: .55),
                                blurRadius: 16,
                              ),
                            ],
                          ),
                          child: Image.asset(
                            symbolPaths[symbol]!,
                            fit: BoxFit.contain,
                          ),
                        ),
                        if (symbol != 'A') SizedBox(width: desktop ? 15 : 9),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    },
  );
}

class _CascadeBurst extends StatelessWidget {
  const _CascadeBurst({
    required this.primary,
    required this.secondary,
    required this.turbo,
  });

  final Color primary, secondary;
  final bool turbo;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: Duration(milliseconds: turbo ? 100 : 320),
      curve: Curves.easeOutCubic,
      builder: (context, progress, child) => Opacity(
        opacity: (1 - progress).clamp(0.0, 1.0),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            for (var index = 0; index < 8; index++)
              Align(
                alignment: Alignment.center,
                child: Transform.translate(
                  offset: Offset(
                    cos(index * pi / 4) * (8 + progress * 42),
                    sin(index * pi / 4) * (8 + progress * 34),
                  ),
                  child: Transform.rotate(
                    angle: progress * pi * (index.isEven ? 1.5 : -1.5),
                    child: Icon(
                      index.isEven
                          ? Icons.auto_awesome_rounded
                          : Icons.diamond_rounded,
                      size: 12 + (index % 3) * 3,
                      color: index.isEven ? primary : secondary,
                      shadows: const [
                        Shadow(color: Colors.white, blurRadius: 8),
                        Shadow(color: Colors.black54, blurRadius: 3),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _PaylinePainter extends CustomPainter {
  const _PaylinePainter({
    required this.wins,
    required this.progress,
    required this.reels,
    required this.rows,
    required this.primary,
    required this.secondary,
  });

  final List<PaylineWinView> wins;
  final double progress;
  final int reels, rows;
  final Color primary, secondary;

  @override
  void paint(Canvas canvas, Size size) {
    if (wins.isEmpty || reels <= 0 || rows <= 0 || size.isEmpty) return;
    final stagedProgress = progress * wins.length;
    for (var index = 0; index < wins.length; index++) {
      final reveal = (stagedProgress - index).clamp(0.0, 1.0);
      if (reveal <= 0) continue;
      final cells =
          [
              for (final encoded in wins[index].cells)
                if (encoded.split(':').length == 2)
                  (
                    int.tryParse(encoded.split(':')[0]),
                    int.tryParse(encoded.split(':')[1]),
                  ),
            ].where((cell) => cell.$1 != null && cell.$2 != null).toList()
            ..sort((a, b) => a.$1!.compareTo(b.$1!));
      if (cells.length < 2) continue;
      final path = Path();
      for (var cellIndex = 0; cellIndex < cells.length; cellIndex++) {
        final reel = cells[cellIndex].$1!;
        final row = cells[cellIndex].$2!;
        final point = Offset(
          (reel + .5) * size.width / reels,
          (row + .5) * size.height / rows,
        );
        if (cellIndex == 0) {
          path.moveTo(point.dx, point.dy);
        } else {
          path.lineTo(point.dx, point.dy);
        }
      }
      final metrics = path.computeMetrics().toList();
      if (metrics.isEmpty) continue;
      final metric = metrics.first;
      final visiblePath = metric.extractPath(0, metric.length * reveal);
      final lineColor = Color.lerp(
        primary,
        secondary,
        wins.length == 1 ? .35 : index / max(1, wins.length - 1),
      )!;
      canvas.drawPath(
        visiblePath,
        Paint()
          ..color = lineColor.withValues(alpha: .72)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 15
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 11),
      );
      canvas.drawPath(
        visiblePath,
        Paint()
          ..color = lineColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 7
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      canvas.drawPath(
        visiblePath,
        Paint()
          ..color = Colors.white.withValues(alpha: .9)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.2
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      final tangent = metric.getTangentForOffset(metric.length * reveal);
      if (tangent != null) {
        canvas.drawCircle(
          tangent.position,
          14,
          Paint()
            ..color = lineColor.withValues(alpha: .7)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 9),
        );
        canvas.drawCircle(tangent.position, 6, Paint()..color = Colors.white);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _PaylinePainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.wins != wins ||
      oldDelegate.reels != reels ||
      oldDelegate.rows != rows ||
      oldDelegate.primary != primary ||
      oldDelegate.secondary != secondary;
}

class _WinCelebration extends StatelessWidget {
  const _WinCelebration({
    required this.progress,
    required this.primary,
    required this.secondary,
    required this.intense,
  });

  final double progress;
  final Color primary, secondary;
  final bool intense;

  @override
  Widget build(BuildContext context) {
    if (progress <= 0) return const SizedBox.shrink();
    final opacity = sin(progress * pi).clamp(0.0, 1.0);
    final particleCount = intense ? 48 : 28;
    return LayoutBuilder(
      builder: (context, constraints) => Stack(
        clipBehavior: Clip.none,
        children: [
          for (var index = 0; index < particleCount; index++)
            Positioned(
              left:
                  ((index * 97) % 100) /
                  100 *
                  max(0, constraints.maxWidth - 34),
              top:
                  constraints.maxHeight * (1.03 - progress * .92) +
                  sin(index * 1.7 + progress * pi * 4) * 32 +
                  (index % 5) * 16,
              child: Opacity(
                opacity: opacity,
                child: Transform.scale(
                  scale: .78 + opacity * .42 + (index % 3) * .06,
                  child: Transform.rotate(
                    angle: progress * pi * (2 + index % 4),
                    child: Icon(
                      index.isEven
                          ? Icons.monetization_on_rounded
                          : index % 3 == 0
                          ? Icons.diamond_rounded
                          : Icons.auto_awesome,
                      color: index % 3 == 0
                          ? Colors.white
                          : index.isEven
                          ? primary
                          : secondary,
                      size: 18 + (index % 4) * 5,
                      shadows: [
                        Shadow(
                          color: index.isEven ? primary : secondary,
                          blurRadius: intense ? 18 : 10,
                        ),
                        const Shadow(color: Colors.black54, blurRadius: 3),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PaytableRow extends StatelessWidget {
  const _PaytableRow({
    required this.symbol,
    required this.definition,
    required this.assetPath,
    required this.color,
  });

  final String symbol;
  final Map<String, dynamic> definition;
  final String? assetPath;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final payouts = definition['payouts'] as Map;
    String pay(int count) =>
        (payouts['$count'] ?? payouts[count] ?? '—').toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 5),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black26,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: .5)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 38,
            height: 38,
            child: assetPath == null
                ? Center(
                    child: Text(
                      const {'X': '10', 'Y': '9', 'Z': '8', 'T': '7'}[symbol] ??
                          symbol,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  )
                : Image.asset(assetPath!, fit: BoxFit.contain),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              definition['kind'] == 'scatter' ? 'SCATTER' : symbol,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          Text('3× ${pay(3)}   4× ${pay(4)}   5× ${pay(5)}'),
        ],
      ),
    );
  }
}

class _BonusExperience extends StatelessWidget {
  const _BonusExperience({
    required this.title,
    required this.eyebrow,
    required this.backgroundAsset,
    required this.primary,
    required this.secondary,
    required this.icon,
    required this.child,
    required this.footer,
  });

  final String title, eyebrow, backgroundAsset;
  final Color primary, secondary;
  final IconData icon;
  final Widget child, footer;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xff050009),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final desktop = constraints.maxWidth >= 800;
        return Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              backgroundAsset,
              fit: BoxFit.cover,
              color: const Color(0xaa11000c),
              colorBlendMode: BlendMode.multiply,
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  radius: .95,
                  colors: [
                    primary.withValues(alpha: .28),
                    secondary.withValues(alpha: .72),
                    const Color(0xf205000a),
                  ],
                  stops: const [0, .62, 1],
                ),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  desktop ? 28 : 12,
                  desktop ? 18 : 8,
                  desktop ? 28 : 12,
                  desktop ? 18 : 10,
                ),
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.symmetric(
                        horizontal: desktop ? 22 : 14,
                        vertical: desktop ? 13 : 9,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xdd130018),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: primary, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: primary.withValues(alpha: .45),
                            blurRadius: 24,
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: desktop ? 48 : 40,
                            height: desktop ? 48 : 40,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: [Colors.white, primary, secondary],
                              ),
                            ),
                            child: Icon(
                              icon,
                              color: const Color(0xff24022d),
                              size: desktop ? 28 : 23,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  eyebrow,
                                  style: TextStyle(
                                    color: primary,
                                    fontSize: desktop ? 11 : 9,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                                Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: const Color(0xfffff1a8),
                                    fontSize: desktop ? 28 : 20,
                                    fontWeight: FontWeight.w900,
                                    shadows: [
                                      Shadow(color: primary, blurRadius: 12),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          _PulseBadge(color: primary),
                        ],
                      ),
                    ),
                    SizedBox(height: desktop ? 14 : 8),
                    Expanded(child: child),
                    SizedBox(height: desktop ? 14 : 8),
                    SizedBox(
                      width: min(constraints.maxWidth, desktop ? 440 : 330),
                      height: desktop ? 58 : 52,
                      child: footer,
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class _PulseBadge extends StatelessWidget {
  const _PulseBadge({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: .2, end: 1),
    duration: const Duration(milliseconds: 850),
    curve: Curves.easeOutCubic,
    builder: (_, progress, _) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .16 + progress * .18),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: progress * .5),
            blurRadius: 14,
          ),
        ],
      ),
      child: const Text(
        'FEATURE ACTIVE',
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900),
      ),
    ),
  );
}

class _CoinCollectDialog extends StatelessWidget {
  const _CoinCollectDialog({
    required this.reward,
    required this.multiplier,
    required this.coins,
    required this.color,
    required this.secondary,
    required this.backgroundAsset,
  });

  final int reward, multiplier;
  final List<HoldAndWinSpotView> coins;
  final Color color, secondary;
  final String backgroundAsset;

  @override
  Widget build(BuildContext context) => _BonusExperience(
    title: 'COIN COLLECT',
    eyebrow: 'MULTIPLIER FEATURE',
    backgroundAsset: backgroundAsset,
    primary: color,
    secondary: secondary,
    icon: Icons.monetization_on_rounded,
    footer: FilledButton.icon(
      onPressed: () => Navigator.pop(context),
      icon: const Icon(Icons.savings_rounded),
      label: const Text('COINS EINSAMMELN'),
    ),
    child: Center(
      child: SingleChildScrollView(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 880),
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: const Color(0xdd160318),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: color, width: 2),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final coin in coins)
                    Container(
                      width: 72,
                      height: 72,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const RadialGradient(
                          colors: [Color(0xfffff4a8), Color(0xffffa000)],
                        ),
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: const [
                          BoxShadow(color: Color(0xaaff9800), blurRadius: 18),
                        ],
                      ),
                      child: Text(
                        '×${coin.multiplier}',
                        style: const TextStyle(
                          color: Color(0xff5b2500),
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                '${coins.length} COINS  •  TOTAL ×$multiplier',
                style: TextStyle(
                  color: color,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              TweenAnimationBuilder<int>(
                tween: IntTween(begin: 0, end: reward),
                duration: const Duration(milliseconds: 900),
                builder: (_, value, _) => Text(
                  _formatCoins(value),
                  style: const TextStyle(
                    fontSize: 38,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _JackpotDialog extends StatefulWidget {
  const _JackpotDialog({
    required this.reward,
    required this.tier,
    required this.color,
    required this.secondary,
    required this.backgroundAsset,
  });

  final int reward;
  final String tier;
  final Color color, secondary;
  final String backgroundAsset;

  @override
  State<_JackpotDialog> createState() => _JackpotDialogState();
}

class _JackpotDialogState extends State<_JackpotDialog> {
  bool revealed = false;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    timer = Timer(const Duration(milliseconds: 900), () {
      if (mounted) setState(() => revealed = true);
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _BonusExperience(
    title: '${widget.tier} JACKPOT',
    eyebrow: 'PROGRESSIVE FEATURE',
    backgroundAsset: widget.backgroundAsset,
    primary: widget.color,
    secondary: widget.secondary,
    icon: Icons.emoji_events_rounded,
    footer: FilledButton.icon(
      onPressed: revealed ? () => Navigator.pop(context) : null,
      icon: const Icon(Icons.savings),
      label: const Text('JACKPOT EINSAMMELN'),
    ),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedScale(
            scale: revealed ? 1 : .35,
            duration: const Duration(milliseconds: 700),
            curve: Curves.elasticOut,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Colors.white, widget.color, const Color(0xffff8a00)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: widget.color.withValues(alpha: .75),
                    blurRadius: 52,
                    spreadRadius: 8,
                  ),
                ],
              ),
              child: const Icon(
                Icons.emoji_events,
                color: Colors.white,
                size: 118,
              ),
            ),
          ),
          const SizedBox(height: 22),
          AnimatedOpacity(
            opacity: revealed ? 1 : 0,
            duration: const Duration(milliseconds: 350),
            child: Text(
              '${_formatCoins(widget.reward)} COINS',
              style: TextStyle(
                color: widget.color,
                fontSize: 36,
                fontWeight: FontWeight.w900,
                shadows: [Shadow(color: widget.color, blurRadius: 20)],
              ),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'SCATTER JACKPOT GEWONNEN',
            style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.4),
          ),
        ],
      ),
    ),
  );
}

class _TreasurePickDialog extends StatefulWidget {
  const _TreasurePickDialog({
    required this.reward,
    required this.multiplier,
    required this.picks,
    required this.boardSize,
    required this.primary,
    required this.secondary,
    required this.backgroundAsset,
  });

  final int reward, multiplier;
  final List<int> picks;
  final int boardSize;
  final Color primary, secondary;
  final String backgroundAsset;

  @override
  State<_TreasurePickDialog> createState() => _TreasurePickDialogState();
}

class _TreasurePickDialogState extends State<_TreasurePickDialog> {
  final Map<int, int> revealed = {};

  bool get complete => revealed.length >= widget.picks.length;

  void reveal(int position) {
    if (complete || revealed.containsKey(position)) return;
    setState(() => revealed[position] = widget.picks[revealed.length]);
  }

  @override
  Widget build(BuildContext context) => _BonusExperience(
    title: 'TREASURE PICK',
    eyebrow: 'PICK & WIN BONUS',
    backgroundAsset: widget.backgroundAsset,
    primary: widget.primary,
    secondary: widget.secondary,
    icon: Icons.diamond_rounded,
    footer: FilledButton.icon(
      onPressed: complete ? () => Navigator.pop(context) : null,
      icon: const Icon(Icons.inventory_2_rounded),
      label: Text(
        complete
            ? 'COINS EINSAMMELN'
            : '${widget.picks.length - revealed.length} PICKS OFFEN',
      ),
    ),
    child: Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 820),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xdd07182f),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: widget.primary, width: 2),
        ),
        child: Column(
          children: [
            Text(
              revealed.isEmpty
                  ? 'ÖFFNE ${widget.picks.length} SCHATZTRUHEN'
                  : !complete
                  ? '${widget.picks.length - revealed.length} PICKS VERBLEIBEN'
                  : '×${widget.multiplier}  •  ${_format(widget.reward)} COINS',
              style: TextStyle(
                color: widget.primary,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: GridView.count(
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: MediaQuery.sizeOf(context).width >= 800
                    ? 2.45
                    : 1,
                children: List.generate(widget.boardSize, (index) {
                  final value = revealed[index];
                  return GestureDetector(
                    onTap: value == null && !complete
                        ? () => reveal(index)
                        : null,
                    child: AnimatedScale(
                      duration: const Duration(milliseconds: 260),
                      curve: Curves.easeOutBack,
                      scale: value != null ? 1.08 : 1,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xcc051020),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: value == null
                                ? widget.secondary
                                : widget.primary,
                            width: value == null ? 2 : 3,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: widget.primary.withValues(
                                alpha: value == null ? .15 : .55,
                              ),
                              blurRadius: value == null ? 8 : 20,
                            ),
                          ],
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            ColorFiltered(
                              colorFilter: value != null
                                  ? const ColorFilter.mode(
                                      Colors.transparent,
                                      BlendMode.dst,
                                    )
                                  : const ColorFilter.mode(
                                      Color(0xff152b55),
                                      BlendMode.modulate,
                                    ),
                              child: Image.asset(
                                'assets/symbols/pirate/scatter.png',
                              ),
                            ),
                            if (value == null)
                              const Icon(
                                Icons.lock_rounded,
                                color: Color(0xffffd45c),
                                size: 34,
                              ),
                            if (value != null)
                              Text(
                                '×$value',
                                style: const TextStyle(
                                  color: Color(0xffffd45c),
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  shadows: [
                                    Shadow(color: Colors.black, blurRadius: 5),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  static String _format(int value) => value.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
}

class _WheelBonusDialog extends StatefulWidget {
  const _WheelBonusDialog({
    required this.reward,
    required this.multiplier,
    required this.segment,
    required this.color,
    required this.secondary,
    required this.backgroundAsset,
  });

  final int reward, multiplier, segment;
  final Color color, secondary;
  final String backgroundAsset;

  @override
  State<_WheelBonusDialog> createState() => _WheelBonusDialogState();
}

class _WheelBonusDialogState extends State<_WheelBonusDialog> {
  bool revealed = false;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    timer = Timer(const Duration(milliseconds: 1700), () {
      if (mounted) setState(() => revealed = true);
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _BonusExperience(
    title: 'TEMPLE WHEEL',
    eyebrow: 'WHEEL BONUS',
    backgroundAsset: widget.backgroundAsset,
    primary: widget.color,
    secondary: widget.secondary,
    icon: Icons.casino_rounded,
    footer: FilledButton.icon(
      onPressed: revealed ? () => Navigator.pop(context) : null,
      icon: const Icon(Icons.savings_rounded),
      label: Text(revealed ? 'GEWINN EINSAMMELN' : 'RAD DREHT …'),
    ),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              AnimatedRotation(
                turns: revealed ? 3 + widget.segment / 8 : 0,
                duration: const Duration(milliseconds: 1500),
                curve: Curves.easeOutQuart,
                child: Image.asset(
                  'assets/ui/aurora_temple_wheel.png',
                  width: 330,
                  height: 330,
                ),
              ),
              Positioned(
                top: 0,
                child: Icon(
                  Icons.arrow_drop_down_rounded,
                  size: 58,
                  color: widget.color,
                  shadows: const [Shadow(color: Colors.black, blurRadius: 7)],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: Text(
              revealed
                  ? '×${widget.multiplier}  •  ${_formatCoins(widget.reward)} COINS'
                  : 'DAS RAD DREHT SICH …',
              key: ValueKey(revealed),
              style: TextStyle(
                color: widget.color,
                fontSize: 24,
                fontWeight: FontWeight.w900,
                shadows: [Shadow(color: widget.color, blurRadius: 16)],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _HoldAndWinDialog extends StatefulWidget {
  const _HoldAndWinDialog({
    required this.reward,
    required this.multiplier,
    required this.spots,
    required this.boardSize,
    required this.initialSpots,
    required this.steps,
    required this.primary,
    required this.secondary,
    required this.backgroundAsset,
  });

  final int reward, multiplier, spots, boardSize;
  final List<HoldAndWinSpotView> initialSpots;
  final List<HoldAndWinStepView> steps;
  final Color primary, secondary;
  final String backgroundAsset;

  @override
  State<_HoldAndWinDialog> createState() => _HoldAndWinDialogState();
}

class _HoldAndWinDialogState extends State<_HoldAndWinDialog> {
  final revealed = <int, int>{};
  int lives = 3;
  int step = 0;
  bool complete = false;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    for (final spot in widget.initialSpots) {
      revealed[spot.position] = spot.multiplier;
    }
    if (widget.steps.isEmpty) {
      for (var index = 0; index < widget.spots; index++) {
        revealed[index] = max(1, widget.multiplier ~/ widget.spots);
      }
      complete = true;
      return;
    }
    timer = Timer.periodic(const Duration(milliseconds: 620), (value) {
      if (!mounted) return;
      if (step >= widget.steps.length) {
        setState(() => complete = true);
        value.cancel();
        return;
      }
      final update = widget.steps[step++];
      setState(() {
        lives = update.lives;
        for (final spot in update.spots) {
          revealed[spot.position] = spot.multiplier;
        }
        complete = step >= widget.steps.length;
      });
      if (complete) value.cancel();
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final columns = widget.boardSize % 5 == 0 ? 5 : 3;
    return _BonusExperience(
      title: 'HOLD & WIN',
      eyebrow: 'LOCK & RESPIN FEATURE',
      backgroundAsset: widget.backgroundAsset,
      primary: widget.primary,
      secondary: widget.secondary,
      icon: Icons.lock_clock_rounded,
      footer: FilledButton.icon(
        onPressed: complete ? () => Navigator.pop(context) : null,
        icon: const Icon(Icons.savings_rounded),
        label: Text(
          complete ? 'COINS EINSAMMELN' : '$lives RESPINS VERBLEIBEN',
        ),
      ),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 760),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xdd210309),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: widget.primary, width: 2),
            boxShadow: [
              BoxShadow(
                color: widget.primary.withValues(alpha: .3),
                blurRadius: 24,
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'RESPINS  ',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  for (var index = 0; index < 3; index++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: AnimatedScale(
                        duration: const Duration(milliseconds: 260),
                        scale: index < lives ? 1 : .72,
                        child: Icon(
                          Icons.bolt_rounded,
                          size: 29,
                          color: index < lives
                              ? widget.primary
                              : const Color(0xff5c3d31),
                          shadows: index < lives
                              ? [Shadow(color: widget.primary, blurRadius: 12)]
                              : null,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Expanded(
                child: GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                  ),
                  itemCount: widget.boardSize,
                  itemBuilder: (_, index) => AnimatedScale(
                    key: ValueKey('hold-$index-${revealed[index]}'),
                    duration: const Duration(milliseconds: 420),
                    curve: Curves.elasticOut,
                    scale: revealed.containsKey(index) ? 1 : .78,
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xdd090107),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: revealed[index] == null
                              ? const Color(0xff70511c)
                              : widget.primary,
                          width: revealed[index] == null ? 1 : 3,
                        ),
                        boxShadow: revealed[index] == null
                            ? null
                            : [
                                BoxShadow(
                                  color: widget.primary.withValues(alpha: .55),
                                  blurRadius: 18,
                                ),
                              ],
                      ),
                      child: revealed[index] != null
                          ? Stack(
                              fit: StackFit.expand,
                              alignment: Alignment.center,
                              children: [
                                Image.asset('assets/symbols/vegas/scatter.png'),
                                Center(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 7,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.black87,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: widget.primary),
                                    ),
                                    child: Text(
                                      '×${revealed[index]}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : const Icon(
                              Icons.lock_outline_rounded,
                              color: Color(0xff70511c),
                              size: 32,
                            ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                complete
                    ? '×${widget.multiplier}  •  ${_formatCoins(widget.reward)} COINS'
                    : '${revealed.length} / ${widget.spots} GOLD COINS LOCKED',
                style: TextStyle(
                  color: widget.primary,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _formatCoins(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);
