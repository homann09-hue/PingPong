import 'package:flutter/material.dart';

import '../models/game_definition.dart';
import '../services/casino_api.dart';
import '../services/slot_package_manager.dart';

/// Central, data-backed entry surface for games, LiveOps and social systems.
class LobbyHub extends StatelessWidget {
  const LobbyHub({
    super.key,
    required this.level,
    required this.now,
    required this.games,
    required this.packageManager,
    required this.missions,
    required this.events,
    required this.shopOffers,
    required this.social,
    required this.campaign,
    required this.hourlyReward,
    required this.dailyReward,
    required this.wheel,
    required this.onRefresh,
    required this.onPlay,
    required this.onPrepare,
    required this.onNavigate,
    required this.onOpenRewards,
    required this.onOpenInbox,
    required this.onOpenBoosts,
    required this.onOpenSettings,
    required this.onOpenShop,
  });

  final int level;
  final DateTime now;
  final List<GameDefinition> games;
  final SlotPackageManager packageManager;
  final List<MissionView> missions;
  final List<LiveEventView> events;
  final List<ShopOfferView> shopOffers;
  final SocialOverviewView? social;
  final LiveOpsCampaignView? campaign;
  final TimedRewardView? hourlyReward, dailyReward;
  final WheelView? wheel;
  final Future<void> Function() onRefresh;
  final ValueChanged<GameDefinition> onPlay;
  final ValueChanged<GameDefinition> onPrepare;
  final ValueChanged<int> onNavigate;
  final VoidCallback onOpenRewards, onOpenInbox, onOpenBoosts;
  final VoidCallback onOpenSettings, onOpenShop;

