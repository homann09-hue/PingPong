import 'package:aurora_mobile/main.dart';
import 'package:aurora_mobile/models/game_definition.dart';
import 'package:aurora_mobile/screens/meta_screens.dart';
import 'package:aurora_mobile/screens/slot_screen.dart';
import 'package:aurora_mobile/services/casino_api.dart';
import 'package:aurora_mobile/services/slot_package_manager.dart';
import 'package:aurora_mobile/widgets/lobby_hub.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('club-locked slot card opens the High Roller journey', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    final manager = SlotPackageManager();
    final neon = games.firstWhere((game) => game.id == 'neon-nights');
    GameDefinition? requested;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LobbyHub(
            level: 12,
            now: DateTime.utc(2026, 7, 17),
            games: [neon],
            highRollerActive: false,
            packageManager: manager,
            missions: const [],
            events: const [],
            shopOffers: const [],
            social: null,
            campaign: null,
            hourlyReward: null,
            dailyReward: null,
            wheel: null,
            onRefresh: () async {},
            onPlay: (game) => requested = game,
            onPrepare: (_) {},
            onNavigate: (_) {},
            onOpenRewards: () {},
            onOpenInbox: () {},
            onOpenBoosts: () {},
            onOpenSettings: () {},
            onOpenShop: () {},
          ),
        ),
      ),
    );
    await tester.pump();
    final action = find.byKey(const Key('slot-action-neon-nights'));
    await tester.dragUntilVisible(
      action,
      find.byKey(const Key('lobby-hub-scroll')),
      const Offset(0, -500),
    );
    expect(tester.widget<FilledButton>(action).onPressed, isNotNull);
    await tester.tap(action);
    expect(requested?.id, 'neon-nights');
    manager.dispose();
  });

  testWidgets('lobby exposes central hub, progression and slot catalog', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(const AuroraApp());
    await tester.pumpAndSettle();

    expect(find.text('LEVEL 12'), findsOneWidget);
    expect(find.byKey(const Key('lobby-quick-actions')), findsOneWidget);
    expect(find.text('BONUS'), findsOneWidget);
    expect(find.text('WHEEL'), findsOneWidget);
    expect(find.text('MISSIONS'), findsOneWidget);
    expect(find.text('PHARAOH OASIS'), findsOneWidget);

    await tester.drag(
      find.byKey(const Key('lobby-hub-scroll')),
      const Offset(0, -700),
    );
    await tester.pumpAndSettle();
    expect(find.text('PIRATE BAY'), findsOneWidget);
    expect(find.text('DOWNLOAD 24 MB'), findsOneWidget);

    await tester.drag(
      find.byKey(const Key('lobby-hub-scroll')),
      const Offset(0, -900),
    );
    await tester.pumpAndSettle();
    expect(find.text('VEGAS GOLD'), findsOneWidget);
    expect(find.text('LEVEL 20'), findsOneWidget);
  });

  testWidgets('bottom navigation opens functional meta screens', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(const AuroraApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('MISSIONEN'));
    await tester.pumpAndSettle();
    expect(find.text('MISSION CONTROL'), findsOneWidget);
    expect(find.text('DAILY MISSIONS'), findsOneWidget);
    expect(find.text('WÖCHENTLICHE MISSIONSLEISTE'), findsOneWidget);

    await tester.tap(find.text('CLAN'));
    await tester.pumpAndSettle();
    expect(find.text('FORTUNE CLUB'), findsOneWidget);

    await tester.tap(find.text('EVENTS'));
    await tester.pumpAndSettle();
    expect(find.text('LIVE EVENTS'), findsOneWidget);

    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('SHOP'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('COIN SHOP'), findsOneWidget);
  });

  testWidgets('club uses authoritative social overview and join callback', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    String? joinedClan;
    const clan = ClanView(
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Royal Spinners',
      tag: 'ROYAL',
      memberCount: 12,
      memberLimit: 50,
      weeklyScore: 8400000,
      role: null,
    );
    const overview = SocialOverviewView(
      player: SocialPlayerView(
        id: '00000000-0000-4000-8000-000000000001',
        displayName: 'Aurora Player',
        level: 12,
        online: true,
      ),
      friends: [],
      incomingRequests: [],
      suggestions: [],
      currentClan: null,
      discoverClans: [clan],
      incomingClanInvitations: [],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClubScreen(
            overview: overview,
            messages: const [],
            members: const [],
            hasOlderMessages: false,
            busy: false,
            onAddFriend: (_) async {},
            onAcceptFriend: (_) async {},
            onJoinClan: (id) async => joinedClan = id,
            onCreateClan: (_, _) async {},
            onLeaveClan: () async {},
            onInviteToClan: (_) async {},
            onAcceptClanInvitation: (_) async {},
            onPostClanMessage: (_) async {},
            onRemoveClanMessage: (_) async {},
            onReportClanMessage: (_, _, _) async {},
            onUpdateClanMemberRole: (_, _) async {},
            onRemoveClanMember: (_) async {},
            onTransferClanOwnership: (_) async {},
            onLoadOlderMessages: () async {},
          ),
        ),
      ),
    );
    expect(find.text('Royal Spinners'), findsOneWidget);
    expect(find.text('12/50 MITGLIEDER  •  8.4M PUNKTE'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'BEITRETEN'));
    await tester.pump();
    expect(joinedClan, clan.id);
  });

  testWidgets('shop renders server offers and invokes play-money purchase', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    ShopOfferView? purchased;
    PurchasableStoreProductView? storePurchased;
    const offer = ShopOfferView(
      id: 'daily-fortune',
      title: 'DAILY FORTUNE',
      coins: 200000,
      costGems: 20,
      badge: 'DAILY +100%',
      featured: true,
      expiresAt: null,
    );
    const storeProduct = PurchasableStoreProductView(
      product: StoreProductView(
        key: 'coin-stack',
        title: 'COIN STACK',
        description: 'Virtuelle Coins',
        badge: 'POPULAR',
        featured: false,
        grantCoins: 1000000,
        grantGems: 0,
        grantHighRollerPoints: 1000,
        purchaseLimit: 'repeatable',
        storeKind: 'consumable',
        storeProductId: 'aurora_coin_stack',
      ),
      localizedPrice: '4,99 €',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShopScreen(
            offers: const [offer],
            gems: 320,
            busyOfferId: null,
            onPurchase: (selected) async => purchased = selected,
            storeProducts: const [storeProduct],
            storeAvailable: true,
            onStorePurchase: (selected) async => storePurchased = selected,
          ),
        ),
      ),
    );

    expect(find.text('DAILY FORTUNE'), findsOneWidget);
    expect(find.text('200.000 COINS  •  20 GEMS'), findsOneWidget);
    expect(
      find.text('1.000.000 COINS  •  0 GEMS  •  +1.000 HR'),
      findsOneWidget,
    );
    expect(find.text('SOON'), findsNothing);
    expect(find.text('4,99 €'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, '4,99 €'));
    await tester.pump();
    expect(storePurchased?.product.storeProductId, 'aurora_coin_stack');
    await tester.tap(find.widgetWithText(FilledButton, '20 GEMS'));
    await tester.pump();
    expect(purchased?.id, 'daily-fortune');
  });

  testWidgets('wallet sheet renders economy balances and ledger movements', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WalletSheet(
            balances: const [
              WalletBalanceView(currency: 'coin', balance: 8450000),
              WalletBalanceView(currency: 'gem', balance: 320),
              WalletBalanceView(currency: 'league_point', balance: 42),
            ],
            transactions: [
              WalletTransactionView(
                id: 'ledger-1',
                currency: 'coin',
                amount: -1000,
                direction: 'debit',
                reason: 'spin_wager',
                source: 'spin',
                balanceAfter: 8450000,
                createdAt: DateTime.utc(2026, 7, 16),
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('wallet-sheet')), findsOneWidget);
    expect(find.text('MEIN WALLET'), findsOneWidget);
    expect(find.text('Coins'), findsOneWidget);
    expect(find.text('Diamanten'), findsOneWidget);
    expect(find.text('Fireball-Punkte'), findsOneWidget);
    expect(find.text('Slot-Spin'), findsOneWidget);
    expect(find.text('-1.000'), findsOneWidget);
  });

  testWidgets(
    'mission control renders daily, pro, locked super and weekly tracks',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 1200));
      await tester.pumpWidget(
        MaterialApp(
          home: QuestsScreen(
            spins: 0,
            totalWon: 0,
            freeSpins: 0,
            claimed: const {},
            onClaim: (_) async {},
            achievements: const [
              AchievementView(
                category: 'spins',
                tier: 'bronze',
                name: 'FIRST SPIN',
                description: 'Spiele 1 Spin',
                rewardId: 'achievement-first-spin',
                progress: 1,
                target: 1,
                coins: 75000,
                completed: true,
                claimed: false,
              ),
              AchievementView(
                category: 'spins',
                tier: 'silver',
                name: 'HIGH ROLLER',
                description: 'Spiele 100 Spins',
                rewardId: 'achievement-high-roller',
                progress: 1,
                target: 100,
                coins: 500000,
                completed: false,
                claimed: false,
                unlocked: false,
              ),
            ],
            missions: [
              _mission('daily-spins-10', 'daily', 'standard'),
              _mission('pro-spins-40', 'three_day', 'pro'),
              _mission(
                'super-free-spins-3',
                'daily',
                'super',
                unlocked: false,
                unlockProgress: 2,
                unlockTarget: 3,
                boosters: 1,
              ),
              _mission(
                'weekly-bar-3',
                'weekly',
                'pro',
                metric: 'daily_mission_claims',
                stamps: 1,
              ),
            ],
            onMissionClaim: (_) async {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('DAILY MISSIONS'), findsOneWidget);
      expect(find.text('PRO MISSIONS'), findsOneWidget);
      expect(find.text('SUPER MISSIONS'), findsOneWidget);
      expect(find.text('WÖCHENTLICHE MISSIONSLEISTE'), findsOneWidget);
      expect(find.text('2/3 UNLOCK'), findsOneWidget);
      expect(find.text('LOCKED'), findsNWidgets(2));
      expect(find.text('SPIN-MEILENSTEINE'), findsOneWidget);
      expect(find.text('BRONZE'), findsOneWidget);
      expect(find.text('SILVER'), findsOneWidget);
      expect(find.text('Vorherige Stufe zuerst einsammeln'), findsOneWidget);
    },
  );

  testWidgets('Check & Win exchanges a complete mark card through the API', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    CheckWinClaimView? received;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CheckWinSheet(
            api: _CheckWinApi(),
            onClaimed: (claim) => received = claim,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('check-win-sheet')), findsOneWidget);
    expect(find.text('5/5 MARKIERUNGEN'), findsOneWidget);
    expect(find.text('100.000 COINS  +  1 SAMMELMARKE'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'BELOHNUNG HOLEN'));
    await tester.pumpAndSettle();
    expect(received?.coinBalance, 250000);
    expect(find.text('0/5 MARKIERUNGEN'), findsOneWidget);
    expect(find.text('WEITER GEWINNEN'), findsOneWidget);
  });

  testWidgets('XP booster crafts stamps and activates finite boosted spins', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    BoosterStatusView? latest;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: XpBoosterSheet(
            api: _BoosterApi(),
            onChanged: (value) => latest = value,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('xp-booster-sheet')), findsOneWidget);
    expect(find.text('3/3'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'BOOSTER HERSTELLEN'));
    await tester.pumpAndSettle();
    expect(find.text('1'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'BOOSTER AKTIVIEREN'));
    await tester.pumpAndSettle();
    expect(latest?.activeSpins, 20);
    expect(find.text('2× XP • 20 Spins verbleibend'), findsOneWidget);
  });

  testWidgets('loyalty rewards exchange LP and refresh offer affordability', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    LoyaltyRedemptionView? received;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LoyaltyRewardsSheet(
            api: _LoyaltyApi(),
            onRedeemed: (value) => received = value,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('loyalty-rewards-sheet')), findsOneWidget);
    expect(find.text('500 LP'), findsNWidgets(2));
    expect(find.text('25 Diamanten'), findsOneWidget);
    await tester.tap(find.byKey(const Key('redeem-gem-pouch')));
    await tester.pumpAndSettle();
    expect(received?.rewardBalance, 345);
    expect(find.text('0 LP'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('redeem-coin-cache')))
          .onPressed,
      isNull,
    );
  });

  testWidgets('High Roller Club activates seven-day benefits', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    HighRollerClubView? received;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HighRollerClubSheet(
            api: _HighRollerApi(),
            onChanged: (value) => received = value,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('high-roller-club-sheet')), findsOneWidget);
    expect(find.text('20.000 / 20.000 PUNKTE'), findsOneWidget);
    expect(find.text('Endless Cashback'), findsOneWidget);
    expect(find.text('Spins nach Einsatzhöhe'), findsOneWidget);
    expect(find.text('Täglicher Store-Bonus · +750'), findsOneWidget);
    expect(find.text('Space Battle · BALD'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, '7 TAGE AKTIVIEREN'));
    await tester.pumpAndSettle();
    expect(received?.active, isTrue);
    expect(find.textContaining('AKTIV · 7T'), findsOneWidget);
  });

  testWidgets('VIP badge opens the progression sheet', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(const AuroraApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('VIP'));
    await tester.pumpAndSettle();
    expect(find.text('SILVER VIP'), findsOneWidget);
    expect(find.text('Bessere tägliche Belohnungen'), findsOneWidget);
  });

  testWidgets('notification settings require explicit marketing opt-in', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    PushPreferencesView? saved;
    const initial = PushPreferencesView(
      enabled: true,
      marketing: false,
      rewards: true,
      social: true,
      quietHoursStartMinutes: null,
      quietHoursEndMinutes: null,
      timeZone: 'UTC',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => FilledButton(
            onPressed: () async {
              saved = await showModalBottomSheet<PushPreferencesView>(
                context: context,
                isScrollControlled: true,
                builder: (_) =>
                    const NotificationSettingsSheet(initial: initial),
              );
            },
            child: const Text('OPEN'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('OPEN'));
    await tester.pumpAndSettle();
    expect(find.text('BENACHRICHTIGUNGEN'), findsOneWidget);
    expect(
      find.textContaining('Marketing ist standardmäßig aus'),
      findsOneWidget,
    );
    await tester.tap(find.text('Angebote & Events'));
    await tester.pump();
    await tester.scrollUntilVisible(
      find.text('SPEICHERN'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('SPEICHERN'));
    await tester.pumpAndSettle();
    expect(saved?.marketing, isTrue);
    expect(saved?.quietHoursStartMinutes, isNull);
  });

  testWidgets('reward center exposes authoritative timed rewards and wheel', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    final api = _RewardApi();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RewardCenterSheet(
            api: api,
            hourly: api.hourly,
            daily: api.daily,
            wheel: api.wheelStatus,
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('REWARD CENTER'), findsOneWidget);
    expect(find.text('HOURLY BONUS'), findsOneWidget);
    expect(find.text('DAILY STREAK'), findsOneWidget);
    expect(find.text('FORTUNE WHEEL'), findsOneWidget);
    expect(find.text('1 SPINS'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'CLAIM').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('+50.000 COINS'), findsOneWidget);
  });

  testWidgets('live events render milestone progress and invoke claims', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    var claimed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EventsScreen(
            events: [
              LiveEventView(
                id: 'world-fortune',
                title: 'WORLD FORTUNE',
                subtitle: 'Weekly wins',
                cadence: 'weekly',
                metric: 'win_total',
                accent: 'gold',
                periodKey: '2026-07-13',
                startsAt: DateTime.utc(2026, 7, 13),
                endsAt: DateTime.now().toUtc().add(const Duration(days: 2)),
                progress: 10,
                milestones: const [
                  EventMilestoneView(
                    id: 'bronze',
                    target: 10,
                    rewardCoins: 100000,
                    completed: true,
                    claimed: false,
                  ),
                ],
              ),
            ],
            rewardBusy: false,
            onClaim: (eventId, milestoneId) async {
              claimed = eventId == 'world-fortune' && milestoneId == 'bronze';
            },
            tournamentRank: 6,
            tournamentScore: 100,
            leaders: const [],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('WORLD FORTUNE'), findsOneWidget);
    expect(find.text('10  •  100.000 COINS'), findsOneWidget);
    expect(find.text('WORLD FORTUNE CHAMPIONSHIP'), findsOneWidget);
    expect(find.textContaining('BET-NORMALISIERTE PUNKTE'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'CLAIM'));
    await tester.pump();
    expect(claimed, isTrue);
  });

  testWidgets('eligible slots require confirmation before buying a bonus', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    final pirate = games.firstWhere((game) => game.id == 'pirate-bay');
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(splashFactory: InkRipple.splashFactory),
        home: SlotScreen(
          game: pirate,
          balance: 8400000,
          level: 12,
          xp: 625,
          vipPoints: 2450,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('BUY BONUS  3.200'), findsOneWidget);
    await tester.tap(find.text('BUY BONUS  3.200'));
    await tester.pumpAndSettle();
    expect(find.text('BONUS KAUFEN?'), findsOneWidget);
    expect(find.text('BONUS STARTEN'), findsOneWidget);
  });

  testWidgets('slot displays server-backed progressive jackpot seed pools', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(
        home: SlotScreen(
          game: games.first,
          balance: 1000000,
          level: 12,
          xp: 0,
          vipPoints: 0,
        ),
      ),
    );
    await tester.pump();
    expect(find.text('GRAND'), findsOneWidget);
    expect(find.text('50.000.000'), findsOneWidget);
    expect(find.text('5.000.000'), findsOneWidget);
    expect(find.text('500.000'), findsOneWidget);
    expect(find.text('TURBO'), findsOneWidget);
    expect(find.text('AUTO'), findsOneWidget);
    await tester.tap(find.text('AUTO'));
    await tester.pumpAndSettle();
    expect(find.text('10 AUTO SPINS'), findsOneWidget);
    expect(find.text('25 AUTO SPINS'), findsOneWidget);
    expect(find.text('50 AUTO SPINS'), findsOneWidget);
  });

  testWidgets('slot opens with a themed feature curtain', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 591));
    await tester.pumpWidget(
      MaterialApp(
        home: SlotScreen(
          game: games.first,
          balance: 1000000,
          level: 12,
          xp: 0,
          vipPoints: 0,
        ),
      ),
    );
    await tester.pump();
    expect(find.textContaining('WELCOME TO'), findsOneWidget);
    expect(
      find.text('WILD POWER • BONUS FEATURES • JACKPOTS'),
      findsOneWidget,
    );
    await tester.pump(const Duration(milliseconds: 2100));
    await tester.pumpAndSettle();
    expect(find.textContaining('WELCOME TO'), findsNothing);
  });

  testWidgets('free spins use the shared feature presentation', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 591));
    await tester.pumpWidget(
      MaterialApp(
        home: SlotScreen(
          game: games.first,
          balance: 1000000,
          level: 12,
          xp: 0,
          vipPoints: 0,
          api: _FreeSpinPresentationApi(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 2100));
    await tester.tap(find.text('DREH!'));
    for (var frame = 0; frame < 8; frame++) {
      await tester.pump(const Duration(milliseconds: 70));
    }
    expect(find.text('2 FREE SPINS'), findsOneWidget);
    expect(find.textContaining('SPECIAL REELS'), findsOneWidget);
    for (var frame = 0; frame < 45; frame++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  });

  testWidgets('expired High Roller access stops an open exclusive slot', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(
        home: SlotScreen(
          game: games.firstWhere((game) => game.id == 'neon-nights'),
          balance: 1000000,
          level: 12,
          xp: 0,
          vipPoints: 0,
          api: _ExpiredHighRollerApi(),
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.text('SPIN'));
    for (var frame = 0; frame < 10; frame++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('HIGH ROLLER CLUB'), findsOneWidget);
    expect(
      find.text('Dieser exklusive Slot benötigt eine aktive Mitgliedschaft.'),
      findsOneWidget,
    );
    expect(find.text('ZUM CLUB'), findsOneWidget);
  });
}

