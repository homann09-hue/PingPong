import 'dart:async';

import 'package:flutter/material.dart';

import '../services/casino_api.dart';

typedef RewardClaimCallback = Future<void> Function(String rewardId);
typedef ShopPurchaseCallback = Future<void> Function(ShopOfferView offer);
typedef StorePurchaseCallback =
    Future<void> Function(PurchasableStoreProductView product);

/// Presents every economy balance and the latest immutable wallet movements.
class WalletSheet extends StatelessWidget {
  const WalletSheet({
    super.key,
    required this.balances,
    required this.transactions,
  });

  final List<WalletBalanceView> balances;
  final List<WalletTransactionView> transactions;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Container(
      key: const Key('wallet-sheet'),
      constraints: const BoxConstraints(maxHeight: 720),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
      decoration: const BoxDecoration(
        color: Color(0xff180a35),
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        border: Border(top: BorderSide(color: Color(0xffffc52f), width: 2)),
      ),
      child: CustomScrollView(
        slivers: [
          const SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: SizedBox(
                    width: 44,
                    child: Divider(thickness: 4, color: Colors.white38),
                  ),
                ),
                Text('MEIN WALLET', style: MetaStyle.hero),
                SizedBox(height: 3),
                Text(
                  'Alle virtuellen Währungen dieses Kontos. Kein Echtgeld und keine Auszahlung.',
                  style: MetaStyle.caption,
                ),
                SizedBox(height: 14),
              ],
            ),
          ),
          SliverGrid(
            delegate: SliverChildBuilderDelegate(
              (context, index) => _WalletBalanceCard(balance: balances[index]),
              childCount: balances.length,
            ),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisExtent: 72,
              crossAxisSpacing: 9,
              mainAxisSpacing: 9,
            ),
          ),
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.only(top: 20, bottom: 8),
              child: Text('LETZTE BUCHUNGEN', style: MetaStyle.title),
            ),
          ),
          if (transactions.isEmpty)
            const SliverToBoxAdapter(
              child: Text(
                'Noch keine Buchungen vorhanden.',
                style: MetaStyle.caption,
              ),
            )
          else
            SliverList.separated(
              itemCount: transactions.length,
              separatorBuilder: (_, _) => const Divider(color: Colors.white12),
              itemBuilder: (context, index) =>
                  _WalletTransactionRow(transaction: transactions[index]),
            ),
        ],
      ),
    ),
  );
}

class _WalletBalanceCard extends StatelessWidget {
  const _WalletBalanceCard({required this.balance});
  final WalletBalanceView balance;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: const Color(0xff2b1450),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(
        color: _currencyColor(balance.currency).withValues(alpha: .55),
      ),
    ),
    child: Row(
      children: [
        Icon(
          _currencyIcon(balance.currency),
          color: _currencyColor(balance.currency),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _currencyLabel(balance.currency),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: MetaStyle.caption,
              ),
              Text(_walletNumber(balance.balance), style: MetaStyle.reward),
            ],
          ),
        ),
      ],
    ),
  );
}

class _WalletTransactionRow extends StatelessWidget {
  const _WalletTransactionRow({required this.transaction});
  final WalletTransactionView transaction;

