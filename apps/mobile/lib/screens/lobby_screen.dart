import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_definition.dart';
import '../services/casino_api.dart';
import '../services/push_messaging_bridge.dart';
import '../services/store_purchase_bridge.dart';
import '../services/store_purchase_bridge_factory.dart';
import '../widgets/top_hud.dart';
import 'meta_screens.dart';
import 'slot_screen.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  int balance = 8400000;
  int gems = 320;
  int level = 12;
  int xp = 625;
  int spins = 0;
  int totalWon = 0;
  int totalFreeSpins = 0;
  int vipPoints = 2450;
  int vipTierStart = 1000;
  int vipNextTier = 3000;
  int tournamentRank = 6;
  int tournamentScore = 0;
  int tournamentPrizePool = 25000000;
  int tournamentEntrants = 1;
  String tournamentName = 'WORLD FORTUNE CHAMPIONSHIP';
  DateTime tournamentEndsAt = DateTime.now().toUtc().add(
    const Duration(days: 7),
  );
  String vipTier = 'SILVER';
  List<AchievementView> achievements = const [];
  List<MissionView> missions = const [];
  List<LiveEventView> liveEvents = const [];
  List<ShopOfferView> shopOffers = const [];
  List<PurchasableStoreProductView> storeProducts = const [];
  SocialOverviewView? socialOverview;
  List<ClanMessageView> clanMessages = const [];
  String? clanFeedCursor;
  LiveOpsCampaignView? activeCampaign;
  PushPreferencesView? pushPreferences;
  TimedRewardView? hourlyReward;
  TimedRewardView? dailyReward;
  WheelView? rewardWheel;
  List<Map<String, dynamic>> tournamentLeaders = const [];
  int tab = 0;
  bool rewardBusy = false;
  bool socialBusy = false;
  String? shopBusyOfferId;
  String? storeBusyProductId;
  String? playerId;
  bool dailyClaimed = false;
  final claimedQuests = <String>{};
  final api = CasinoApi();
  final storeBridge = createStorePurchaseBridge();
  final pushBridge = PushMessagingBridge();
  StreamSubscription<StorePurchaseUpdate>? storeUpdates;
  StreamSubscription<String>? pushTokenUpdates;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadShopOffers();
    storeUpdates = storeBridge.updates.listen(_handleStorePurchaseUpdate);
    unawaited(_loadPlatformStore());
    _loadSocial();
    _loadLiveOps();
    _loadMessaging();
    unawaited(api.trackEvent('screen.viewed', screen: 'lobby'));
  }

  Future<void> _loadPlatformStore() async {
    try {
      await storeBridge.initialize();
      final platform = storeBridge.platform;
      if (!storeBridge.available || platform == null) return;
      final catalog = await api.storeProducts(platform);
      final details = await storeBridge.loadProducts(
        catalog.map((product) => product.storeProductId).toList(),
      );
      final prices = {
        for (final detail in details) detail.productId: detail.localizedPrice,
      };
      final purchasable = catalog
          .where((product) => prices.containsKey(product.storeProductId))
          .map(
            (product) => PurchasableStoreProductView(
              product: product,
              localizedPrice: prices[product.storeProductId]!,
            ),
          )
          .toList(growable: false);
      if (mounted) setState(() => storeProducts = purchasable);
    } on StateError {
      // Native shop remains unavailable until StoreKit/Google Play responds.
    }
  }

  Future<void> _loadMessaging() async {
    try {
      final loaded = await api.pushPreferences();
      if (mounted) setState(() => pushPreferences = loaded);
      await pushBridge.initialize();
      await pushTokenUpdates?.cancel();
      pushTokenUpdates = pushBridge.tokenRefreshes.listen((token) {
        if (pushPreferences?.enabled ?? false) {
          unawaited(_registerPushToken(token));
        }
      });
      if (loaded.enabled &&
          _permissionAllowsPush(await pushBridge.permissionStatus())) {
        await _registerPushToken();
      }
    } on StateError {
      // Messaging settings stay unavailable until the authoritative API responds.
    }
  }

  bool _permissionAllowsPush(PushPermissionStatus status) =>
      status == PushPermissionStatus.authorized ||
      status == PushPermissionStatus.provisional;

  Future<bool> _registerPushToken([String? refreshedToken]) async {
    await pushBridge.initialize();
    if (!pushBridge.available) return false;
    final token = refreshedToken ?? await pushBridge.token();
    if (token == null || token.isEmpty) return false;
    await api.registerPushInstallation(
      installationId: await api.installationId(),
      provider: pushBridge.provider,
      token: token,
    );
    return true;
  }

  Future<void> _removePushInstallation() async {
    try {
      await api.removePushInstallation(await api.installationId());
    } finally {
      await pushBridge.deleteToken();
    }
  }

  Future<void> _openNotificationSettings() async {
    final current = pushPreferences;
    if (current == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Benachrichtigungseinstellungen sind gerade offline.'),
        ),
      );
      return;
    }
    final changed = await showModalBottomSheet<PushPreferencesView>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NotificationSettingsSheet(initial: current),
    );
    if (changed == null) return;
    late final PushPreferencesView saved;
    try {
      saved = await api.updatePushPreferences(changed);
    } on StateError {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Einstellungen konnten nicht gespeichert werden.'),
        ),
      );
      return;
    }
    if (!mounted) return;
    setState(() => pushPreferences = saved);

    var statusMessage = 'Benachrichtigungen gespeichert.';
    try {
      if (saved.enabled) {
        await pushBridge.initialize();
        if (!pushBridge.available) {
          statusMessage =
              'Gespeichert. Push ist auf diesem Gerät nicht konfiguriert.';
        } else {
          final permission = await pushBridge.requestPermission();
          if (!_permissionAllowsPush(permission)) {
            statusMessage = 'Gespeichert. Systemfreigabe wurde nicht erteilt.';
          } else if (!await _registerPushToken()) {
            statusMessage = 'Gespeichert. Push-Token ist noch nicht verfügbar.';
          }
        }
      } else if (current.enabled) {
        await _removePushInstallation();
      }
    } on StateError {
      statusMessage =
          'Einstellungen gespeichert, Geräteanmeldung wird später wiederholt.';
    }
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(statusMessage)));
  }

  Future<void> _loadLiveOps() async {
    try {
      final campaigns = await api.liveOpsCampaigns();
      if (mounted) setState(() => activeCampaign = campaigns.firstOrNull);
    } on StateError {
      // The fallback tournament card remains available when LiveOps is offline.
    }
  }

  Future<void> _loadSocial() async {
    try {
      final loaded = await api.socialOverview();
      if (!mounted) return;
      setState(() => socialOverview = loaded);
      if (loaded.currentClan == null) {
        setState(() {
          clanMessages = const [];
          clanFeedCursor = null;
        });
      } else {
        await _loadClanFeed();
      }
    } on StateError {
      // The social surface communicates unavailable state without fake data.
    }
  }

  Future<void> _loadClanFeed({bool append = false}) async {
    try {
      final page = await api.clanFeed(cursor: append ? clanFeedCursor : null);
      if (!mounted) return;
      setState(() {
        clanMessages = append
            ? [...clanMessages, ...page.messages]
            : page.messages;
        clanFeedCursor = page.nextCursor;
      });
    } on StateError {
      // Existing messages remain visible during a transient feed failure.
    }
  }

  Future<void> _loadOlderClanMessages() async {
    if (socialBusy || clanFeedCursor == null) return;
    setState(() => socialBusy = true);
    try {
      await _loadClanFeed(append: true);
    } finally {
      if (mounted) setState(() => socialBusy = false);
    }
  }

  Future<void> _socialAction(Future<void> Function() action) async {
    if (socialBusy) return;
    setState(() => socialBusy = true);
    try {
      await action();
      await _loadSocial();
    } on StateError {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Social-Aktion konnte nicht abgeschlossen werden.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => socialBusy = false);
    }
  }

  Future<void> _loadShopOffers() async {
    try {
      final loadedShopOffers = await api.shopOffers();
      if (mounted) setState(() => shopOffers = loadedShopOffers);
    } on StateError {
      // The shop stays unavailable until the authoritative catalog responds.
    }
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await api.profile();
      final loadedMissions = await api.missions();
      final loadedHourly = await api.timedReward('hourly');
      final loadedDaily = await api.timedReward('daily');
      final loadedWheel = await api.wheel();
      final loadedEvents = await api.events();
      if (!mounted) return;
      setState(() {
        playerId = profile.playerId;
        balance = profile.balance;
        gems = profile.gems;
        level = profile.level;
        xp = profile.xp;
        spins = profile.spins;
        totalWon = profile.totalWon;
        totalFreeSpins = profile.freeSpins;
        vipPoints = profile.vipPoints;
        vipTier = profile.vipTier;
        vipTierStart = profile.vipTierStart;
        vipNextTier = profile.vipNextTier;
        tournamentRank = profile.tournamentRank;
        tournamentScore = profile.tournamentScore;
        tournamentName = profile.tournamentName;
        tournamentEndsAt = profile.tournamentEndsAt;
        tournamentPrizePool = profile.tournamentPrizePool;
        tournamentEntrants = profile.tournamentEntrants;
        achievements = profile.achievements;
        missions = loadedMissions;
        hourlyReward = loadedHourly;
        dailyReward = loadedDaily;
        rewardWheel = loadedWheel;
        liveEvents = loadedEvents;
        tournamentLeaders = profile.leaders;
        claimedQuests.addAll(profile.claimedRewards);
        dailyClaimed = profile.claimedRewards.any(
          (id) => id.startsWith('daily:'),
        );
      });
    } on StateError {
      // The bundled defaults keep widget tests and offline startup usable.
    }
  }

  Future<void> _purchaseStoreProduct(
    PurchasableStoreProductView package,
  ) async {
    final accountId = playerId;
    if (accountId == null || storeBusyProductId != null) return;
    setState(() => storeBusyProductId = package.product.storeProductId);
    try {
      await storeBridge.purchase(
        package.product.storeProductId,
        accountId: accountId,
        consumable: package.product.storeKind == 'consumable',
      );
    } on StateError {
      if (!mounted) return;
      setState(() => storeBusyProductId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Der App Store konnte nicht geöffnet werden.'),
        ),
      );
    }
  }

  Future<void> _restoreStorePurchases() async {
    final accountId = playerId;
    if (accountId == null || storeBusyProductId != null) return;
    try {
      await storeBridge.restore(accountId: accountId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Frühere Käufe werden geprüft.')),
        );
      }
    } on StateError {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Käufe konnten nicht wiederhergestellt werden.'),
          ),
        );
      }
    }
  }

  Future<void> _handleStorePurchaseUpdate(StorePurchaseUpdate update) async {
    if (!mounted) return;
    if (update.status == StorePurchaseStatus.pending) {
      setState(() => storeBusyProductId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Zahlung ausstehend. Coins werden erst nach Bestätigung gutgeschrieben.',
          ),
        ),
      );
      return;
    }
    if (update.status == StorePurchaseStatus.canceled ||
        update.status == StorePurchaseStatus.error) {
      setState(() => storeBusyProductId = null);
      if (update.status == StorePurchaseStatus.error) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Der Kauf konnte nicht abgeschlossen werden.'),
          ),
        );
      }
      return;
    }
    final proof = update.proof;
    if (proof == null) return;
    setState(() => storeBusyProductId = update.productId);
    try {
      final purchase = await api.verifyStorePurchase(
        platform: proof.platform,
        productId: proof.productId,
        transactionId: proof.transactionId,
        verificationToken: proof.verificationToken,
      );
      await storeBridge.complete(proof);
      if (!mounted) return;
      setState(() {
        balance = purchase.coinBalance;
        gems = purchase.gemBalance;
        storeBusyProductId = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('+${_fmt(purchase.coins)} COINS'),
          backgroundColor: const Color(0xff6b2bd9),
        ),
      );
    } on ShopPurchaseException catch (error) {
      if (!mounted) return;
      setState(() => storeBusyProductId = null);
      final message = switch (error.code) {
        'PURCHASE_PENDING' => 'Zahlung ist noch nicht bestätigt.',
        'PRODUCT_LIMIT_REACHED' => 'Dieses Paket wurde bereits gekauft.',
        'PURCHASE_REVOKED' => 'Diese Transaktion wurde zurückerstattet.',
        'PURCHASE_REVIEW_REQUIRED' => 'Der Kauf benötigt eine Kontoprüfung.',
        _ => 'Der Kauf konnte nicht verifiziert werden.',
      };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      // Do not complete an unverified transaction; the provider will redeliver it for a safe retry.
    } on StateError {
      if (!mounted) return;
      setState(() => storeBusyProductId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Kaufprüfung vorübergehend nicht verfügbar. Es wurde nichts verloren.',
          ),
        ),
      );
    }
  }

  @override
  void dispose() {
    unawaited(storeUpdates?.cancel());
    unawaited(pushTokenUpdates?.cancel());
    unawaited(storeBridge.dispose());
    super.dispose();
  }

  Future<void> _purchaseShopOffer(ShopOfferView offer) async {
    if (shopBusyOfferId != null) return;
    setState(() => shopBusyOfferId = offer.id);
    try {
      final purchase = await api.purchaseShopOffer(offer.id);
      if (!mounted) return;
      setState(() {
        balance = purchase.coinBalance;
        gems = purchase.gemBalance;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('+${_fmt(purchase.coins)} COINS'),
          backgroundColor: const Color(0xff6b2bd9),
        ),
      );
    } on ShopPurchaseException catch (error) {
      if (!mounted) return;
      final message = switch (error.code) {
        'INSUFFICIENT_GEMS' => 'Nicht genug Gems für dieses Angebot.',
        'SHOP_OFFER_LIMIT_REACHED' =>
          'Dieses Tagesangebot wurde bereits gekauft.',
        _ => 'Dieses Angebot kann gerade nicht gekauft werden.',
      };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } on StateError {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Der Shop ist gerade nicht erreichbar.')),
      );
    } finally {
      if (mounted) setState(() => shopBusyOfferId = null);
    }
  }

  Future<void> _openRewardCenter() async {
    final result = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => RewardCenterSheet(
        api: api,
        hourly: hourlyReward,
        daily: dailyReward,
        wheel: rewardWheel,
      ),
    );
    if (result != null && mounted) setState(() => balance = result);
    await _loadProfile();
  }

  Future<void> _claimMission(String missionId) async {
    if (rewardBusy) return;
    setState(() => rewardBusy = true);
    try {
      final reward = await api.claimMission(missionId);
      if (!mounted) return;
      setState(() => balance = reward.balance);
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('+${_fmt(reward.coins)} MISSIONS-COINS'),
          backgroundColor: const Color(0xff6b2bd9),
        ),
      );
    } on RewardClaimException {
      if (!mounted) return;
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Diese Mission ist noch nicht einlösbar.'),
        ),
      );
    } finally {
      if (mounted) setState(() => rewardBusy = false);
    }
  }

  Future<void> _claimEventMilestone(String eventId, String milestoneId) async {
    if (rewardBusy) return;
    setState(() => rewardBusy = true);
    try {
      final reward = await api.claimEventMilestone(eventId, milestoneId);
      if (!mounted) return;
      setState(() => balance = reward.balance);
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('+${_fmt(reward.coins)} EVENT-COINS'),
          backgroundColor: const Color(0xff8b3df0),
        ),
      );
    } on RewardClaimException {
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Diese Event-Stufe ist noch nicht einlösbar.'),
        ),
      );
    } finally {
      if (mounted) setState(() => rewardBusy = false);
    }
  }

  Future<void> _play(GameDefinition game) async {
    final result = await Navigator.of(context).push<Map<String, int>>(
      MaterialPageRoute(
        builder: (_) => SlotScreen(
          game: game,
          balance: balance,
          level: level,
          xp: xp,
          vipPoints: vipPoints,
          gems: gems,
        ),
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      balance = result['balance']!;
      level = result['level']!;
      xp = result['xp']!;
      spins = result['spins'] ?? spins;
      totalWon = result['totalWon'] ?? totalWon;
      totalFreeSpins = result['totalFreeSpins'] ?? totalFreeSpins;
      vipPoints = result['vipPoints'] ?? vipPoints;
    });
    await _loadProfile();
  }

  Future<void> _claimReward(String rewardId) async {
    if (rewardBusy) return;
    setState(() => rewardBusy = true);
    try {
      final reward = await api.claimReward(rewardId);
      if (!mounted) return;
      setState(() {
        balance = reward.balance;
        if (rewardId == 'daily') {
          dailyClaimed = true;
        } else {
          claimedQuests.add(rewardId);
        }
      });
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('+${_fmt(reward.coins)} COINS'),
          backgroundColor: const Color(0xff6b2bd9),
        ),
      );
    } on RewardClaimException catch (error) {
      if (!mounted) return;
      if (error.alreadyClaimed) {
        setState(() {
          if (rewardId == 'daily') {
            dailyClaimed = true;
          } else {
            claimedQuests.add(rewardId);
          }
        });
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.alreadyClaimed
                ? 'Belohnung wurde bereits abgeholt.'
                : 'Das Ziel ist noch nicht erreicht.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => rewardBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Column(
          children: [
            TopHud(
              balance: balance,
              level: level,
              xp: xp,
              gems: gems,
              vipTier: vipTier,
              onVipTap: _showVip,
              onNotificationsTap: _openNotificationSettings,
            ),
            Expanded(child: _content()),
            _nav(),
          ],
        ),
      ),
    ),
  );

  Widget _content() => switch (tab) {
    1 => QuestsScreen(
      spins: spins,
      totalWon: totalWon,
      freeSpins: totalFreeSpins,
      claimed: claimedQuests,
      onClaim: _claimReward,
      achievements: achievements,
      missions: missions,
      onMissionClaim: _claimMission,
    ),
    2 => ClubScreen(
      overview: socialOverview,
      messages: clanMessages,
      hasOlderMessages: clanFeedCursor != null,
      busy: socialBusy,
      onAddFriend: (playerId) =>
          _socialAction(() => api.sendFriendRequest(playerId)),
      onAcceptFriend: (requestId) =>
          _socialAction(() => api.acceptFriendRequest(requestId)),
      onJoinClan: (clanId) => _socialAction(() => api.joinClan(clanId)),
      onCreateClan: (name, tag) =>
          _socialAction(() => api.createClan(name, tag)),
      onLeaveClan: () => _socialAction(api.leaveClan),
      onInviteToClan: (playerId) =>
          _socialAction(() => api.inviteToClan(playerId)),
      onAcceptClanInvitation: (invitationId) =>
          _socialAction(() => api.acceptClanInvitation(invitationId)),
      onPostClanMessage: (body) =>
          _socialAction(() => api.postClanMessage(body)),
      onRemoveClanMessage: (messageId) =>
          _socialAction(() => api.removeClanMessage(messageId)),
      onReportClanMessage: (messageId, reason, details) => _socialAction(
        () => api.reportClanMessage(messageId, reason, details),
      ),
      onLoadOlderMessages: _loadOlderClanMessages,
    ),
    3 => EventsScreen(
      events: liveEvents,
      rewardBusy: rewardBusy,
      onClaim: _claimEventMilestone,
      tournamentRank: tournamentRank,
      tournamentScore: tournamentScore,
      tournamentName: tournamentName,
      tournamentEndsAt: tournamentEndsAt,
      tournamentPrizePool: tournamentPrizePool,
      tournamentEntrants: tournamentEntrants,
      leaders: tournamentLeaders,
    ),
    4 => ShopScreen(
      offers: shopOffers,
      gems: gems,
      busyOfferId: shopBusyOfferId,
      onPurchase: _purchaseShopOffer,
      storeProducts: storeProducts,
      storeAvailable: storeBridge.available,
      storeBusyProductId: storeBusyProductId,
      onStorePurchase: _purchaseStoreProduct,
      onRestoreStorePurchases: _restoreStorePurchases,
    ),
    _ => _worldJourney(),
  };

  void _showVip() => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => VipSheet(
      tier: vipTier,
      points: vipPoints,
      tierStart: vipTierStart,
      nextTier: vipNextTier,
    ),
  );

  Widget _worldJourney() => SingleChildScrollView(
    child: SizedBox(
      height: 2100,
      child: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              'assets/world/world_map.png',
              fit: BoxFit.fitWidth,
              repeat: ImageRepeat.repeatY,
              alignment: Alignment.topCenter,
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0x33030b2a),
                    Colors.transparent,
                    const Color(0x99030b2a),
                  ],
                ),
              ),
            ),
          ),
          Positioned(left: 12, width: 190, top: 16, child: _event()),
          Positioned(right: 12, top: 16, child: _reward()),
          for (var index = 0; index < games.length; index++) ...[
            _journeyCard(
              games[index],
              top: 160 + index * 245,
              alignRight: index.isOdd,
              centered: index == 0,
            ),
            if (index < games.length - 1)
              _pathMarker(
                top: 375 + index * 245,
                right: index.isEven ? 84 : 270,
                label: '${index + 2}',
              ),
          ],
        ],
      ),
    ),
  );

  Widget _event() => GestureDetector(
    onTap: activeCampaign?.ctaLabel.toUpperCase() == 'EVENTS'
        ? () => setState(() => tab = 3)
        : null,
    child: Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xff4d167c), Color(0xff180a3e)],
        ),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: const Color(0xffffd24a), width: 2),
        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 10)],
      ),
      child: Column(
        children: [
          Text(
            activeCampaign?.title ?? 'WORLD FORTUNE\nTOURNAMENT',
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.timer_outlined, size: 14),
              const SizedBox(width: 4),
              Text(
                _campaignRemaining(),
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Icon(Icons.emoji_events, size: 30, color: Color(0xffffd24a)),
          Text(
            activeCampaign?.subtitle ?? 'TOP PRIZE 25.000.000',
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xffffd24a),
              fontWeight: FontWeight.w900,
              fontSize: 11,
            ),
          ),
        ],
      ),
    ),
  );

  String _campaignRemaining() {
    final end = activeCampaign?.endsAt;
    if (end == null) return '2d 12h 45m';
    final remaining = end.toUtc().difference(DateTime.now().toUtc());
    if (remaining.isNegative) return 'ENDED';
    return '${remaining.inDays}d ${remaining.inHours.remainder(24)}h';
  }

  Widget _reward() => GestureDetector(
    onTap: rewardBusy ? null : _openRewardCenter,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      width: 100,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: dailyReward?.claimable == true
            ? const Color(0xee6b237f)
            : const Color(0xee302447),
        borderRadius: BorderRadius.circular(48),
        border: Border.all(color: const Color(0xffffdc58), width: 2),
        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 8)],
      ),
      child: Column(
        children: [
          const Text(
            'DAILY REWARD',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Icon(
            dailyReward?.claimable == true
                ? Icons.card_giftcard
                : Icons.schedule_rounded,
            size: 36,
            color: const Color(0xffffdc58),
          ),
          Text(
            dailyReward?.claimable == true
                ? '+${_fmt(dailyReward!.nextCoins)}'
                : 'REWARDS',
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    ),
  );

  Widget _journeyCard(
    GameDefinition game, {
    required double top,
    required bool alignRight,
    bool centered = false,
  }) {
    final locked = level < game.unlockLevel;
    return Positioned(
      top: top,
      left: centered ? 74 : (alignRight ? 148 : 14),
      right: centered ? 74 : (alignRight ? 14 : 148),
      child: GestureDetector(
        onTap: locked ? null : () => _play(game),
        child: Container(
          height: 200,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: game.primary, width: 3),
            boxShadow: const [
              BoxShadow(
                color: Colors.black87,
                blurRadius: 16,
                offset: Offset(0, 7),
              ),
            ],
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.asset(game.asset, fit: BoxFit.cover),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0xf20a041b)],
                  ),
                ),
              ),
              Positioned(
                left: 11,
                right: 11,
                bottom: 9,
                child: Column(
                  children: [
                    Text(
                      game.name,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        shadows: [Shadow(color: game.secondary, blurRadius: 9)],
                      ),
                    ),
                    Text(
                      '${game.jackpot} JACKPOT',
                      style: TextStyle(
                        color: game.primary,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            game.features,
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 15,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: locked ? Colors.grey : game.primary,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            locked ? 'LEVEL ${game.unlockLevel}' : 'PLAY',
                            style: const TextStyle(
                              color: Colors.black,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (locked)
                Container(
                  color: Colors.black54,
                  child: Center(
                    child: Icon(Icons.lock, size: 48, color: game.primary),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _pathMarker({
    required double top,
    required double right,
    required String label,
  }) => Positioned(
    top: top,
    right: right,
    child: Container(
      width: 42,
      height: 42,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xff25124f),
        border: Border.all(color: const Color(0xffffd24a), width: 3),
        boxShadow: const [BoxShadow(color: Colors.black87, blurRadius: 8)],
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xffffd24a),
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
  );

  Widget _nav() => NavigationBar(
    height: 68,
    selectedIndex: tab,
    onDestinationSelected: (value) => setState(() => tab = value),
    backgroundColor: const Color(0xff1a073c),
    indicatorColor: const Color(0xff7a29ba),
    destinations: const [
      NavigationDestination(icon: Icon(Icons.castle), label: 'HOME'),
      NavigationDestination(
        icon: Badge(label: Text('4'), child: Icon(Icons.task_alt)),
        label: 'QUESTS',
      ),
      NavigationDestination(icon: Icon(Icons.groups), label: 'CLUB'),
      NavigationDestination(
        icon: Badge(label: Text('2'), child: Icon(Icons.event)),
        label: 'EVENTS',
      ),
      NavigationDestination(icon: Icon(Icons.shopping_cart), label: 'SHOP'),
    ],
  );

  String _fmt(int value) => value.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
}