class _ExpiredHighRollerApi extends CasinoApi {
  @override
  Future<SpinResponse> spin(String gameId, int bet, {bool bonusBuy = false}) =>
      Future.error(const SpinException('HIGH_ROLLER_MEMBERSHIP_REQUIRED', 403));
}

class _FreeSpinPresentationApi extends CasinoApi {
  SpinRoundView _round(int index, int win) => SpinRoundView(
    phase: 'free_spin',
    index: index,
    grid: [
      ['A', 'K', 'Q'],
      ['A', 'W', 'Q'],
      ['A', 'K', 'S'],
      ['J', 'K', 'Q'],
      ['A', 'K', 'Q'],
    ],
    win: win,
    bonusMultiplier: 2,
    bonusMode: null,
    bonusTier: null,
    bonusSpots: null,
    bonusSegment: null,
    bonusBoardSize: null,
    bonusPickMultipliers: const [],
    bonusInitialSpots: const [],
    bonusRespinSteps: const [],
    bonusCoins: const [],
    featureLabel: 'FREE SPINS ×2',
    winningCells: const {'0:0', '1:0', '2:0'},
    winLabel: 'FREE SPIN WIN',
  );

  @override
  Future<SpinResponse> spin(
    String gameId,
    int bet, {
    bool bonusBuy = false,
  }) async {
    final rounds = [_round(1, 200), _round(2, 300)];
    return SpinResponse(
      grid: rounds.last.grid,
      balance: 1000400,
      win: 500,
      freeSpins: 2,
      rounds: rounds,
      level: 12,
      xp: 50,
      spins: 1,
      totalWon: 500,
      totalFreeSpins: 2,
      vipPoints: 1,
      maxWinReached: false,
      winClass: null,
      jackpots: const [
        JackpotPoolView(tier: 'MINI', amount: 500000, seedAmount: 500000),
        JackpotPoolView(tier: 'MINOR', amount: 5000000, seedAmount: 5000000),
        JackpotPoolView(tier: 'GRAND', amount: 50000000, seedAmount: 50000000),
      ],
    );
  }
}