  @override
  Widget build(BuildContext context) {
    final credit = transaction.amount >= 0;
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: (credit ? Colors.greenAccent : Colors.redAccent)
            .withValues(alpha: .14),
        child: Icon(
          credit ? Icons.add : Icons.remove,
          color: credit ? Colors.greenAccent : Colors.redAccent,
        ),
      ),
      title: Text(
        _transactionLabel(transaction.source),
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(
        '${_currencyLabel(transaction.currency)} • Stand ${_walletNumber(transaction.balanceAfter)}',
        style: MetaStyle.caption,
      ),
      trailing: Text(
        '${credit ? '+' : ''}${_walletNumber(transaction.amount)}',
        style: TextStyle(
          color: credit ? Colors.greenAccent : Colors.redAccent,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

String _walletNumber(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);

String _currencyLabel(String currency) => switch (currency) {
  'coin' => 'Coins',
  'gem' => 'Diamanten',
  'loyalty_point' => 'Loyalty Points',
  'vip_point' => 'VIP-Punkte',
  'high_roller_point' => 'High-Roller-Punkte',
  'clan_point' => 'Clan-Punkte',
  'league_point' => 'Fireball-Punkte',
  'mission_point' => 'Missionspunkte',
  'lotsa_cash' => 'Lotsa Cash',
  'stamp' => 'Sammelmarken',
  'check_win_mark' => 'Check & Win',
  'booster' => 'Booster',
  'oinky_coupon' => 'Oinky-Coupons',
  _ => currency,
};

IconData _currencyIcon(String currency) => switch (currency) {
  'coin' => Icons.monetization_on,
  'gem' => Icons.diamond,
  'vip_point' || 'loyalty_point' => Icons.workspace_premium,
  'clan_point' => Icons.groups,
  'league_point' => Icons.local_fire_department,
  'mission_point' => Icons.flag,
  'stamp' || 'check_win_mark' => Icons.check_circle,
  'booster' => Icons.bolt,
  'oinky_coupon' => Icons.confirmation_number,
  _ => Icons.stars,
};

Color _currencyColor(String currency) => switch (currency) {
  'coin' => const Color(0xffffcf3a),
  'gem' => const Color(0xff42e3ff),
  'league_point' => const Color(0xffff6b42),
  'clan_point' => const Color(0xff68f0b1),
  _ => const Color(0xffff8bd8),
};

String _transactionLabel(String source) => switch (source) {
  'spin' => 'Slot-Spin',
  'reward' || 'timed_reward' => 'Belohnung',
  'bonus_wheel' => 'Bonusrad',
  'mission' => 'Mission',
  'shop' => 'Shop',
  'store_purchase' => 'Paket gekauft',
  'store_refund' => 'Kauf storniert',
  'check_win' => 'Check & Win',
  _ => 'Wallet-Buchung',
};

/// Interactive server-backed Check-&-Win collection and exchange surface.
class CheckWinSheet extends StatefulWidget {
  const CheckWinSheet({super.key, required this.api, this.onClaimed});

  final CasinoApi api;
  final ValueChanged<CheckWinClaimView>? onClaimed;

  @override
  State<CheckWinSheet> createState() => _CheckWinSheetState();
}

class _CheckWinSheetState extends State<CheckWinSheet> {
  CheckWinStatusView? status;
  bool busy = false;
  bool failed = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    if (mounted) setState(() => failed = false);
    try {
      final loaded = await widget.api.checkWinStatus();
      if (mounted) setState(() => status = loaded);
    } on StateError {
      if (mounted) setState(() => failed = true);
    }
  }

  Future<void> _claim() async {
    if (busy || status?.claimable != true) return;
    setState(() => busy = true);
    try {
      final claim = await widget.api.claimCheckWin();
      if (!mounted) return;
      setState(() {
        status = CheckWinStatusView(
          marks: claim.markBalance,
          requiredMarks: status!.requiredMarks,
          claimable: claim.markBalance >= status!.requiredMarks,
          rewardCoins: status!.rewardCoins,
          rewardStamps: status!.rewardStamps,
        );
      });
      widget.onClaimed?.call(claim);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '+${_walletNumber(claim.coins)} COINS  •  +${claim.stamps} SAMMELMARKE',
          ),
          backgroundColor: const Color(0xff6b2bd9),
        ),
      );
    } on StateError {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Belohnung konnte nicht eingelöst werden.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = status;
    return SafeArea(
      child: Container(
        key: const Key('check-win-sheet'),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xff421261), Color(0xff16082f)],
          ),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: Color(0xffffcf3a), width: 2)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Center(
              child: SizedBox(
                width: 44,
                child: Divider(thickness: 4, color: Colors.white38),
              ),
            ),
            const Icon(Icons.check_circle, size: 58, color: Color(0xffffcf3a)),
            const Text(
              'CHECK & WIN',
              textAlign: TextAlign.center,
              style: MetaStyle.hero,
            ),
            const SizedBox(height: 5),
            const Text(
              'Sammle eine Markierung bei jedem Gewinnspin. Eine volle Karte ergibt eine garantierte Spielgeld-Belohnung.',
              textAlign: TextAlign.center,
              style: MetaStyle.caption,
            ),
            const SizedBox(height: 20),
            if (failed)
              FilledButton(onPressed: _load, child: const Text('ERNEUT LADEN'))
            else if (current == null)
              const Center(child: CircularProgressIndicator())
            else ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var index = 0; index < current.requiredMarks; index++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Icon(
                        index < current.marks
                            ? Icons.check_circle
                            : Icons.circle_outlined,
                        size: 34,
                        color: index < current.marks
                            ? const Color(0xff6dffb2)
                            : Colors.white38,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              LinearProgressIndicator(
                value: (current.marks / current.requiredMarks)
                    .clamp(0, 1)
                    .toDouble(),
                minHeight: 10,
                borderRadius: BorderRadius.circular(8),
                backgroundColor: Colors.black45,
                color: const Color(0xff6dffb2),
              ),
              const SizedBox(height: 8),
              Text(
                '${current.marks}/${current.requiredMarks} MARKIERUNGEN',
                textAlign: TextAlign.center,
                style: MetaStyle.title,
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: MetaStyle.card(const Color(0xffffcf3a)),
                child: Text(
                  '${_walletNumber(current.rewardCoins)} COINS  +  ${current.rewardStamps} SAMMELMARKE',
                  textAlign: TextAlign.center,
                  style: MetaStyle.reward,
                ),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: current.claimable && !busy ? _claim : null,
                icon: busy
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.redeem),
                label: Text(
                  current.claimable ? 'BELOHNUNG HOLEN' : 'WEITER GEWINNEN',
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class NotificationSettingsSheet extends StatefulWidget {
  const NotificationSettingsSheet({super.key, required this.initial});
  final PushPreferencesView initial;

  @override
  State<NotificationSettingsSheet> createState() =>
      _NotificationSettingsSheetState();
}

class _NotificationSettingsSheetState extends State<NotificationSettingsSheet> {
  late bool enabled, marketing, rewards, social, quietHours;
  late String timeZone;

  @override
  void initState() {
    super.initState();
    enabled = widget.initial.enabled;
    marketing = widget.initial.marketing;
    rewards = widget.initial.rewards;
    social = widget.initial.social;
    quietHours = widget.initial.quietHoursStartMinutes != null;
    timeZone = widget.initial.timeZone;
  }

  @override
  Widget build(BuildContext context) {
    final zones = {
      timeZone,
      'UTC',
      'Europe/Berlin',
      'America/New_York',
      'Asia/Tokyo',
    }.toList();
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        decoration: const BoxDecoration(
          color: Color(0xff180a35),
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
          border: Border(top: BorderSide(color: Color(0xffffc52f), width: 2)),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(
                  child: SizedBox(
                    width: 44,
                    child: Divider(thickness: 4, color: Colors.white38),
                  ),
                ),
                const Text('BENACHRICHTIGUNGEN', style: MetaStyle.hero),
                const SizedBox(height: 4),
                const Text(
                  'Du entscheidest, welche Nachrichten Aurora senden darf. Marketing ist standardmäßig aus.',
                  style: MetaStyle.caption,
                ),
                const SizedBox(height: 12),
                _switch(
                  'Push-Nachrichten',
                  'Master-Schalter für dieses Konto',
                  enabled,
                  (value) => setState(() => enabled = value),
                ),
                _switch(
                  'Angebote & Events',
                  'Personalisierte LiveOps-Kampagnen',
                  marketing,
                  enabled ? (value) => setState(() => marketing = value) : null,
                ),
                _switch(
                  'Belohnungen',
                  'Daily Rewards und zeitlich begrenzte Boni',
                  rewards,
                  enabled ? (value) => setState(() => rewards = value) : null,
                ),
                _switch(
                  'Social',
                  'Freundschafts- und Clan-Aktivität',
                  social,
                  enabled ? (value) => setState(() => social = value) : null,
                ),
                _switch(
                  'Ruhezeit 22:00–07:00',
                  'Keine nichtkritischen Nachrichten während der Nacht',
                  quietHours,
                  enabled
                      ? (value) => setState(() => quietHours = value)
                      : null,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: timeZone,
                  decoration: const InputDecoration(
                    labelText: 'Zeitzone',
                    border: OutlineInputBorder(),
                  ),
                  items: zones
                      .map(
                        (zone) =>
                            DropdownMenuItem(value: zone, child: Text(zone)),
                      )
                      .toList(),
                  onChanged: enabled
                      ? (value) => setState(() => timeZone = value ?? timeZone)
                      : null,
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).pop(
                    PushPreferencesView(
                      enabled: enabled,
                      marketing: marketing,
                      rewards: rewards,
                      social: social,
                      quietHoursStartMinutes: quietHours ? 22 * 60 : null,
                      quietHoursEndMinutes: quietHours ? 7 * 60 : null,
                      timeZone: timeZone,
                    ),
                  ),
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('SPEICHERN'),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Beim Aktivieren fragt Aurora die Systemfreigabe an und registriert dieses Gerät sicher für Push-Nachrichten.',
                  textAlign: TextAlign.center,
                  style: MetaStyle.caption,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _switch(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool>? onChanged,
  ) => SwitchListTile.adaptive(
    contentPadding: EdgeInsets.zero,
    title: Text(title, style: MetaStyle.title),
    subtitle: Text(subtitle, style: MetaStyle.caption),
    value: value,
    onChanged: onChanged,
    activeTrackColor: const Color(0xff8b3df0),
  );
}

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

typedef SocialIdCallback = Future<void> Function(String id);
typedef ClanCreateCallback = Future<void> Function(String name, String tag);
typedef ClanRoleCallback = Future<void> Function(String playerId, String role);
typedef ClanReportCallback =
    Future<void> Function(String messageId, String reason, String? details);

class ClubScreen extends StatelessWidget {
  const ClubScreen({
    super.key,
    required this.overview,
    required this.messages,
    required this.members,
    required this.hasOlderMessages,
    required this.busy,
    required this.onAddFriend,
    required this.onAcceptFriend,
    required this.onJoinClan,
    required this.onCreateClan,
    required this.onLeaveClan,
    required this.onInviteToClan,
    required this.onAcceptClanInvitation,
    required this.onPostClanMessage,
    required this.onRemoveClanMessage,
    required this.onReportClanMessage,
    required this.onUpdateClanMemberRole,
    required this.onRemoveClanMember,
    required this.onTransferClanOwnership,
    required this.onLoadOlderMessages,
  });

  final SocialOverviewView? overview;
  final List<ClanMessageView> messages;
  final List<ClanMemberView> members;
  final bool hasOlderMessages;
  final bool busy;
  final SocialIdCallback onAddFriend, onAcceptFriend, onJoinClan;
  final SocialIdCallback onInviteToClan, onAcceptClanInvitation;
  final SocialIdCallback onPostClanMessage, onRemoveClanMessage;
  final ClanReportCallback onReportClanMessage;
  final ClanRoleCallback onUpdateClanMemberRole;
  final SocialIdCallback onRemoveClanMember, onTransferClanOwnership;
  final ClanCreateCallback onCreateClan;
  final Future<void> Function() onLeaveClan;
  final Future<void> Function() onLoadOlderMessages;

  @override
  Widget build(BuildContext context) => MetaPage(
    title: 'FORTUNE CLUB',
    subtitle: 'Echte Freunde, persistente Clans und gemeinsame Wochenziele.',
    icon: Icons.groups_rounded,
    child: overview == null
        ? Container(
            padding: const EdgeInsets.all(24),
            decoration: MetaStyle.card(const Color(0xffa75bff)),
            child: const Text(
              'SOCIAL-DATEN WERDEN GELADEN',
              style: MetaStyle.title,
            ),
          )
        : Column(
            children: [
              _clanSection(context),
              const SizedBox(height: 14),
              _friendsSection(),
            ],
          ),
  );

  Widget _clanSection(BuildContext context) {
    final current = overview!.currentClan;
    return Column(
      children: [
        const Text('DEIN CLAN', style: MetaStyle.hero),
        const SizedBox(height: 10),
        if (current != null) ...[
          _ClanCard(
            clan: current,
            busy: busy,
            actionLabel: current.role == 'owner' ? 'ANFÜHRER' : 'VERLASSEN',
            onAction: current.role == 'owner' || busy ? null : onLeaveClan,
          ),
          const SizedBox(height: 12),
          _clanRoster(context, current),
          const SizedBox(height: 12),
          _clanFeed(context, current),
        ] else ...[
          for (final invitation in overview!.incomingClanInvitations)
            Card(
              child: ListTile(
                leading: const CircleAvatar(
                  child: Icon(Icons.mark_email_unread_rounded),
                ),
                title: Text('${invitation.clan.name} lädt dich ein'),
                subtitle: Text('VON ${invitation.inviter.displayName}'),
                trailing: FilledButton(
                  onPressed: busy
                      ? null
                      : () => onAcceptClanInvitation(invitation.id),
                  child: const Text('ANNEHMEN'),
                ),
              ),
            ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: MetaStyle.card(const Color(0xffa75bff)),
            child: Column(
              children: [
                const Icon(
                  Icons.shield_rounded,
                  size: 64,
                  color: Color(0xffffd45c),
                ),
                const Text('FINDE DEINEN CLAN', style: MetaStyle.title),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: busy ? null : () => _showCreateClan(context),
                  icon: const Icon(Icons.add),
                  label: const Text('CLAN GRÜNDEN'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          for (final clan in overview!.discoverClans)
            _ClanCard(
              clan: clan,
              busy: busy,
              actionLabel: 'BEITRETEN',
              onAction: busy ? null : () => onJoinClan(clan.id),
            ),
        ],
      ],
    );
  }

  Widget _clanRoster(BuildContext context, ClanView clan) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: MetaStyle.card(const Color(0xffa75bff)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'MITGLIEDER ${members.length}/${clan.memberLimit}',
          style: MetaStyle.title,
        ),
        const SizedBox(height: 6),
        for (final member in members)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              radius: 17,
              child: Text('${member.player.level}'),
            ),
            title: Text(member.player.displayName),
            subtitle: Text(_clanRoleLabel(member.role)),
            trailing: _memberMenu(context, clan, member),
          ),
      ],
    ),
  );

  Widget? _memberMenu(
    BuildContext context,
    ClanView clan,
    ClanMemberView member,
  ) {
    final isSelf = member.player.id == overview!.player.id;
    final ownerActions = clan.role == 'owner' && !isSelf;
    final officerKick =
        clan.role == 'officer' && member.role == 'member' && !isSelf;
    if (!ownerActions && !officerKick) return null;
    return PopupMenuButton<String>(
      enabled: !busy,
      tooltip: 'Mitglied verwalten',
      onSelected: (action) async {
        if (action == 'promote') {
          await onUpdateClanMemberRole(member.player.id, 'officer');
        } else if (action == 'demote') {
          await onUpdateClanMemberRole(member.player.id, 'member');
        } else if (action == 'transfer') {
          await _confirmOwnershipTransfer(context, member);
        } else {
          await _confirmMemberRemoval(context, member);
        }
      },
      itemBuilder: (_) => [
        if (ownerActions && member.role == 'member')
          const PopupMenuItem(
            value: 'promote',
            child: Text('Zum Offizier ernennen'),
          ),
        if (ownerActions && member.role == 'officer')
          const PopupMenuItem(
            value: 'demote',
            child: Text('Zum Mitglied zurückstufen'),
          ),
        if (ownerActions)
          const PopupMenuItem(
            value: 'transfer',
            child: Text('Clan-Führung übertragen'),
          ),
        const PopupMenuItem(value: 'remove', child: Text('Aus Clan entfernen')),
      ],
    );
  }

  Future<void> _confirmOwnershipTransfer(
    BuildContext context,
    ClanMemberView member,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('CLAN-FÜHRUNG ÜBERTRAGEN?'),
        content: Text(
          '${member.player.displayName} wird neuer Anführer. Du wirst zum Offizier.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('ABBRECHEN'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('ÜBERTRAGEN'),
          ),
        ],
      ),
    );
    if (confirmed == true) await onTransferClanOwnership(member.player.id);
  }

  Future<void> _confirmMemberRemoval(
    BuildContext context,
    ClanMemberView member,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('MITGLIED ENTFERNEN?'),
        content: Text('${member.player.displayName} aus dem Clan entfernen?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('ABBRECHEN'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('ENTFERNEN'),
          ),
        ],
      ),
    );
    if (confirmed == true) await onRemoveClanMember(member.player.id);
  }

  static String _clanRoleLabel(String role) => switch (role) {
    'owner' => 'ANFÜHRER',
    'officer' => 'OFFIZIER',
    _ => 'MITGLIED',
  };

  Widget _friendsSection() => Column(
    children: [
      const Text('FREUNDE', style: MetaStyle.hero),
      const SizedBox(height: 10),
      for (final request in overview!.incomingRequests)
        _SocialPlayerTile(
          player: request.player,
          label: 'ANNEHMEN',
          onPressed: busy ? null : () => onAcceptFriend(request.id),
        ),
      for (final friend in overview!.friends)
        _SocialPlayerTile(
          player: friend,
          label:
              overview!.currentClan?.role == 'owner' ||
                  overview!.currentClan?.role == 'officer'
              ? 'EINLADEN'
              : 'FREUND',
          onPressed:
              (overview!.currentClan?.role == 'owner' ||
                      overview!.currentClan?.role == 'officer') &&
                  !busy
              ? () => onInviteToClan(friend.id)
              : null,
        ),
      if (overview!.friends.isEmpty && overview!.incomingRequests.isEmpty)
        const Text('Noch keine Freunde verbunden.', style: MetaStyle.caption),
      const SizedBox(height: 14),
      const Text('SPIELER ENTDECKEN', style: MetaStyle.title),
      const SizedBox(height: 8),
      for (final player in overview!.suggestions)
        _SocialPlayerTile(
          player: player,
          label: 'HINZUFÜGEN',
          onPressed: busy ? null : () => onAddFriend(player.id),
        ),
    ],
  );

  Widget _clanFeed(BuildContext context, ClanView clan) {
    final canModerate = clan.role == 'owner' || clan.role == 'officer';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: MetaStyle.card(const Color(0xffff8a3d)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(child: Text('CLAN FEED', style: MetaStyle.title)),
              FilledButton.icon(
                onPressed: busy ? null : () => _showClanMessage(context),
                icon: const Icon(Icons.edit_rounded, size: 18),
                label: const Text('POSTEN'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (messages.isEmpty)
            const Text(
              'Noch keine Clan-Nachrichten.',
              style: MetaStyle.caption,
            ),
          for (final message in messages)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                radius: 17,
                child: Icon(Icons.person, size: 18),
              ),
              title: Text(message.author.displayName),
              subtitle: Text(
                message.status == 'removed'
                    ? 'Nachricht wurde moderiert.'
                    : message.body ?? '',
                style: message.status == 'removed'
                    ? const TextStyle(fontStyle: FontStyle.italic)
                    : null,
              ),
              trailing: message.status == 'active'
                  ? PopupMenuButton<String>(
                      enabled: !busy,
                      tooltip: 'Nachrichtenaktionen',
                      onSelected: (action) {
                        if (action == 'remove') {
                          onRemoveClanMessage(message.id);
                        } else {
                          _showMessageReport(context, message.id);
                        }
                      },
                      itemBuilder: (_) => [
                        if (canModerate ||
                            message.author.id == overview!.player.id)
                          const PopupMenuItem(
                            value: 'remove',
                            child: Text('Nachricht entfernen'),
                          ),
                        if (message.author.id != overview!.player.id)
                          const PopupMenuItem(
                            value: 'report',
                            child: Text('Nachricht melden'),
                          ),
                      ],
                    )
                  : null,
            ),
          if (hasOlderMessages)
            TextButton(
              onPressed: busy ? null : onLoadOlderMessages,
              child: const Text('ÄLTERE NACHRICHTEN LADEN'),
            ),
        ],
      ),
    );
  }

  Future<void> _showClanMessage(BuildContext context) async {
    final controller = TextEditingController();
    final send = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('CLAN-NACHRICHT'),
        content: TextField(
          controller: controller,
          maxLength: 280,
          minLines: 2,
          maxLines: 5,
          decoration: const InputDecoration(
            hintText: 'Schreibe etwas für deinen Clan …',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('ABBRECHEN'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('SENDEN'),
          ),
        ],
      ),
    );
    final body = controller.text.trim();
    controller.dispose();
    if (send == true && body.isNotEmpty) await onPostClanMessage(body);
  }

  Future<void> _showMessageReport(
    BuildContext context,
    String messageId,
  ) async {
    var reason = 'spam';
    final details = TextEditingController();
    final submit = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('NACHRICHT MELDEN'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: reason,
                decoration: const InputDecoration(labelText: 'Grund'),
                items: const [
                  DropdownMenuItem(value: 'spam', child: Text('Spam')),
                  DropdownMenuItem(
                    value: 'harassment',
                    child: Text('Belästigung'),
                  ),
                  DropdownMenuItem(value: 'hate', child: Text('Hassrede')),
                  DropdownMenuItem(
                    value: 'sexual',
                    child: Text('Sexueller Inhalt'),
                  ),
                  DropdownMenuItem(
                    value: 'personal_data',
                    child: Text('Persönliche Daten'),
                  ),
                  DropdownMenuItem(value: 'other', child: Text('Sonstiges')),
                ],
                onChanged: (value) =>
                    setDialogState(() => reason = value ?? reason),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: details,
                maxLength: 500,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Details (optional)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('ABBRECHEN'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('MELDEN'),
            ),
          ],
        ),
      ),
    );
    if (submit == true) {
      final note = details.text.trim();
      await onReportClanMessage(
        messageId,
        reason,
        note.length >= 3 ? note : null,
      );
    }
  }

  Future<void> _showCreateClan(BuildContext context) async {
    final name = TextEditingController();
    final tag = TextEditingController();
    final create = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('CLAN GRÜNDEN'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              maxLength: 32,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            TextField(
              controller: tag,
              maxLength: 8,
              decoration: const InputDecoration(labelText: 'Tag'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('ABBRECHEN'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('GRÜNDEN'),
          ),
        ],
      ),
    );
    if (create == true &&
        name.text.trim().length >= 3 &&
        tag.text.trim().length >= 3) {
      await onCreateClan(name.text.trim(), tag.text.trim().toUpperCase());
    }
    name.dispose();
    tag.dispose();
  }
}

