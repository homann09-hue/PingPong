import 'dart:async';

import 'package:flutter/material.dart';

import '../services/casino_api.dart';

typedef RewardClaimCallback = Future<void> Function(String rewardId);
typedef ShopPurchaseCallback = Future<void> Function(ShopOfferView offer);

class QuestsScreen extends StatelessWidget {
  const QuestsScreen({
    super.key,
    required this.spins,
    required this.totalWon,
    required this.freeSpins,
    required this.claimed,
    required this.onClaim,
    required this.achievements,
    required this.missions,
    required this.onMissionClaim,
  });

  final int spins, totalWon, freeSpins;
  final Set<String> claimed;
  final RewardClaimCallback onClaim;
  final List<AchievementView> achievements;
  final List<MissionView> missions;
  final RewardClaimCallback onMissionClaim;

  @override
  Widget build(BuildContext context) => MetaPage(
    title: 'MISSION CONTROL',
    subtitle: 'Tägliche und wöchentliche Ziele mit steigenden Belohnungen.',
    icon: Icons.task_alt,
    child: Column(
      children: [
        _MissionSection(
          title: 'HEUTE',
          subtitle: 'Neue Ziele jeden Tag um 00:00 UTC',
          missions: missions
              .where((mission) => mission.cadence == 'daily')
              .toList(),
          onClaim: onMissionClaim,
        ),
        const SizedBox(height: 14),
        _MissionSection(
          title: 'DIESE WOCHE',
          subtitle: 'Wochenlauf beginnt montags',
          missions: missions
              .where((mission) => mission.cadence == 'weekly')
              .toList(),
          onClaim: onMissionClaim,
        ),
        const SizedBox(height: 10),
        const Text('ACHIEVEMENTS', style: MetaStyle.hero),
        const SizedBox(height: 12),
        for (final achievement in achievements)
          QuestCard(
            title: achievement.name,
            description: achievement.description,
            reward: _coins(achievement.coins),
            progress: achievement.progress,
            target: achievement.target,
            rewardId: achievement.rewardId,
            claimed: achievement.claimed,
            onClaim: onClaim,
            color: const Color(0xffa75bff),
          ),
      ],
    ),
  );

  static String _coins(int value) => value.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
}

class _MissionSection extends StatelessWidget {
  const _MissionSection({
    required this.title,
    required this.subtitle,
    required this.missions,
    required this.onClaim,
  });