class _RewardApi extends CasinoApi {
  final hourly = TimedRewardView(
    type: 'hourly',
    claimable: true,
    availableAt: DateTime.now().toUtc(),
    nextCoins: 50000,
    streak: 0,
    cyclePosition: 0,
    claimsTowardWheel: 3,
  );
  final daily = TimedRewardView(
    type: 'daily',
    claimable: false,
    availableAt: DateTime.now().toUtc().add(const Duration(hours: 4)),
    nextCoins: 100000,
    streak: 2,
    cyclePosition: 3,
    claimsTowardWheel: 0,
  );
  final wheelStatus = const WheelView(
    availableSpins: 1,
    segments: [
      WheelSegmentView(id: 'coins-50k', currency: 'coin', amount: 50000),
    ],
  );

  @override
  Future<TimedRewardView> timedReward(String type) async =>
      type == 'hourly' ? hourly : daily;

  @override
  Future<TimedRewardClaimView> claimTimedReward(String type) async =>
      const TimedRewardClaimView(
        coins: 50000,
        balance: 8450000,
        wheelUnlocked: false,
      );

  @override
  Future<WheelView> wheel() async => wheelStatus;
}

class _CheckWinApi extends CasinoApi {
  @override
  Future<CheckWinStatusView> checkWinStatus() async => const CheckWinStatusView(
    marks: 5,
    requiredMarks: 5,
    claimable: true,
    rewardCoins: 100000,
    rewardStamps: 1,
  );

