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
    required this.highRollerActive,
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
  final bool highRollerActive;
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
    return LayoutBuilder(
      builder: (context, constraints) => constraints.maxWidth >= 900
          ? _DesktopLobbyStage(
              level: level,
              now: now,
              games: games,
              featured: featured,
              highRollerActive: highRollerActive,
              packageManager: packageManager,
              missions: missions,
              events: events,
              shopOffers: shopOffers,
              social: social,
              campaign: campaign,
              hourlyReward: hourlyReward,
              dailyReward: dailyReward,
              wheel: wheel,
              onPlay: onPlay,
              onPrepare: onPrepare,
              onNavigate: onNavigate,
              onOpenRewards: onOpenRewards,
              onOpenInbox: onOpenInbox,
              onOpenBoosts: onOpenBoosts,
              onOpenSettings: onOpenSettings,
              onOpenShop: onOpenShop,
            )
          : _buildMobile(featured),
    );
  }

  Widget _buildMobile(List<GameDefinition> featured) {
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
                    highRollerActive: highRollerActive,
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
                  highRollerActive: highRollerActive,
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

class _DesktopLobbyStage extends StatelessWidget {
  const _DesktopLobbyStage({
    required this.level,
    required this.now,
    required this.games,
    required this.featured,
    required this.highRollerActive,
    required this.packageManager,
    required this.missions,
    required this.events,
    required this.shopOffers,
    required this.social,
    required this.campaign,
    required this.hourlyReward,
    required this.dailyReward,
    required this.wheel,
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
  final List<GameDefinition> games, featured;
  final bool highRollerActive;
  final SlotPackageManager packageManager;
  final List<MissionView> missions;
  final List<LiveEventView> events;
  final List<ShopOfferView> shopOffers;
  final SocialOverviewView? social;
  final LiveOpsCampaignView? campaign;
  final TimedRewardView? hourlyReward, dailyReward;
  final WheelView? wheel;
  final ValueChanged<GameDefinition> onPlay, onPrepare;
  final ValueChanged<int> onNavigate;
  final VoidCallback onOpenRewards, onOpenInbox, onOpenBoosts;
  final VoidCallback onOpenSettings, onOpenShop;

  @override
  Widget build(BuildContext context) {
    final primary = featured.isNotEmpty ? featured.first : games.first;
    final promoOne = featured.length > 1 ? featured[1] : games[1];
    final promoTwo = featured.length > 2 ? featured[2] : games[2];
    final inboxCount =
        (social?.incomingRequests.length ?? 0) +
        (social?.incomingClanInvitations.length ?? 0) +
        missions.where((item) => item.completed && !item.claimed).length;

    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/ui/aurora_festival_lobby.png',
          fit: BoxFit.cover,
          cacheWidth: 2048,
        ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x22020c28), Color(0x66040a24), Color(0xa60b0426)],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          child: Column(
            children: [
              _JackpotTicker(
                event: events.firstOrNull,
                campaign: campaign,
                now: now,
              ),
              const SizedBox(height: 10),
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _CasinoSideRail(
                      bonusReady:
                          dailyReward?.claimable == true ||
                          hourlyReward?.claimable == true,
                      wheelSpins: wheel?.availableSpins ?? 0,
                      missionCount: missions
                          .where((item) => item.completed && !item.claimed)
                          .length,
                      inboxCount: inboxCount,
                      onRewards: onOpenRewards,
                      onMissions: () => onNavigate(1),
                      onClub: () => onNavigate(2),
                      onInbox: onOpenInbox,
                      onBoosts: onOpenBoosts,
                      onSettings: onOpenSettings,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 25,
                      child: _LiveEventFeature(
                        game: primary,
                        event: events.firstOrNull,
                        campaign: campaign,
                        now: now,
                        onTap: () => onNavigate(3),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 42,
                      child: Column(
                        children: [
                          Expanded(
                            child: _PromoFeature(
                              game: promoOne,
                              level: level,
                              highRollerActive: highRollerActive,
                              packageManager: packageManager,
                              eyebrow: 'FEATURED JACKPOT',
                              onPlay: onPlay,
                              onPrepare: onPrepare,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Expanded(
                            child: _PromoFeature(
                              game: promoTwo,
                              level: level,
                              highRollerActive: highRollerActive,
                              packageManager: packageManager,
                              eyebrow: 'NEW SLOT',
                              onPlay: onPlay,
                              onPrepare: onPrepare,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 30,
                      child: _RecentlyPlayed(
                        games: games,
                        level: level,
                        highRollerActive: highRollerActive,
                        packageManager: packageManager,
                        onPlay: onPlay,
                        onPrepare: onPrepare,
                        onShop: onOpenShop,
                        offer: shopOffers.firstOrNull,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _JackpotTicker extends StatelessWidget {
  const _JackpotTicker({
    required this.event,
    required this.campaign,
    required this.now,
  });

  final LiveEventView? event;
  final LiveOpsCampaignView? campaign;
  final DateTime now;

  @override
  Widget build(BuildContext context) => Container(
    height: 46,
    padding: const EdgeInsets.symmetric(horizontal: 18),
    decoration: BoxDecoration(
      color: const Color(0xe80d031d),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xffffd94a), width: 2),
      boxShadow: const [
        BoxShadow(color: Color(0xaae72bff), blurRadius: 15, spreadRadius: 1),
      ],
    ),
    child: Row(
      children: [
        const Icon(Icons.auto_awesome, color: Color(0xffffdd54), size: 22),
        const SizedBox(width: 8),
        const Text(
          'AURORA MEGA PRIZE POOL',
          style: TextStyle(
            color: Color(0xff63edff),
            fontSize: 14,
            fontWeight: FontWeight.w900,
            letterSpacing: .8,
          ),
        ),
        const SizedBox(width: 14),
        const Text(
          '97.089.018.605',
          style: TextStyle(
            color: Color(0xffffd94a),
            fontSize: 19,
            fontWeight: FontWeight.w900,
          ),
        ),
        const Spacer(),
        Text(
          campaign?.title ?? event?.title ?? 'STARLIGHT SEASON',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
        ),
        const SizedBox(width: 10),
        Text(
          _remaining(campaign?.endsAt ?? event?.endsAt, now),
          style: const TextStyle(
            color: Color(0xffffd94a),
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _CasinoSideRail extends StatelessWidget {
  const _CasinoSideRail({
    required this.bonusReady,
    required this.wheelSpins,
    required this.missionCount,
    required this.inboxCount,
    required this.onRewards,
    required this.onMissions,
    required this.onClub,
    required this.onInbox,
    required this.onBoosts,
    required this.onSettings,
  });

  final bool bonusReady;
  final int wheelSpins, missionCount, inboxCount;
  final VoidCallback onRewards, onMissions, onClub, onInbox, onBoosts;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) => Container(
    width: 82,
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xffd72ee9), Color(0xff7410a8), Color(0xff29045d)],
      ),
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: const Color(0xffff83ff), width: 2),
      boxShadow: const [BoxShadow(color: Colors.black87, blurRadius: 14)],
    ),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final itemHeight = (constraints.maxHeight / 7).clamp(44.0, 62.0);
        return Column(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _RailButton(
              Icons.local_fire_department,
              'BONUS',
              bonusReady ? 1 : 0,
              onRewards,
              height: itemHeight,
            ),
            _RailButton(
              Icons.casino,
              'WHEEL',
              wheelSpins,
              onRewards,
              height: itemHeight,
            ),
            _RailButton(
              Icons.track_changes,
              'MISSIONS',
              missionCount,
              onMissions,
              height: itemHeight,
            ),
            _RailButton(Icons.groups_2, 'CLAN', 0, onClub, height: itemHeight),
            _RailButton(
              Icons.mail,
              'INBOX',
              inboxCount,
              onInbox,
              height: itemHeight,
            ),
            _RailButton(Icons.bolt, 'BOOST', 0, onBoosts, height: itemHeight),
            _RailButton(Icons.menu, 'MENU', 0, onSettings, height: itemHeight),
          ],
        );
      },
    ),
  );
}

class _RailButton extends StatelessWidget {
  const _RailButton(
    this.icon,
    this.label,
    this.badge,
    this.onTap, {
    required this.height,
  });
  final IconData icon;
  final String label;
  final int badge;
  final VoidCallback onTap;
  final double height;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 68,
        height: height,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.white, size: height < 54 ? 24 : 29),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: height < 54 ? 7 : 8,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            if (badge > 0)
              Positioned(
                right: 1,
                top: 2,
                child: CircleAvatar(
                  radius: 9,
                  backgroundColor: const Color(0xffff325f),
                  child: Text(
                    '$badge',
                    style: const TextStyle(
                      fontSize: 8,
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

class _LiveEventFeature extends StatelessWidget {
  const _LiveEventFeature({
    required this.game,
    required this.event,
    required this.campaign,
    required this.now,
    required this.onTap,
  });

  final GameDefinition game;
  final LiveEventView? event;
  final LiveOpsCampaignView? campaign;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xff2c075b),
    borderRadius: BorderRadius.circular(24),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(game.asset, fit: BoxFit.cover, cacheWidth: 720),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x22000000),
                  Color(0xbb25003f),
                  Color(0xff25003f),
                ],
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xffffdf48), width: 3),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x88ff2ccf),
                  blurRadius: 20,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xd9f82fc7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'LIVE EVENTS',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                  ),
                ),
                const Spacer(),
                Text(
                  campaign?.title ?? event?.title ?? 'MEGA COIN WEEK',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 27,
                    height: .95,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _remaining(campaign?.endsAt ?? event?.endsAt, now),
                  style: const TextStyle(
                    color: Color(0xffffdf48),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: onTap,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xff29c93f),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 46),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                  icon: const Icon(Icons.rocket_launch),
                  label: const Text(
                    'EVENT ÖFFNEN',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _PromoFeature extends StatelessWidget {
  const _PromoFeature({
    required this.game,
    required this.level,
    required this.highRollerActive,
    required this.packageManager,
    required this.eyebrow,
    required this.onPlay,
    required this.onPrepare,
  });

  final GameDefinition game;
  final int level;
  final bool highRollerActive;
  final SlotPackageManager packageManager;
  final String eyebrow;
  final ValueChanged<GameDefinition> onPlay, onPrepare;

  @override
  Widget build(BuildContext context) {
    final levelLocked = level < game.unlockLevel;
    final clubLocked = game.highRollerExclusive && !highRollerActive;
    final ready = packageManager.stateFor(game) == SlotPackageState.ready;
    final onTap = levelLocked
        ? null
        : clubLocked || ready
        ? () => onPlay(game)
        : () => onPrepare(game);
    return Material(
      color: const Color(0xff13042f),
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(game.asset, fit: BoxFit.cover, cacheWidth: 900),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                  colors: [Color(0x11000000), Color(0xd20b0324)],
                ),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: game.primary, width: 3),
                boxShadow: [
                  BoxShadow(
                    color: game.primary.withValues(alpha: .35),
                    blurRadius: 17,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    flex: 6,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          eyebrow,
                          style: TextStyle(
                            color: game.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2,
                          ),
                        ),
                        Text(
                          game.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 27,
                            height: .95,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          '${game.jackpot} JACKPOT',
                          style: TextStyle(
                            color: game.primary,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: 128,
                    child: FilledButton.icon(
                      key: Key('desktop-slot-action-${game.id}'),
                      onPressed: onTap,
                      style: FilledButton.styleFrom(
                        backgroundColor: levelLocked
                            ? Colors.grey.shade700
                            : const Color(0xff2fd044),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      icon: Icon(
                        levelLocked ? Icons.lock : Icons.play_arrow_rounded,
                      ),
                      label: Text(
                        levelLocked
                            ? 'LEVEL ${game.unlockLevel}'
                            : ready
                            ? 'SPIELEN'
                            : 'LADEN',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentlyPlayed extends StatelessWidget {
  const _RecentlyPlayed({
    required this.games,
    required this.level,
    required this.highRollerActive,
    required this.packageManager,
    required this.onPlay,
    required this.onPrepare,
    required this.onShop,
    required this.offer,
  });

  final List<GameDefinition> games;
  final int level;
  final bool highRollerActive;
  final SlotPackageManager packageManager;
  final ValueChanged<GameDefinition> onPlay, onPrepare;
  final VoidCallback onShop;
  final ShopOfferView? offer;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xc9e229d5),
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: const Color(0xffffec48), width: 3),
      boxShadow: const [BoxShadow(color: Color(0x88ff2ccf), blurRadius: 18)],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'ZULETZT GESPIELT',
          style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 9),
        Expanded(
          child: GridView.builder(
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: games.length < 4 ? games.length : 4,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 9,
              crossAxisSpacing: 9,
              childAspectRatio: .88,
            ),
            itemBuilder: (context, index) => _MiniSlotCard(
              game: games[index],
              level: level,
              highRollerActive: highRollerActive,
              packageManager: packageManager,
              onPlay: onPlay,
              onPrepare: onPrepare,
            ),
          ),
        ),
        const SizedBox(height: 9),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: onShop,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xffffd53b),
              foregroundColor: const Color(0xff3c0757),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(15),
              ),
            ),
            icon: const Icon(Icons.redeem),
            label: Text(
              offer?.title ?? 'TÄGLICHES ANGEBOT',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ),
      ],
    ),
  );
}

class _MiniSlotCard extends StatelessWidget {
  const _MiniSlotCard({
    required this.game,
    required this.level,
    required this.highRollerActive,
    required this.packageManager,
    required this.onPlay,
    required this.onPrepare,
  });
  final GameDefinition game;
  final int level;
  final bool highRollerActive;
  final SlotPackageManager packageManager;
  final ValueChanged<GameDefinition> onPlay, onPrepare;

  @override
  Widget build(BuildContext context) {
    final locked =
        level < game.unlockLevel ||
        (game.highRollerExclusive && !highRollerActive);
    final ready = packageManager.stateFor(game) == SlotPackageState.ready;
    return Material(
      color: const Color(0xff17032f),
      borderRadius: BorderRadius.circular(15),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: locked
            ? () => onPlay(game)
            : ready
            ? () => onPlay(game)
            : () => onPrepare(game),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(game.asset, fit: BoxFit.cover, cacheWidth: 360),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xe80a021a)],
                ),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: game.primary, width: 2),
              ),
            ),
            Positioned(
              left: 8,
              right: 8,
              bottom: 7,
              child: Text(
                game.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            if (locked)
              const Center(
                child: CircleAvatar(
                  backgroundColor: Color(0xbb240448),
                  foregroundColor: Colors.white,
                  child: Icon(Icons.lock),
                ),
              ),
          ],
        ),
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
                          Expanded(
                            child: Text(
                              _remaining(
                                campaign?.endsAt ?? event?.endsAt,
                                now,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
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
    if (dailyReward?.claimable == true || hourlyReward?.claimable == true) {
      return 'Claim now';
    }
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
    required this.highRollerActive,
    required this.packageManager,
    required this.onPlay,
    required this.onPrepare,
    this.large = false,
  });
  final GameDefinition game;
  final int level;
  final bool highRollerActive;
  final SlotPackageManager packageManager;
  final bool large;
  final ValueChanged<GameDefinition> onPlay, onPrepare;

  @override
  Widget build(BuildContext context) {
    final levelLocked = level < game.unlockLevel;
    final clubLocked = game.highRollerExclusive && !highRollerActive;
    final locked = levelLocked || clubLocked;
    final packageState = packageManager.stateFor(game);
    final ready = packageState == SlotPackageState.ready;
    return Semantics(
      label:
          '${game.name}, ${locked
              ? 'locked'
              : ready
              ? 'ready to play'
              : 'content download available'}',
      button: !levelLocked,
      child: Material(
        color: const Color(0xff100725),
        borderRadius: BorderRadius.circular(19),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: levelLocked
              ? null
              : clubLocked
              ? () => onPlay(game)
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
                    if (game.highRollerExclusive)
                      const _Pill(
                        label: 'HIGH ROLLER',
                        color: Color(0xffffc52f),
                      ),
                    const Spacer(),
                    Flexible(
                      child: _Pill(label: game.category, color: game.primary),
                    ),
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
                          onPressed: levelLocked
                              ? null
                              : clubLocked
                              ? () => onPlay(game)
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
                                ? clubLocked
                                      ? 'HIGH ROLLER CLUB'
                                      : 'LEVEL ${game.unlockLevel}'
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
      overflow: TextOverflow.ellipsis,
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
  if (duration.inDays > 0) {
    return '${duration.inDays}d ${duration.inHours.remainder(24)}h remaining';
  }
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