  @override
  Widget build(BuildContext context) {
    final featured = games.where((game) => game.featured).toList();
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: const Color(0xffffc52f),
      child: CustomScrollView(
        key: const Key('lobby-hub-scroll'),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
            sliver: SliverToBoxAdapter(
              child: _SeasonalHero(
                campaign: campaign,
                event: events.firstOrNull,
                now: now,
                cover: featured.firstOrNull?.asset ?? games.first.asset,
                onTap: () => onNavigate(3),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: _QuickActions(
              hourlyReward: hourlyReward,
              dailyReward: dailyReward,
              wheel: wheel,
              missions: missions,
              social: social,
              campaign: campaign,
              now: now,
              onRewards: onOpenRewards,
              onMissions: () => onNavigate(1),
              onClub: () => onNavigate(2),
              onInbox: onOpenInbox,
              onBoosts: onOpenBoosts,
              onSettings: onOpenSettings,
            ),
          ),
          const SliverToBoxAdapter(
            child: _SectionTitle(
              eyebrow: 'CURATED FOR YOU',
              title: 'Featured slots',
              subtitle: 'Live features, jackpots and bonus games',
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 238,
              child: ListView.separated(
                key: const Key('featured-slots'),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                scrollDirection: Axis.horizontal,
                itemCount: featured.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, index) => SizedBox(
                  width: 276,
                  child: _SlotCoverCard(
                    game: featured[index],
                    level: level,
                    packageManager: packageManager,
                    large: true,
                    onPlay: onPlay,
                    onPrepare: onPrepare,
                  ),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
            sliver: SliverToBoxAdapter(
              child: _PromotionStrip(
                offer: shopOffers.firstOrNull,
                onTap: onOpenShop,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: _SectionTitle(
              eyebrow: 'FULL CATALOG',
              title: 'All games',
              subtitle:
                  '${games.length} server-authoritative slots · unlocked through progression',
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            sliver: SliverGrid(
              key: const Key('all-slot-grid'),
              delegate: SliverChildBuilderDelegate(
                (context, index) => _SlotCoverCard(
                  game: games[index],
                  level: level,
                  packageManager: packageManager,
                  onPlay: onPlay,
                  onPrepare: onPrepare,
                ),
                childCount: games.length,
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: .69,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 18, 12, 24),
            sliver: SliverToBoxAdapter(
              child: _EventStrip(
                event: events.firstOrNull,
                now: now,
                onTap: () => onNavigate(3),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SeasonalHero extends StatelessWidget {
  const _SeasonalHero({
    required this.campaign,
    required this.event,
    required this.now,
    required this.cover,
    required this.onTap,
  });
  final LiveOpsCampaignView? campaign;
  final LiveEventView? event;
  final DateTime now;
  final String cover;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Seasonal promotion',
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        height: 188,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xffffd24a), width: 2),
          boxShadow: const [
            BoxShadow(
              color: Colors.black54,
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(cover, fit: BoxFit.cover, cacheWidth: 900),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                  colors: [Color(0x3318073d), Color(0xf20d0626)],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Align(
                alignment: Alignment.centerLeft,
                child: SizedBox(
                  width: 255,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const _Pill(
                        label: 'SEASON LIVE',
                        color: Color(0xffffd24a),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        campaign?.title ??
                            event?.title ??
                            'WORLD FORTUNE SEASON',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w900,
                          height: .98,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        campaign?.subtitle ??
                            'Climb the leaderboard and unlock seasonal rewards.',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Icon(
                            Icons.timer_outlined,
                            size: 16,
                            color: Color(0xffffd24a),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            _remaining(campaign?.endsAt ?? event?.endsAt, now),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            'OPEN EVENT ›',
                            style: TextStyle(
                              color: Color(0xffffd24a),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
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

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.hourlyReward,
    required this.dailyReward,
    required this.wheel,
    required this.missions,
    required this.social,
    required this.campaign,
    required this.now,
    required this.onRewards,
    required this.onMissions,
    required this.onClub,
    required this.onInbox,
    required this.onBoosts,
    required this.onSettings,
  });
  final TimedRewardView? hourlyReward, dailyReward;
  final WheelView? wheel;
  final List<MissionView> missions;
  final SocialOverviewView? social;
  final LiveOpsCampaignView? campaign;
  final DateTime now;
  final VoidCallback onRewards,
      onMissions,
      onClub,
      onInbox,
      onBoosts,
      onSettings;

  @override
  Widget build(BuildContext context) {
    final inbox =
        (social?.incomingRequests.length ?? 0) +
        (social?.incomingClanInvitations.length ?? 0) +
        missions
            .where((mission) => mission.completed && !mission.claimed)
            .length +
        (dailyReward?.claimable == true ? 1 : 0) +
        (campaign == null ? 0 : 1);
    final actions = [
      _QuickAction(
        Icons.card_giftcard,
        'BONUS',
        _rewardCaption(),
        onRewards,
        dailyReward?.claimable == true ? 1 : 0,
      ),
      _QuickAction(
        Icons.casino_outlined,
        'WHEEL',
        '${wheel?.availableSpins ?? 0} spins',
        onRewards,
        wheel?.availableSpins ?? 0,
      ),
      _QuickAction(
        Icons.task_alt,
        'MISSIONS',
        '${missions.where((item) => item.completed && !item.claimed).length} ready',
        onMissions,
        missions.where((item) => item.completed && !item.claimed).length,
      ),
      _QuickAction(
        Icons.groups_2_outlined,
        'CLAN',
        social?.currentClan?.tag ?? 'Find club',
        onClub,
        social?.incomingClanInvitations.length ?? 0,
      ),
      _QuickAction(
        Icons.mark_email_unread_outlined,
        'INBOX',
        '$inbox updates',
        onInbox,
        inbox,
      ),
      _QuickAction(Icons.bolt, 'BOOSTS', 'Rewards', onBoosts, 0),
      _QuickAction(Icons.tune, 'SETTINGS', 'Preferences', onSettings, 0),
    ];
    return SizedBox(
      height: 112,
      child: ListView.separated(
        key: const Key('lobby-quick-actions'),
        padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
        scrollDirection: Axis.horizontal,
        itemCount: actions.length,
        separatorBuilder: (_, _) => const SizedBox(width: 9),
        itemBuilder: (context, index) => actions[index],
      ),
    );
  }

  String _rewardCaption() {
    if (dailyReward?.claimable == true || hourlyReward?.claimable == true)
      return 'Claim now';
    final next = hourlyReward?.availableAt;
    if (next == null) return 'Daily reward';
    return _countdown(next, now);
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction(
    this.icon,
    this.title,
    this.caption,
    this.onTap,
    this.badge,
  );
  final IconData icon;
  final String title, caption;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 86,
    child: Material(
      color: const Color(0xff170b35),
      borderRadius: BorderRadius.circular(17),
      child: InkWell(
        borderRadius: BorderRadius.circular(17),
        onTap: onTap,
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: const Color(0xffffd24a), size: 28),
                  const SizedBox(height: 4),
                  Text(
                    title,
                    maxLines: 1,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    caption,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 9, color: Colors.white60),
                  ),
                ],
              ),
            ),
            if (badge > 0)
              Positioned(
                right: 5,
                top: 5,
                child: CircleAvatar(
                  radius: 9,
                  backgroundColor: const Color(0xffff3e74),
                  child: Text(
                    '$badge',
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
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

class _SlotCoverCard extends StatelessWidget {
  const _SlotCoverCard({
    required this.game,
    required this.level,
    required this.packageManager,
    required this.onPlay,
    required this.onPrepare,
    this.large = false,
  });
  final GameDefinition game;
  final int level;
  final SlotPackageManager packageManager;
  final bool large;
  final ValueChanged<GameDefinition> onPlay, onPrepare;

  @override
  Widget build(BuildContext context) {
    final locked = level < game.unlockLevel;
    final packageState = packageManager.stateFor(game);
    final ready = packageState == SlotPackageState.ready;
    return Semantics(
      label:
          '${game.name}, ${locked
              ? 'locked'
              : ready
              ? 'ready to play'
              : 'content download available'}',
      button: !locked,
      child: Material(
        color: const Color(0xff100725),
        borderRadius: BorderRadius.circular(19),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: locked
              ? null
              : ready
              ? () => onPlay(game)
              : () => onPrepare(game),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.asset(
                game.asset,
                fit: BoxFit.cover,
                cacheWidth: large ? 720 : 440,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0xf5080317)],
                    stops: [.28, .78],
                  ),
                ),
              ),
              Positioned(
                left: 10,
                right: 10,
                top: 9,
                child: Row(
                  children: [
                    if (game.isNew)
                      const _Pill(label: 'NEW', color: Color(0xffff3e74)),
                    const Spacer(),
                    _Pill(label: game.category, color: game.primary),
                  ],
                ),
              ),
              Positioned(
                left: 11,
                right: 11,
                bottom: 10,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      game.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: large ? 21 : 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      '${game.jackpot} JACKPOT',
                      maxLines: 1,
                      style: TextStyle(
                        color: game.primary,
                        fontSize: large ? 12 : 9,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (packageState == SlotPackageState.preparing)
                      LinearProgressIndicator(
                        value: packageManager.progressFor(game),
                        color: game.primary,
                        backgroundColor: Colors.white12,
                      )
                    else
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          key: Key('slot-action-${game.id}'),
                          onPressed: locked
                              ? null
                              : ready
                              ? () => onPlay(game)
                              : () => onPrepare(game),
                          style: FilledButton.styleFrom(
                            backgroundColor: locked
                                ? Colors.grey.shade700
                                : game.primary,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(vertical: 7),
                            visualDensity: VisualDensity.compact,
                          ),
                          icon: Icon(
                            locked
                                ? Icons.lock
                                : ready
                                ? Icons.play_arrow_rounded
                                : Icons.download_rounded,
                            size: 17,
                          ),
                          label: Text(
                            locked
                                ? 'LEVEL ${game.unlockLevel}'
                                : ready
                                ? 'PLAY'
                                : packageState == SlotPackageState.failed
                                ? 'RETRY'
                                : 'DOWNLOAD ${game.packageSizeMb} MB',
                            maxLines: 1,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (locked)
                Positioned.fill(
                  child: IgnorePointer(
                    child: ColoredBox(
                      color: const Color(0x77000000),
                      child: Center(
                        child: Icon(
                          Icons.lock_outline,
                          size: large ? 54 : 40,
                          color: game.primary,
                        ),
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
}

class _PromotionStrip extends StatelessWidget {
  const _PromotionStrip({required this.offer, required this.onTap});
  final ShopOfferView? offer;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xff4b126f),
    borderRadius: BorderRadius.circular(17),
    child: InkWell(
      borderRadius: BorderRadius.circular(17),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            const CircleAvatar(
              backgroundColor: Color(0xffffd24a),
              foregroundColor: Colors.black,
              child: Icon(Icons.local_fire_department),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    offer?.badge ?? 'LIMITED OFFER',
                    style: const TextStyle(
                      color: Color(0xffffd24a),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    offer?.title ?? 'FORTUNE STARTER BUNDLE',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  Text(
                    offer == null
                        ? 'Coins, gems and seasonal rewards'
                        : '${_format(offer!.coins)} coins · ${offer!.costGems} gems',
                    style: const TextStyle(fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ),
            const Text(
              'SHOP ›',
              style: TextStyle(
                color: Color(0xffffd24a),
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _EventStrip extends StatelessWidget {
  const _EventStrip({
    required this.event,
    required this.now,
    required this.onTap,
  });
  final LiveEventView? event;
  final DateTime now;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xff0c305a),
    borderRadius: BorderRadius.circular(17),
    child: InkWell(
      borderRadius: BorderRadius.circular(17),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Row(
          children: [
            const Icon(
              Icons.emoji_events_outlined,
              color: Color(0xff42e3ff),
              size: 38,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'TIME-LIMITED EVENT',
                    style: TextStyle(
                      color: Color(0xff42e3ff),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    event?.title ?? 'SPIN SPRINT',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    _remaining(event?.endsAt, now),
                    style: const TextStyle(color: Colors.white60, fontSize: 11),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
  });
  final String eyebrow, title, subtitle;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(13, 18, 13, 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow,
          style: const TextStyle(
            color: Color(0xffffd24a),
            fontSize: 10,
            letterSpacing: 1.4,
            fontWeight: FontWeight.w900,
          ),
        ),
        Text(
          title,
          style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
        ),
        Text(
          subtitle,
          style: const TextStyle(color: Colors.white60, fontSize: 11),
        ),
      ],
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.color});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label,
      maxLines: 1,
      style: const TextStyle(
        color: Colors.black,
        fontSize: 8,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

String _remaining(DateTime? end, DateTime now) {
  if (end == null) return '6d 12h remaining';
  final duration = end.toUtc().difference(now.toUtc());
  if (duration.isNegative) return 'Ending now';
  if (duration.inDays > 0)
    return '${duration.inDays}d ${duration.inHours.remainder(24)}h remaining';
  return '${duration.inHours}h ${duration.inMinutes.remainder(60)}m remaining';
}

String _countdown(DateTime end, DateTime now) {
  final duration = end.toUtc().difference(now.toUtc());
  if (duration.isNegative) return 'Ready';
  return '${duration.inHours.toString().padLeft(2, '0')}:${duration.inMinutes.remainder(60).toString().padLeft(2, '0')}';
}

String _format(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);