  @override
  Future<CheckWinClaimView> claimCheckWin() async => const CheckWinClaimView(
    coins: 100000,
    stamps: 1,
    coinBalance: 250000,
    markBalance: 0,
    stampBalance: 3,
  );
}

class _BoosterApi extends CasinoApi {
  @override
  Future<BoosterStatusView> boosterStatus() async => const BoosterStatusView(
    stamps: 3,
    stampsPerBooster: 3,
    boosters: 0,
    activeSpins: 0,
    boostedSpinsPerToken: 20,
    xpMultiplier: 2,
    maxActiveSpins: 200,
    canCraft: true,
    canActivate: false,
  );

  @override
  Future<BoosterCraftView> craftBooster() async =>
      const BoosterCraftView(stampBalance: 0, boosterBalance: 1);

  @override
  Future<BoosterActivationView> activateBooster() async =>
      const BoosterActivationView(boosterBalance: 0, activeSpins: 20);
}

class _LoyaltyApi extends CasinoApi {
  @override
  Future<LoyaltyRewardsView> loyaltyRewards() async => const LoyaltyRewardsView(
    version: 1,
    loyaltyPoints: 500,
    offers: [
      LoyaltyRewardOfferView(
        id: 'coin-cache',
        title: 'Coin Cache',
        costLoyaltyPoints: 100,
        rewardCurrency: 'coin',
        rewardAmount: 100000,
        canRedeem: true,
      ),
      LoyaltyRewardOfferView(
        id: 'gem-pouch',
        title: 'Gem Pouch',
        costLoyaltyPoints: 500,
        rewardCurrency: 'gem',
        rewardAmount: 25,
        canRedeem: true,
      ),
    ],
  );

