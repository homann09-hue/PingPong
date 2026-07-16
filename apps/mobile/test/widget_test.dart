import 'package:aurora_mobile/main.dart';
import 'package:aurora_mobile/models/game_definition.dart';
import 'package:aurora_mobile/screens/meta_screens.dart';
import 'package:aurora_mobile/screens/slot_screen.dart';
import 'package:aurora_mobile/services/casino_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
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

    await tester.tap(find.text('QUESTS'));
    await tester.pumpAndSettle();
    expect(find.text('MISSION CONTROL'), findsOneWidget);
    expect(find.text('HEUTE'), findsOneWidget);
    expect(find.text('DIESE WOCHE'), findsOneWidget);

    await tester.tap(find.text('CLUB'));
    await tester.pumpAndSettle();
    expect(find.text('FORTUNE CLUB'), findsOneWidget);

    await tester.tap(find.text('EVENTS'));
    await tester.pumpAndSettle();
    expect(find.text('LIVE EVENTS'), findsOneWidget);

    await tester.tap(find.text('SHOP'));
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
    expect(find.text('SOON'), findsNothing);
    expect(find.text('4,99 €'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, '4,99 €'));
    await tester.pump();
    expect(storePurchased?.product.storeProductId, 'aurora_coin_stack');
    await tester.tap(find.widgetWithText(FilledButton, '20 GEMS'));
    await tester.pump();
    expect(purchased?.id, 'daily-fortune');
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

    expect(find.text('BUY BONUS  5.000'), findsOneWidget);
    await tester.tap(find.text('BUY BONUS  5.000'));
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