class _ClanCard extends StatelessWidget {
  const _ClanCard({
    required this.clan,
    required this.busy,
    required this.actionLabel,
    required this.onAction,
  });
  final ClanView clan;
  final bool busy;
  final String actionLabel;
  final Future<void> Function()? onAction;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(14),
    decoration: MetaStyle.card(const Color(0xffa75bff)),
    child: Row(
      children: [
        CircleAvatar(
          backgroundColor: const Color(0xff6b2bd9),
          child: Text(clan.tag.substring(0, 1)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(clan.name, style: MetaStyle.title),
              Text(
                '${clan.memberCount}/${clan.memberLimit} MITGLIEDER  •  ${_compact(clan.weeklyScore)} PUNKTE',
                style: MetaStyle.caption,
              ),
            ],
          ),
        ),
        FilledButton(
          onPressed: onAction == null ? null : () => onAction!(),
          child: Text(busy ? '…' : actionLabel),
        ),
      ],
    ),
  );
}

class _SocialPlayerTile extends StatelessWidget {
  const _SocialPlayerTile({
    required this.player,
    required this.label,
    required this.onPressed,
  });
  final SocialPlayerView player;
  final String label;
  final Future<void> Function()? onPressed;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Stack(
        children: [
          const CircleAvatar(child: Icon(Icons.person)),
          if (player.online)
            const Positioned(
              right: 0,
              bottom: 0,
              child: CircleAvatar(
                radius: 5,
                backgroundColor: Color(0xff54e6a5),
              ),
            ),
        ],
      ),
      title: Text(player.displayName, style: MetaStyle.title),
      subtitle: Text('LEVEL ${player.level}', style: MetaStyle.caption),
      trailing: TextButton(
        onPressed: onPressed == null ? null : () => onPressed!(),
        child: Text(label),
      ),
    ),
  );
}