  final String title, subtitle;
  final List<MissionView> missions;
  final RewardClaimCallback onClaim;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: MetaStyle.hero),
                Text(subtitle, style: MetaStyle.caption),
              ],
            ),
          ),
          Text(
            '${missions.where((mission) => mission.completed).length}/${missions.length}',
            style: MetaStyle.reward,
          ),
        ],
      ),
      const SizedBox(height: 12),
      if (missions.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: MetaStyle.card(const Color(0xff6b2bd9)),
          child: const Row(
            children: [
              Icon(Icons.sync_rounded, color: Color(0xffa75bff)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Missionen werden synchronisiert',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        )
      else
        for (final mission in missions)
          QuestCard(
            title: _title(mission),
            description: _description(mission),
            reward: QuestsScreen._coins(mission.rewardCoins),
            progress: mission.progress,
            target: mission.target,
            rewardId: mission.id,
            claimed: mission.claimed,
            onClaim: onClaim,
            color: _color(mission.tier),
            tier: mission.tier.toUpperCase(),
          ),
    ],
  );

  static String _title(MissionView mission) => switch (mission.id) {
    'daily-spins-10' => 'LUCKY TEN',
    'daily-wager-10000' => 'HIGH ROLLER',
    'daily-win-50000' => 'BIG WIN HUNTER',
    'daily-free-spins-3' => 'FREE SPIN MASTER',
    'weekly-spins-100' => 'CENTURY SPINNER',
    'weekly-wager-250000' => 'FORTUNE MAKER',
    'weekly-free-spins-25' => 'BONUS LEGEND',
    _ => mission.translationKey.toUpperCase(),
  };

  static String _description(MissionView mission) => switch (mission.metric) {
    'spin_count' => 'Drehe die Walzen ${mission.target}-mal',
    'wager_total' =>
      'Setze insgesamt ${QuestsScreen._coins(mission.target)} Coins',
    'win_total' =>
      'Gewinne insgesamt ${QuestsScreen._coins(mission.target)} Coins',
    'free_spin_count' => 'Spiele ${mission.target} Freispiele',
    _ => 'Erreiche das Missionsziel',
  };

  static Color _color(String tier) => switch (tier) {
    'pro' => const Color(0xff42e3ff),
    'super' => const Color(0xffff4fc3),
    'crazy' => const Color(0xffff6b35),
    _ => const Color(0xffffc52f),
  };
}

class QuestCard extends StatelessWidget {
  const QuestCard({
    super.key,
    required this.title,
    required this.description,
    required this.reward,
    required this.progress,
    required this.target,
    required this.rewardId,
    required this.claimed,
    required this.onClaim,
    required this.color,
    this.tier,
  });

  final String title, description, reward, rewardId;
  final int progress, target;
  final bool claimed;
  final RewardClaimCallback onClaim;
  final Color color;
  final String? tier;

  @override
  Widget build(BuildContext context) {
    final complete = progress >= target;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: MetaStyle.card(color),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: color.withValues(alpha: .18),
                child: Icon(
                  complete ? Icons.stars_rounded : Icons.bolt_rounded,
                  color: color,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(title, style: MetaStyle.title)),
                        if (tier != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: .2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              tier!,
                              style: TextStyle(
                                color: color,
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                      ],
                    ),
                    Text(description, style: MetaStyle.caption),
                  ],
                ),
              ),
              Column(
                children: [
                  Icon(Icons.monetization_on, color: color, size: 20),
                  Text(reward, style: MetaStyle.reward),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: LinearProgressIndicator(
                    value: (progress / target).clamp(0, 1),
                    minHeight: 12,
                    backgroundColor: Colors.black45,
                    color: color,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text('${progress.clamp(0, target)} / $target'),
              const SizedBox(width: 10),
              FilledButton(
                onPressed: complete && !claimed
                    ? () => onClaim(rewardId)
                    : null,
                style: FilledButton.styleFrom(
                  backgroundColor: color,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                child: Text(claimed ? 'CLAIMED' : 'CLAIM'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class RewardCenterSheet extends StatefulWidget {
  const RewardCenterSheet({
    super.key,
    required this.api,
    this.hourly,
    this.daily,
    this.wheel,
  });
  final CasinoApi api;
  final TimedRewardView? hourly, daily;
  final WheelView? wheel;

  @override
  State<RewardCenterSheet> createState() => _RewardCenterSheetState();
}

class _RewardCenterSheetState extends State<RewardCenterSheet> {
  TimedRewardView? hourly, daily;
  WheelView? wheel;
  Timer? timer;
  bool busy = false;
  double turns = 0;
  String? result;
  int? latestBalance;

  @override
  void initState() {
    super.initState();
    hourly = widget.hourly;
    daily = widget.daily;
    wheel = widget.wheel;
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    _refresh();
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final values = await Future.wait([
        widget.api.timedReward('hourly'),
        widget.api.timedReward('daily'),
      ]);
      final loadedWheel = await widget.api.wheel();
      if (!mounted) return;
      setState(() {
        hourly = values[0];
        daily = values[1];
        wheel = loadedWheel;
      });
    } on StateError {
      /* Existing values keep the sheet usable offline. */
    }
  }

  Future<void> _claim(String type) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final claim = await widget.api.claimTimedReward(type);
      latestBalance = claim.balance;
      if (!mounted) return;
      setState(
        () => result =
            '+${QuestsScreen._coins(claim.coins)} COINS${claim.wheelUnlocked ? ' • RAD FREIGESCHALTET' : ''}',
      );
      await _refresh();
    } on RewardClaimException {
      await _refresh();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _spin() async {
    if (busy || (wheel?.availableSpins ?? 0) < 1) return;
    setState(() {
      busy = true;
      result = null;
      turns += 5;
    });
    try {
      final spin = await widget.api.spinWheel();
      latestBalance = spin.currency == 'coin'
          ? spin.balanceAfter
          : latestBalance;
      if (!mounted) return;
      setState(() {
        turns += .7;
        result =
            '${spin.currency == 'coin' ? 'COINS' : 'GEMS'} +${QuestsScreen._coins(spin.amount)}';
      });
      await _refresh();
    } on RewardClaimException {
      await _refresh();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(context).height * .9,
    ),
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        colors: [Color(0xff4b167b), Color(0xff071a37)],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ),
      borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      border: Border(top: BorderSide(color: Color(0xffffd45c), width: 2)),
    ),
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
      child: Column(
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('REWARD CENTER', style: MetaStyle.hero),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context, latestBalance),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const Text(
            'Serverzeit • sichere Streaks • garantierte Auszahlungen',
            style: MetaStyle.caption,
          ),
          const SizedBox(height: 18),
          _RewardTile(
            icon: Icons.bolt_rounded,
            title: 'HOURLY BONUS',
            status: hourly,
            remaining: hourly == null ? 'WIRD GELADEN' : _remaining(hourly!),
            subtitle: '${hourly?.claimsTowardWheel ?? 0}/4 BIS ZUM BONUS-RAD',
            color: const Color(0xff42e3ff),
            busy: busy,
            onClaim: () => _claim('hourly'),
          ),
          _RewardTile(
            icon: Icons.calendar_month_rounded,
            title: 'DAILY STREAK',
            status: daily,
            remaining: daily == null ? 'WIRD GELADEN' : _remaining(daily!),
            subtitle:
                'TAG ${daily?.cyclePosition ?? 0}/7 • STREAK ${daily?.streak ?? 0}',
            color: const Color(0xffffd45c),
            busy: busy,
            onClaim: () => _claim('daily'),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: MetaStyle.card(const Color(0xffff4fc3)),
            child: Column(
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('FORTUNE WHEEL', style: MetaStyle.title),
                    ),
                    Text(
                      '${wheel?.availableSpins ?? 0} SPINS',
                      style: MetaStyle.reward,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                AnimatedRotation(
                  turns: turns,
                  duration: const Duration(milliseconds: 1200),
                  curve: Curves.easeOutCubic,
                  child: Container(
                    width: 150,
                    height: 150,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const SweepGradient(
                        colors: [
                          Color(0xffffd45c),
                          Color(0xffff4fc3),
                          Color(0xff42e3ff),
                          Color(0xffa75bff),
                          Color(0xffffd45c),
                        ],
                      ),
                      border: Border.all(color: Colors.white, width: 4),
                      boxShadow: const [
                        BoxShadow(color: Colors.black54, blurRadius: 12),
                      ],
                    ),
                    child: const Icon(
                      Icons.casino_rounded,
                      size: 54,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  alignment: WrapAlignment.center,
                  children: [
                    for (final segment
                        in wheel?.segments ?? const <WheelSegmentView>[])
                      Chip(
                        label: Text(
                          '${segment.currency == 'coin' ? 'C' : 'G'} ${QuestsScreen._coins(segment.amount)}',
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: busy || (wheel?.availableSpins ?? 0) < 1
                      ? null
                      : _spin,
                  icon: const Icon(Icons.rotate_right_rounded),
                  label: const Text('RAD DREHEN'),
                ),
              ],
            ),
          ),
          if (result != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(
                result!,
                textAlign: TextAlign.center,
                style: MetaStyle.hero,
              ),
            ),
        ],
      ),
    ),
  );

  String _remaining(TimedRewardView status) {
    if (status.claimable) return 'JETZT VERFÜGBAR';
    final difference = status.availableAt.difference(DateTime.now().toUtc());
    if (difference.isNegative) return 'JETZT VERFÜGBAR';
    final hours = difference.inHours;
    final minutes = difference.inMinutes
        .remainder(60)
        .toString()
        .padLeft(2, '0');
    final seconds = difference.inSeconds
        .remainder(60)
        .toString()
        .padLeft(2, '0');
    return '${hours.toString().padLeft(2, '0')}:$minutes:$seconds';
  }
}

class _RewardTile extends StatelessWidget {
  const _RewardTile({
    required this.icon,
    required this.title,
    required this.status,
    required this.remaining,
    required this.subtitle,
    required this.color,
    required this.busy,
    required this.onClaim,
  });
  final IconData icon;
  final String title, subtitle, remaining;
  final TimedRewardView? status;
  final Color color;
  final bool busy;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final claimable =
        status?.claimable == true ||
        (status != null &&
            status!.availableAt.isBefore(DateTime.now().toUtc()));
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: MetaStyle.card(color),
      child: Row(
        children: [
          CircleAvatar(
            radius: 25,
            backgroundColor: color.withValues(alpha: .2),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: MetaStyle.title),
                Text(subtitle, style: MetaStyle.caption),
                Text(
                  remaining,
                  style: TextStyle(color: color, fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
          Column(
            children: [
              Text(
                status == null ? '—' : QuestsScreen._coins(status!.nextCoins),
                style: MetaStyle.reward,
              ),
              FilledButton(
                onPressed: claimable && !busy ? onClaim : null,
                child: const Text('CLAIM'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ClubScreen extends StatefulWidget {
  const ClubScreen({super.key});

  @override
  State<ClubScreen> createState() => _ClubScreenState();
}

class _ClubScreenState extends State<ClubScreen> {
  bool joined = false;

  @override
  Widget build(BuildContext context) => MetaPage(
    title: 'FORTUNE CLUB',
    subtitle: joined
        ? 'Gemeinsam sammelt ihr Punkte für die Wochenliga.'
        : 'Tritt einem aktiven Club bei und schalte Team-Belohnungen frei.',
    icon: Icons.groups_rounded,
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: MetaStyle.card(const Color(0xffa75bff)),
          child: Column(
            children: [
              const Icon(
                Icons.shield_rounded,
                size: 76,
                color: Color(0xffffd45c),
              ),
              Text(
                joined ? 'AURORA LEGENDS' : 'FINDE DEINEN CLUB',
                style: MetaStyle.hero,
              ),
              const SizedBox(height: 8),
              Text(
                joined
                    ? 'Rang 18  •  42 / 50 Mitglieder'
                    : '50 Spieler • wöchentliche Club-Missionen',
                style: MetaStyle.caption,
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: joined ? null : () => setState(() => joined = true),
                icon: Icon(joined ? Icons.check : Icons.group_add),
                label: Text(joined ? 'BEIGETRETEN' : 'JETZT BEITRETEN'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const _RankingRow(rank: 1, name: 'Royal Spinners', score: '8.4B'),
        const _RankingRow(rank: 2, name: 'Lucky Dragons', score: '7.9B'),
        const _RankingRow(rank: 3, name: 'Aurora Legends', score: '7.2B'),
      ],
    ),
  );
}

typedef EventClaimCallback =
    Future<void> Function(String eventId, String milestoneId);

class EventsScreen extends StatelessWidget {
  const EventsScreen({
    super.key,
    required this.events,
    required this.rewardBusy,
    required this.onClaim,
    required this.tournamentRank,
    required this.tournamentScore,
    required this.leaders,
    this.tournamentName = 'WORLD FORTUNE CHAMPIONSHIP',
    this.tournamentEndsAt,
    this.tournamentPrizePool = 25000000,
    this.tournamentEntrants = 1,
  });

  final List<LiveEventView> events;
  final bool rewardBusy;
  final EventClaimCallback onClaim;
  final int tournamentRank, tournamentScore;
  final String tournamentName;
  final DateTime? tournamentEndsAt;
  final int tournamentPrizePool, tournamentEntrants;
  final List<Map<String, dynamic>> leaders;

  @override
  Widget build(BuildContext context) => MetaPage(
    title: 'LIVE EVENTS',
    subtitle: 'Zeitlich begrenzte Wettbewerbe mit großen Coin-Preisen.',
    icon: Icons.emoji_events_rounded,
    child: Column(
      children: [
        if (events.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: MetaStyle.card(const Color(0xff42e3ff)),
            child: const Text('EVENTS WERDEN GELADEN', style: MetaStyle.title),
          )
        else
          for (final event in events)
            _EventCard(event: event, busy: rewardBusy, onClaim: onClaim),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: MetaStyle.card(const Color(0xffffd45c)),
          child: Column(
            children: [
              Text(
                tournamentName,
                style: MetaStyle.title,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                '${_remaining(tournamentEndsAt)}  •  PREISPOOL ${_compact(tournamentPrizePool)}',
                style: MetaStyle.reward,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'BET-NORMALISIERTE PUNKTE  •  $tournamentEntrants SPIELER',
                style: MetaStyle.caption,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text('LIVE LEADERBOARD', style: MetaStyle.hero),
        const SizedBox(height: 12),
        for (var index = 0; index < leaders.length; index++)
          _RankingRow(
            rank: index + 1,
            name: leaders[index]['name'] as String,
            score: _compact(leaders[index]['score'] as int),
          ),
        _RankingRow(
          rank: tournamentRank,
          name: 'YOU',
          score: _compact(tournamentScore),
        ),
      ],
    ),
  );

  static String _compact(int value) => value >= 1000000
      ? '${(value / 1000000).toStringAsFixed(2)}M'
      : value.toString();

  static String _remaining(DateTime? endsAt) {
    if (endsAt == null) return 'LIVE';
    final remaining = endsAt.toUtc().difference(DateTime.now().toUtc());
    if (remaining.isNegative) return 'BEENDET';
    return '${remaining.inDays}T ${remaining.inHours.remainder(24)}H';
  }
}

class VipSheet extends StatelessWidget {
  const VipSheet({
    super.key,
    required this.tier,
    required this.points,
    required this.tierStart,
    required this.nextTier,
  });

  final String tier;
  final int points, tierStart, nextTier;

  @override
  Widget build(BuildContext context) {
    final progress = ((points - tierStart) / (nextTier - tierStart)).clamp(
      0.0,
      1.0,
    );
    return Container(
      margin: const EdgeInsets.only(top: 110),
      padding: const EdgeInsets.fromLTRB(22, 16, 22, 34),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xff5d218d), Color(0xff11052a)],
        ),
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        border: Border(top: BorderSide(color: Color(0xffffd45c), width: 2)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 46,
            height: 5,
            decoration: BoxDecoration(
              color: Colors.white38,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(height: 18),
          const Icon(
            Icons.workspace_premium_rounded,
            size: 72,
            color: Color(0xffffd45c),
          ),
          Text('$tier VIP', style: MetaStyle.hero),
          Text('$points VIP POINTS', style: MetaStyle.reward),
          const SizedBox(height: 18),
          LinearProgressIndicator(
            value: progress,
            minHeight: 14,
            color: const Color(0xffffd45c),
            backgroundColor: Colors.black45,
          ),
          const SizedBox(height: 8),
          Text(
            '${nextTier - points} Punkte bis zur nächsten Stufe',
            style: MetaStyle.caption,
          ),
          const SizedBox(height: 22),
          const _VipBenefit(
            icon: Icons.card_giftcard,
            title: 'Bessere tägliche Belohnungen',
          ),
          const _VipBenefit(
            icon: Icons.flash_on,
            title: 'Exklusive VIP-Missionen',
          ),
          const _VipBenefit(
            icon: Icons.support_agent,
            title: 'Priorisierter Support',
          ),
        ],
      ),
    );
  }
}

class _VipBenefit extends StatelessWidget {
  const _VipBenefit({required this.icon, required this.title});
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: const Color(0xffffd45c)),
    title: Text(title, style: MetaStyle.title),
    trailing: const Icon(Icons.check_circle, color: Color(0xff54e6a5)),
  );
}

class ShopScreen extends StatelessWidget {
  const ShopScreen({
    super.key,
    required this.offers,
    required this.gems,
    required this.busyOfferId,
    required this.onPurchase,
  });

  final List<ShopOfferView> offers;
  final int gems;
  final String? busyOfferId;
  final ShopPurchaseCallback onPurchase;

  @override
  Widget build(BuildContext context) => MetaPage(
    title: 'COIN SHOP',
    subtitle:
        '${_coins(gems)} GEMS  •  Nur Spielgeld. Kein Echtgeldgewinn und keine Auszahlung.',
    icon: Icons.shopping_bag_rounded,
    child: Column(
      children: [
        if (offers.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Shop-Angebote sind gerade nicht verfügbar.',
              style: MetaStyle.caption,
              textAlign: TextAlign.center,
            ),
          ),
        for (final offer in offers)
          _OfferCard(
            title: offer.title,
            coins: _coins(offer.coins),
            gems: _coins(offer.costGems),
            badge: offer.badge,
            featured: offer.featured,
            busy: busyOfferId == offer.id,
            enabled: busyOfferId == null && gems >= offer.costGems,
            onPurchase: () => onPurchase(offer),
          ),
      ],
    ),
  );

  static String _coins(int value) => value.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
}

class MetaPage extends StatelessWidget {
  const MetaPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.child,
  });

  final String title, subtitle;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xff32105f), Color(0xff071a37)],
      ),
    ),
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 22, 16, 28),
      child: Column(
        children: [
          Icon(icon, size: 42, color: const Color(0xffffd45c)),
          const SizedBox(height: 6),
          Text(title, textAlign: TextAlign.center, style: MetaStyle.hero),
          const SizedBox(height: 5),
          Text(subtitle, textAlign: TextAlign.center, style: MetaStyle.caption),
          const SizedBox(height: 20),
          child,
        ],
      ),
    ),
  );
}

class _EventCard extends StatelessWidget {
  const _EventCard({
    required this.event,
    required this.busy,
    required this.onClaim,
  });
  final LiveEventView event;
  final bool busy;
  final EventClaimCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final color = event.accent == 'gold'
        ? const Color(0xffffc52f)
        : const Color(0xff42e3ff);
    final maximum = event.milestones.isEmpty ? 1 : event.milestones.last.target;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: MetaStyle.card(color),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.emoji_events, color: color, size: 38),
              const SizedBox(width: 10),
              Expanded(child: Text(event.title, style: MetaStyle.title)),
              Text(
                _remaining(event.endsAt),
                style: TextStyle(
                  color: color,
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          Text(event.subtitle, style: MetaStyle.caption),
          const SizedBox(height: 14),
          LinearProgressIndicator(
            value: (event.progress / maximum).clamp(0, 1),
            minHeight: 13,
            color: color,
            backgroundColor: Colors.black45,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_metric(event), style: MetaStyle.reward),
              Text('${event.progress} / $maximum', style: MetaStyle.caption),
            ],
          ),
          const SizedBox(height: 12),
          for (final milestone in event.milestones)
            Container(
              margin: const EdgeInsets.only(top: 7),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withValues(alpha: .35)),
              ),
              child: Row(
                children: [
                  Icon(
                    milestone.claimed
                        ? Icons.check_circle
                        : milestone.completed
                        ? Icons.card_giftcard
                        : Icons.lock_outline,
                    color: milestone.completed ? color : Colors.white38,
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      '${milestone.target}  •  ${QuestsScreen._coins(milestone.rewardCoins)} COINS',
                      style: MetaStyle.caption,
                    ),
                  ),
                  FilledButton(
                    onPressed:
                        milestone.completed && !milestone.claimed && !busy
                        ? () => onClaim(event.id, milestone.id)
                        : null,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                    ),
                    child: Text(milestone.claimed ? 'CLAIMED' : 'CLAIM'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  static String _remaining(DateTime endsAt) {
    final remaining = endsAt.difference(DateTime.now().toUtc());
    if (remaining.isNegative) return 'ENDED';
    final days = remaining.inDays;
    final hours = remaining.inHours.remainder(24);
    final minutes = remaining.inMinutes.remainder(60);
    return days > 0 ? '${days}d ${hours}h' : '${hours}h ${minutes}m';
  }

  static String _metric(LiveEventView event) => switch (event.metric) {
    'spin_count' => 'SPINS',
    'win_total' => 'GEWINN',
    'wager_total' => 'EINSATZ',
    'free_spin_count' => 'FREISPIELE',
    _ => 'FORTSCHRITT',
  };
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({
    required this.title,
    required this.coins,
    required this.gems,
    required this.badge,
    required this.featured,
    required this.busy,
    required this.enabled,
    required this.onPurchase,
  });
  final String title, coins, gems, badge;
  final bool featured, busy, enabled;
  final VoidCallback onPurchase;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(16),
    decoration: MetaStyle.card(
      featured ? const Color(0xffffc52f) : const Color(0xffa75bff),
    ),
    child: Row(
      children: [
        const CircleAvatar(
          radius: 28,
          backgroundColor: Color(0xff6b2bd9),
          child: Icon(
            Icons.savings_rounded,
            color: Color(0xffffd45c),
            size: 34,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                badge,
                style: const TextStyle(
                  color: Color(0xffffd45c),
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(title, style: MetaStyle.title),
              Text('$coins COINS  •  $gems GEMS', style: MetaStyle.caption),
            ],
          ),
        ),
        FilledButton(
          onPressed: enabled ? onPurchase : null,
          child: busy
              ? const SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text('$gems GEMS'),
        ),
      ],
    ),
  );
}

class _RankingRow extends StatelessWidget {
  const _RankingRow({
    required this.rank,
    required this.name,
    required this.score,
  });
  final int rank;
  final String name, score;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: MetaStyle.card(const Color(0xffa75bff)),
    child: Row(
      children: [
        Text(
          '#$rank',
          style: const TextStyle(
            color: Color(0xffffd45c),
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(child: Text(name, style: MetaStyle.title)),
        Text(score, style: MetaStyle.reward),
      ],
    ),
  );
}

abstract final class MetaStyle {
  static const title = TextStyle(fontSize: 15, fontWeight: FontWeight.w900);
  static const hero = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w900,
    letterSpacing: .4,
  );
  static const caption = TextStyle(color: Color(0xffd2c7e7), fontSize: 12);
  static const reward = TextStyle(
    color: Color(0xffffd45c),
    fontSize: 12,
    fontWeight: FontWeight.w900,
  );

  static BoxDecoration card(Color color) => BoxDecoration(
    gradient: const LinearGradient(
      colors: [Color(0xee28104f), Color(0xee12062d)],
    ),
    borderRadius: BorderRadius.circular(18),
    border: Border.all(color: color.withValues(alpha: .75), width: 1.5),
    boxShadow: [BoxShadow(color: color.withValues(alpha: .15), blurRadius: 14)],
  );
}