  @override
  Future<LoyaltyRedemptionView> redeemLoyaltyReward(String offerId) async =>
      LoyaltyRedemptionView(
        offerId: offerId,
        rewardCurrency: 'gem',
        rewardAmount: 25,
        loyaltyPointBalance: 0,
        rewardBalance: 345,
      );
}

class _HighRollerApi extends CasinoApi {
  static const sources = [
    HighRollerSourceView(
      id: 'spins',
      label: 'Spins nach Einsatzhöhe',
      points: null,
      available: true,
    ),
    HighRollerSourceView(
      id: 'daily_store_bonus',
      label: 'Täglicher Store-Bonus',
      points: 750,
      available: true,
    ),
    HighRollerSourceView(
      id: 'space_battle',
      label: 'Space Battle',
      points: null,
      available: false,
    ),
  ];
  static const benefits = [
    HighRollerBenefitView(
      id: 'endless_cashback',
      label: 'Endless Cashback',
      detail: '2 % Cashback auf Verlust-Spins',
      active: false,
    ),
  ];

  @override
  Future<HighRollerClubView> highRollerClub() async => const HighRollerClubView(
    points: 20000,
    entryPoints: 20000,
    eligible: true,
    active: false,
    activeUntil: null,
    remainingSeconds: 0,
    sources: sources,
    benefits: benefits,
  );