String _compact(int value) => value >= 1000000
    ? '${(value / 1000000).toStringAsFixed(1)}M'
    : value.toString();

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
    this.storeProducts = const [],
    this.storeAvailable = false,
    this.storeBusyProductId,
    this.onStorePurchase,
    this.onRestoreStorePurchases,
  });

  final List<ShopOfferView> offers;
  final int gems;
  final String? busyOfferId;
  final ShopPurchaseCallback onPurchase;
  final List<PurchasableStoreProductView> storeProducts;
  final bool storeAvailable;
  final String? storeBusyProductId;
  final StorePurchaseCallback? onStorePurchase;
  final Future<void> Function()? onRestoreStorePurchases;

  @override
  Widget build(BuildContext context) => MetaPage(
    title: 'COIN SHOP',
    subtitle:
        '${_coins(gems)} GEMS  •  Nur Spielgeld. Kein Echtgeldgewinn und keine Auszahlung.',
    icon: Icons.shopping_bag_rounded,
    child: Column(
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: Text('APP STORE PACKAGES', style: MetaStyle.title),
        ),
        const SizedBox(height: 10),
        if (!storeAvailable)
          const Padding(
            padding: EdgeInsets.only(bottom: 20),
            child: Text(
              'Echte Pakete sind nur in der iOS- oder Android-App verfügbar. Preise werden direkt vom jeweiligen Store geladen.',
              style: MetaStyle.caption,
              textAlign: TextAlign.center,
            ),
          ),
        for (final package in storeProducts)
          _StoreOfferCard(
            package: package,
            busy: storeBusyProductId == package.product.storeProductId,
            enabled: storeBusyProductId == null && onStorePurchase != null,
            onPurchase: () => onStorePurchase!(package),
          ),
        if (storeAvailable)
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: TextButton.icon(
              onPressed: storeBusyProductId == null
                  ? onRestoreStorePurchases
                  : null,
              icon: const Icon(Icons.restore_rounded),
              label: const Text('KÄUFE WIEDERHERSTELLEN'),
            ),
          ),
        const Align(
          alignment: Alignment.centerLeft,
          child: Text('GEM OFFERS', style: MetaStyle.title),
        ),
        const SizedBox(height: 10),
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

class _StoreOfferCard extends StatelessWidget {
  const _StoreOfferCard({
    required this.package,
    required this.busy,
    required this.enabled,
    required this.onPurchase,
  });
  final PurchasableStoreProductView package;
  final bool busy, enabled;
  final VoidCallback onPurchase;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(16),
    decoration: MetaStyle.card(
      package.product.featured
          ? const Color(0xffffc52f)
          : const Color(0xff42e3ff),
    ),
    child: Row(
      children: [
        const CircleAvatar(
          radius: 28,
          backgroundColor: Color(0xff6b2bd9),
          child: Icon(
            Icons.account_balance_wallet_rounded,
            color: Color(0xffffd45c),
            size: 32,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                package.product.badge,
                style: const TextStyle(
                  color: Color(0xffffd45c),
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(package.product.title, style: MetaStyle.title),
              Text(
                '${ShopScreen._coins(package.product.grantCoins)} COINS  •  ${ShopScreen._coins(package.product.grantGems)} GEMS',
                style: MetaStyle.caption,
              ),
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
              : Text(package.localizedPrice),
        ),
      ],
    ),
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
