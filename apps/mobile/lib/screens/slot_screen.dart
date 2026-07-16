import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
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
  });
  final GameDefinition game;
  final int balance, level, xp, vipPoints, gems;
  @override
  State<SlotScreen> createState() => _SlotScreenState();
}

class _SlotScreenState extends State<SlotScreen> {
  final api = CasinoApi(), random = Random();
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
  String? error, featureMode;
  String? winDetail;
  Set<String> winningCells = {};
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
    balance = widget.balance;
    level = widget.level;
    xp = widget.xp;
    vipPoints = widget.vipPoints;
    _loadJackpots();
    _loadPaytableMetadata();
    unawaited(
      api.trackEvent('screen.viewed', screen: 'slot', slotId: widget.game.id),
    );
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

  Future<SpinResponse?> spin({bool bonusBuy = false}) async {
    final wager = bet * (bonusBuy ? widget.game.bonusBuyMultiplier ?? 1 : 1);
    if (spinning || balance < wager) {
      if (balance < wager) {
        setState(() => error = 'Nicht genug Coins für diesen Einsatz.');
      }
      return null;
    }
    setState(() {
      spinning = true;
      win = 0;
      free = 0;
      error = null;
      featureMode = bonusBuy ? 'BONUS BUY' : 'GOOD LUCK';
      winDetail = null;
      winningCells = {};
    });
    final request = api.spin(widget.game.id, bet, bonusBuy: bonusBuy);
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
      final r = await request;
      if (!mounted) return null;
      final freeRounds = r.rounds
          .where((round) => round.phase == 'free_spin')
          .length;
      var displayedWin = 0;
      for (final round in r.rounds) {
        if (!mounted) return null;
        if (round.phase == 'bonus') {
          await _showBonus(round);
        } else {
          displayedWin += round.win;
          setState(() {
            grid = round.grid;
            win = displayedWin;
            winningCells = round.winningCells;
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
          if (r.rounds.length > 1) {
            await Future<void>.delayed(
              Duration(milliseconds: turbo ? 120 : 520),
            );
          }
        }
      }
      if (!mounted) return null;
      setState(() {
        grid = r.rounds.lastWhere((round) => round.phase != 'bonus').grid;
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
      unawaited(
        api.trackEvent(
          'slot.presentation_completed',
          screen: 'slot',
          slotId: widget.game.id,
        ),
      );
      return r;
    } catch (e) {
      if (mounted) {
        setState(() => error = 'Verbindung verloren – noch einmal tippen.');
      }
      return null;
    } finally {
      if (mounted) setState(() => spinning = false);
    }
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
                    '${paytable.evaluationType == 'ways' ? '${paytable.ways ?? ''} WAYS' : '${paytable.lines} GEWINNLINIEN'}  •  RTP-ZIEL ${(paytable.targetRtp * 100).toStringAsFixed(1)}%  •  ${paytable.volatility.toUpperCase()}',
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
      ),
      'hold_and_win' => _HoldAndWinDialog(
        reward: round.win,
        multiplier: round.bonusMultiplier ?? 1,
        spots: round.bonusSpots ?? 6,
        boardSize: round.bonusBoardSize ?? 15,
        initialSpots: round.bonusInitialSpots,
        steps: round.bonusRespinSteps,
      ),
      'jackpot' => _JackpotDialog(
        reward: round.win,
        tier: round.bonusTier ?? 'MINI',
        color: widget.game.primary,
      ),
      _ => _TreasurePickDialog(
        reward: round.win,
        multiplier: round.bonusMultiplier ?? 1,
      ),
    };
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => dialog,
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
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Column(
            children: [
              TopHud(balance: balance, level: level, xp: xp, gems: widget.gems),
              Expanded(
                child: Stack(
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
                    SafeArea(
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
                          _jackpots(),
                          if (featureMode != null)
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 220),
                              child: Container(
                                key: ValueKey(featureMode),
                                margin: const EdgeInsets.only(top: 8),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 18,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: widget.game.secondary.withValues(
                                    alpha: .92,
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: widget.game.primary,
                                    width: 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: widget.game.primary.withValues(
                                        alpha: .5,
                                      ),
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
                          const Spacer(),
                          _reels(),
                          const SizedBox(height: 10),
                          if (win > 0)
                            Text(
                              'WIN  ${_fmt(win)}',
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                color: widget.game.primary,
                              ),
                            ),
                          if (winDetail != null)
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
                              style: const TextStyle(color: Colors.redAccent),
                            ),
                          const Spacer(),
                          _controls(),
                          const SizedBox(height: 18),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  Widget _jackpots() => Row(
    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
    children: [
      for (final p in [
        ('GRAND', _fmt(jackpotPools['GRAND'] ?? 50000000)),
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
  Widget _reels() => AnimatedContainer(
    duration: const Duration(milliseconds: 250),
    height: 300,
    margin: const EdgeInsets.symmetric(horizontal: 10),
    padding: const EdgeInsets.all(8),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [
          widget.game.primary,
          const Color(0xffffe29a),
          widget.game.primary,
        ],
      ),
      borderRadius: BorderRadius.circular(18),
      boxShadow: [
        BoxShadow(
          color: widget.game.primary.withValues(alpha: win > 0 ? .9 : .55),
          blurRadius: win > 0 ? 38 : 24,
          spreadRadius: win > 0 ? 4 : 0,
        ),
      ],
    ),
    child: Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0xff13082d),
        borderRadius: BorderRadius.circular(11),
      ),
      child: Row(
        children: [
          for (var reel = 0; reel < grid.length; reel++)
            Expanded(
              child: Column(
                children: [
                  for (var row = 0; row < grid[reel].length; row++)
                    Expanded(child: _symbol(grid[reel][row], reel, row)),
                ],
              ),
            ),
        ],
      ),
    ),
  );
  Widget _symbol(String symbol, int reel, int row) {
    final paths = _symbolPaths[widget.game.symbolSet]!;
    final assetPath = paths[symbol];
    final key = ValueKey(
      '$symbol-$reel-$row-${spinning ? random.nextInt(999) : 0}',
    );
    final winning = winningCells.contains('$reel:$row');
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 140),
      transitionBuilder: (child, animation) => SlideTransition(
        position: Tween(begin: const Offset(0, -.55), end: Offset.zero).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        ),
        child: FadeTransition(opacity: animation, child: child),
      ),
      child: Container(
        key: key,
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
            if (assetPath != null)
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
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
      ),
    );
  }

  Widget _controls() => Column(
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
                : () =>
                      setState(() => bet = betSteps[betSteps.indexOf(bet) - 1]),
            icon: const Icon(Icons.remove),
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
                  style: const TextStyle(fontWeight: FontWeight.w900),
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
                : () =>
                      setState(() => bet = betSteps[betSteps.indexOf(bet) + 1]),
            icon: const Icon(Icons.add),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 125,
            height: 60,
            child: FilledButton(
              onPressed: autoplay
                  ? _stopAutoplay
                  : spinning
                  ? null
                  : () => spin(),
              style: FilledButton.styleFrom(
                backgroundColor: widget.game.primary,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
              child: spinning && !autoplay
                  ? const CircularProgressIndicator()
                  : Text(
                      autoplay ? 'STOP $autoSpinsRemaining' : 'SPIN',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
            ),
          ),
        ],
      ),
    ],
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

class _JackpotDialog extends StatefulWidget {
  const _JackpotDialog({
    required this.reward,
    required this.tier,
    required this.color,
  });

  final int reward;
  final String tier;
  final Color color;

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
  Widget build(BuildContext context) => AlertDialog(
    backgroundColor: const Color(0xff160622),
    title: Text(
      '${widget.tier} JACKPOT',
      textAlign: TextAlign.center,
      style: TextStyle(
        color: widget.color,
        fontSize: 27,
        fontWeight: FontWeight.w900,
      ),
    ),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedScale(
          scale: revealed ? 1 : .35,
          duration: const Duration(milliseconds: 700),
          curve: Curves.elasticOut,
          child: Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [widget.color, const Color(0xffff8a00)],
              ),
              boxShadow: [
                BoxShadow(
                  color: widget.color.withValues(alpha: .7),
                  blurRadius: 32,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: const Icon(
              Icons.emoji_events,
              color: Colors.white,
              size: 82,
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
              fontSize: 25,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Text('SCATTER JACKPOT GEWONNEN'),
      ],
    ),
    actionsAlignment: MainAxisAlignment.center,
    actions: [
      FilledButton.icon(
        onPressed: revealed ? () => Navigator.pop(context) : null,
        icon: const Icon(Icons.savings),
        label: const Text('JACKPOT EINSAMMELN'),
      ),
    ],
  );
}

class _TreasurePickDialog extends StatefulWidget {
  const _TreasurePickDialog({required this.reward, required this.multiplier});

  final int reward, multiplier;

  @override
  State<_TreasurePickDialog> createState() => _TreasurePickDialogState();
}

class _TreasurePickDialogState extends State<_TreasurePickDialog> {
  int? selected;

  @override
  Widget build(BuildContext context) => AlertDialog(
    backgroundColor: const Color(0xff052f62),
    title: const Text(
      'TREASURE PICK BONUS',
      textAlign: TextAlign.center,
      style: TextStyle(color: Color(0xffffd45c), fontWeight: FontWeight.w900),
    ),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          selected == null
              ? 'Wähle eine Schatztruhe'
              : 'x${widget.multiplier}  •  ${_format(widget.reward)} COINS',
        ),
        const SizedBox(height: 14),
        Row(
          children: List.generate(3, (index) {
            final revealed = selected == index;
            return Expanded(
              child: GestureDetector(
                onTap: selected == null
                    ? () => setState(() => selected = index)
                    : null,
                child: AnimatedScale(
                  duration: const Duration(milliseconds: 260),
                  scale: revealed ? 1.12 : 1,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      ColorFiltered(
                        colorFilter: revealed
                            ? const ColorFilter.mode(
                                Colors.transparent,
                                BlendMode.dst,
                              )
                            : const ColorFilter.mode(
                                Color(0xff152b55),
                                BlendMode.modulate,
                              ),
                        child: Image.asset('assets/symbols/pirate/scatter.png'),
                      ),
                      if (!revealed)
                        const Icon(
                          Icons.lock,
                          color: Color(0xffffd45c),
                          size: 28,
                        ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ],
    ),
    actionsAlignment: MainAxisAlignment.center,
    actions: [
      FilledButton(
        onPressed: selected == null ? null : () => Navigator.pop(context),
        child: const Text('COINS EINSAMMELN'),
      ),
    ],
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
  });

  final int reward, multiplier, segment;
  final Color color;

  @override
  State<_WheelBonusDialog> createState() => _WheelBonusDialogState();
}

class _WheelBonusDialogState extends State<_WheelBonusDialog> {
  bool revealed = false;

  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 1700), () {
      if (mounted) setState(() => revealed = true);
    });
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    backgroundColor: const Color(0xff082f28),
    title: const Text(
      'TEMPLE WHEEL BONUS',
      textAlign: TextAlign.center,
      style: TextStyle(color: Color(0xffffd45c), fontWeight: FontWeight.w900),
    ),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedRotation(
          turns: revealed ? 2 + widget.segment / 8 : 0,
          duration: const Duration(milliseconds: 1500),
          curve: Curves.easeOutQuart,
          child: Image.asset(
            'assets/symbols/jungle/scatter.png',
            width: 210,
            height: 210,
          ),
        ),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 260),
          child: Text(
            revealed
                ? 'x${widget.multiplier}  •  ${_formatCoins(widget.reward)} COINS'
                : 'DAS RAD DREHT SICH …',
            key: ValueKey(revealed),
            style: TextStyle(
              color: widget.color,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    ),
    actionsAlignment: MainAxisAlignment.center,
    actions: [
      FilledButton(
        onPressed: revealed ? () => Navigator.pop(context) : null,
        child: const Text('GEWINN EINSAMMELN'),
      ),
    ],
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
  });

  final int reward, multiplier, spots, boardSize;
  final List<HoldAndWinSpotView> initialSpots;
  final List<HoldAndWinStepView> steps;

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
    return AlertDialog(
      backgroundColor: const Color(0xff250409),
      title: const Text(
        'HOLD & WIN BONUS',
        textAlign: TextAlign.center,
        style: TextStyle(color: Color(0xffffd45c), fontWeight: FontWeight.w900),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('RESPINS  '),
              for (var index = 0; index < 3; index++)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Icon(
                    Icons.bolt,
                    size: 22,
                    color: index < lives
                        ? const Color(0xffffd45c)
                        : const Color(0xff5c3d31),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: 270,
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                mainAxisSpacing: 4,
                crossAxisSpacing: 4,
              ),
              itemCount: widget.boardSize,
              itemBuilder: (_, index) => AnimatedScale(
                key: ValueKey('hold-$index-${revealed[index]}'),
                duration: const Duration(milliseconds: 420),
                curve: Curves.elasticOut,
                scale: revealed.containsKey(index) ? 1 : .72,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xffffc52f)),
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
                                  horizontal: 4,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black87,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '×${revealed[index]}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        )
                      : const Icon(
                          Icons.lock_outline,
                          color: Color(0xff70511c),
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            complete
                ? 'x${widget.multiplier}  •  ${_formatCoins(widget.reward)} COINS'
                : '${revealed.length} / ${widget.spots} GOLD COINS LOCKED',
            style: const TextStyle(
              color: Color(0xffffd45c),
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        FilledButton(
          onPressed: complete ? () => Navigator.pop(context) : null,
          child: const Text('COINS EINSAMMELN'),
        ),
      ],
    );
  }
}

String _formatCoins(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);