  @override
  Future<HighRollerClubView> activateHighRollerClub() async =>
      HighRollerClubView(
        points: 0,
        entryPoints: 20000,
        eligible: false,
        active: true,
        activeUntil: DateTime.now().toUtc().add(const Duration(days: 7)),
        remainingSeconds: 604800,
        sources: sources,
        benefits: const [
          HighRollerBenefitView(
            id: 'endless_cashback',
            label: 'Endless Cashback',
            detail: '2 % Cashback auf Verlust-Spins',
            active: true,
          ),
        ],
      );
}

MissionView _mission(
  String id,
  String cadence,
  String tier, {
  String metric = 'spin_count',
  bool unlocked = true,
  int unlockProgress = 0,
  int unlockTarget = 0,
  int stamps = 0,
  int boosters = 0,
}) => MissionView(
  id: id,
  cadence: cadence,
  tier: tier,
  translationKey: 'mission.$id',
  metric: metric,
  target: 10,
  progress: 0,
  rewardCoins: 100000,
  rewardMissionPoints: 10,
  rewardLoyaltyPoints: 25,
  rewardStamps: stamps,
  rewardToolboxes: 0,
  rewardBoosters: boosters,
  completed: false,
  claimed: false,
  periodKey: '2026-07-17',
  startsAt: DateTime.utc(2026, 7, 17),
  endsAt: DateTime.utc(2026, 7, 18),
  unlocked: unlocked,
  unlockProgress: unlockProgress,
  unlockTarget: unlockTarget,
);
