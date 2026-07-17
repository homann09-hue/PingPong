import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'auth_session.dart';

class SpinRoundView {
  SpinRoundView({
    required this.phase,
    required this.index,
    required this.grid,
    required this.win,
    required this.bonusMultiplier,
    required this.bonusMode,
    required this.bonusTier,
    required this.bonusSpots,
    required this.bonusSegment,
    required this.bonusBoardSize,
    required this.bonusPickMultipliers,
    required this.bonusInitialSpots,
    required this.bonusRespinSteps,
    required this.bonusCoins,
    required this.featureLabel,
    required this.winningCells,
    required this.winLabel,
  });

  final String phase;
  final int index;
  final List<List<String>> grid;
  final int win;
  final int? bonusMultiplier;
  final String? bonusMode;
  final String? bonusTier;
  final int? bonusSpots, bonusSegment;
  final int? bonusBoardSize;
  final List<int> bonusPickMultipliers;
  final List<HoldAndWinSpotView> bonusInitialSpots;
  final List<HoldAndWinStepView> bonusRespinSteps;
  final List<HoldAndWinSpotView> bonusCoins;
  final String? featureLabel;
  final Set<String> winningCells;
  final String? winLabel;
}

class HoldAndWinSpotView {
  const HoldAndWinSpotView({required this.position, required this.multiplier});

  final int position, multiplier;
}

class HoldAndWinStepView {
  const HoldAndWinStepView({required this.lives, required this.spots});

  final int lives;
  final List<HoldAndWinSpotView> spots;
}

class SpinResponse {
  SpinResponse({
    required this.grid,
    required this.balance,
    required this.win,
    required this.freeSpins,
    required this.rounds,
    required this.level,
    required this.xp,
    required this.spins,
    required this.totalWon,
    required this.totalFreeSpins,
    required this.vipPoints,
    required this.maxWinReached,
    required this.winClass,
    required this.jackpots,
  });

  final List<List<String>> grid;
  final int balance, win, freeSpins;
  final int level, xp, spins, totalWon, totalFreeSpins, vipPoints;
  final bool maxWinReached;
  final String? winClass;
  final List<JackpotPoolView> jackpots;
  final List<SpinRoundView> rounds;
}

class JackpotPoolView {
  const JackpotPoolView({
    required this.tier,
    required this.amount,
    required this.seedAmount,
  });
  final String tier;
  final int amount, seedAmount;
}

class AchievementView {
  const AchievementView({
    this.category = 'journey',
    this.tier = 'bronze',
    required this.name,
    required this.description,
    required this.rewardId,
    required this.progress,
    required this.target,
    required this.coins,
    required this.completed,
    required this.claimed,
    this.unlocked = true,
  });

  final String category, tier, name, description, rewardId;
  final int progress, target, coins;
  final bool completed, claimed, unlocked;
}

class MissionView {
  const MissionView({
    required this.id,
    required this.cadence,
    required this.tier,
    required this.translationKey,
    required this.metric,
    required this.target,
    required this.progress,
    required this.rewardCoins,
    required this.rewardMissionPoints,
    required this.rewardLoyaltyPoints,
    required this.rewardStamps,
    required this.rewardToolboxes,
    required this.rewardBoosters,
    required this.completed,
    required this.claimed,
    required this.periodKey,
    required this.startsAt,
    required this.endsAt,
    required this.unlocked,
    required this.unlockProgress,
    required this.unlockTarget,
  });

  final String id, cadence, tier, translationKey, metric, periodKey;
  final int target, progress, rewardCoins, rewardMissionPoints;
  final int rewardLoyaltyPoints, rewardStamps, rewardToolboxes, rewardBoosters;
  final DateTime startsAt, endsAt;
  final int unlockProgress, unlockTarget;
  final bool completed, claimed, unlocked;
}

class MissionClaimView {
  const MissionClaimView({
    required this.coins,
    required this.coinBalance,
    required this.missionPoints,
    required this.loyaltyPoints,
    required this.stamps,
    required this.toolboxes,
    required this.boosters,
  });

  final int coins, coinBalance, missionPoints, loyaltyPoints;
  final int stamps, toolboxes, boosters;
}

class ProfileResponse {
  const ProfileResponse({
    required this.playerId,
    required this.balance,
    required this.gems,
    required this.level,
    required this.xp,
    required this.spins,
    required this.totalWon,
    required this.freeSpins,
    required this.vipPoints,
    required this.vipTier,
    required this.vipTierStart,
    required this.vipNextTier,
    required this.economyBalances,
    required this.claimedRewards,
    required this.achievements,
    required this.tournamentRank,
    required this.tournamentScore,
    required this.tournamentName,
    required this.tournamentEndsAt,
    required this.tournamentPrizePool,
    required this.tournamentEntrants,
    required this.leaders,
  });

  final String playerId;
  final int balance, gems, level, xp, spins, totalWon, freeSpins;
  final int vipPoints, vipTierStart, vipNextTier;
  final Map<String, int> economyBalances;
  final String vipTier;
  final Set<String> claimedRewards;
  final List<AchievementView> achievements;
  final int tournamentRank, tournamentScore;
  final String tournamentName;
  final DateTime tournamentEndsAt;
  final int tournamentPrizePool, tournamentEntrants;
  final List<Map<String, dynamic>> leaders;
}

/// A single server-authoritative balance in the player's shared economy.
class WalletBalanceView {
  const WalletBalanceView({required this.currency, required this.balance});

  final String currency;
  final int balance;
}

/// An immutable wallet ledger entry returned by the audit API.
class WalletTransactionView {
  const WalletTransactionView({
    required this.id,
    required this.currency,
    required this.amount,
    required this.direction,
    required this.reason,
    required this.source,
    required this.balanceAfter,
    required this.createdAt,
  });

  final String id, currency, direction, reason, source;
  final int amount, balanceAfter;
  final DateTime createdAt;
}

/// Server-owned progress and reward terms for the Check-&-Win exchange.
class CheckWinStatusView {
  const CheckWinStatusView({
    required this.marks,
    required this.requiredMarks,
    required this.claimable,
    required this.rewardCoins,
    required this.rewardStamps,
  });

  final int marks, requiredMarks, rewardCoins, rewardStamps;
  final bool claimable;
}

/// Result of one idempotent Check-&-Win exchange.
class CheckWinClaimView {
  const CheckWinClaimView({
    required this.coins,
    required this.stamps,
    required this.coinBalance,
    required this.markBalance,
    required this.stampBalance,
  });

  final int coins, stamps, coinBalance, markBalance, stampBalance;
}

/// Server-owned Stamp crafting and XP-booster activation state.
class BoosterStatusView {
  const BoosterStatusView({
    required this.stamps,
    required this.stampsPerBooster,
    required this.boosters,
    required this.activeSpins,
    required this.boostedSpinsPerToken,
    required this.xpMultiplier,
    required this.maxActiveSpins,
    required this.canCraft,
    required this.canActivate,
  });

  final int stamps, stampsPerBooster, boosters, activeSpins;
  final int boostedSpinsPerToken, xpMultiplier, maxActiveSpins;
  final bool canCraft, canActivate;
}

class BoosterCraftView {
  const BoosterCraftView({
    required this.stampBalance,
    required this.boosterBalance,
  });
  final int stampBalance, boosterBalance;
}

class BoosterActivationView {
  const BoosterActivationView({
    required this.boosterBalance,
    required this.activeSpins,
  });
  final int boosterBalance, activeSpins;
}

class LoyaltyRewardOfferView {
  const LoyaltyRewardOfferView({
    required this.id,
    required this.title,
    required this.costLoyaltyPoints,
    required this.rewardCurrency,
    required this.rewardAmount,
    required this.canRedeem,
  });

  final String id, title, rewardCurrency;
  final int costLoyaltyPoints, rewardAmount;
  final bool canRedeem;
}

class LoyaltyRewardsView {
  const LoyaltyRewardsView({
    required this.version,
    required this.loyaltyPoints,
    required this.offers,
  });

  final int version, loyaltyPoints;
  final List<LoyaltyRewardOfferView> offers;
}

class LoyaltyRedemptionView {
  const LoyaltyRedemptionView({
    required this.offerId,
    required this.rewardCurrency,
    required this.rewardAmount,
    required this.loyaltyPointBalance,
    required this.rewardBalance,
  });

  final String offerId, rewardCurrency;
  final int rewardAmount, loyaltyPointBalance, rewardBalance;
}

class HighRollerSourceView {
  const HighRollerSourceView({
    required this.id,
    required this.label,
    required this.points,
    required this.available,
  });
  final String id, label;
  final int? points;
  final bool available;
}

class HighRollerBenefitView {
  const HighRollerBenefitView({
    required this.id,
    required this.label,
    required this.detail,
    required this.active,
  });
  final String id, label, detail;
  final bool active;
}

class HighRollerClubView {
  const HighRollerClubView({
    required this.points,
    required this.entryPoints,
    required this.eligible,
    required this.active,
    required this.activeUntil,
    required this.remainingSeconds,
    required this.sources,
    required this.benefits,
  });
  final int points, entryPoints, remainingSeconds;
  final bool eligible, active;
  final DateTime? activeUntil;
  final List<HighRollerSourceView> sources;
  final List<HighRollerBenefitView> benefits;
}

class ShopOfferView {
  const ShopOfferView({
    required this.id,
    required this.title,
    required this.coins,
    required this.costGems,
    required this.badge,
    required this.featured,
    required this.expiresAt,
  });

  final String id, title, badge;
  final int coins, costGems;
  final bool featured;
  final DateTime? expiresAt;
}

class ShopPurchaseView {
  const ShopPurchaseView({
    required this.offerId,
    required this.coins,
    required this.gemsSpent,
    required this.coinBalance,
    required this.gemBalance,
  });

  final String offerId;
  final int coins, gemsSpent, coinBalance, gemBalance;
}

class ShopPurchaseException implements Exception {
  const ShopPurchaseException(this.code);
  final String code;
}

class StoreProductView {
  const StoreProductView({
    required this.key,
    required this.title,
    required this.description,
    required this.badge,
    required this.featured,
    required this.grantCoins,
    required this.grantGems,
    required this.purchaseLimit,
    required this.storeKind,
    required this.storeProductId,
  });
  final String key,
      title,
      description,
      badge,
      purchaseLimit,
      storeKind,
      storeProductId;
  final bool featured;
  final int grantCoins, grantGems;
}

class PurchasableStoreProductView {
  const PurchasableStoreProductView({
    required this.product,
    required this.localizedPrice,
  });
  final StoreProductView product;
  final String localizedPrice;
}

class VerifiedStorePurchaseView {
  const VerifiedStorePurchaseView({
    required this.coins,
    required this.gems,
    required this.coinBalance,
    required this.gemBalance,
    required this.replayed,
  });
  final int coins, gems, coinBalance, gemBalance;
  final bool replayed;
}

class PushPreferencesView {
  const PushPreferencesView({
    required this.enabled,
    required this.marketing,
    required this.rewards,
    required this.social,
    required this.quietHoursStartMinutes,
    required this.quietHoursEndMinutes,
    required this.timeZone,
  });

  final bool enabled, marketing, rewards, social;
  final int? quietHoursStartMinutes, quietHoursEndMinutes;
  final String timeZone;
}

class RewardClaimResponse {
  const RewardClaimResponse({required this.coins, required this.balance});

  final int coins;
  final int balance;
}

class TimedRewardView {
  const TimedRewardView({
    required this.type,
    required this.claimable,
    required this.availableAt,
    required this.nextCoins,
    required this.streak,
    required this.cyclePosition,
    required this.claimsTowardWheel,
  });
  final String type;
  final bool claimable;
  final DateTime availableAt;
  final int nextCoins, streak, cyclePosition, claimsTowardWheel;
}

class TimedRewardClaimView {
  const TimedRewardClaimView({
    required this.coins,
    required this.balance,
    required this.wheelUnlocked,
  });
  final int coins, balance;
  final bool wheelUnlocked;
}

class WheelSegmentView {
  const WheelSegmentView({
    required this.id,
    required this.currency,
    required this.amount,
  });
  final String id, currency;
  final int amount;
}

class WheelView {
  const WheelView({required this.availableSpins, required this.segments});
  final int availableSpins;
  final List<WheelSegmentView> segments;
}

class WheelSpinView {
  const WheelSpinView({
    required this.segmentId,
    required this.currency,
    required this.amount,
    required this.balanceAfter,
    required this.availableSpins,
  });
  final String segmentId, currency;
  final int amount, balanceAfter, availableSpins;
}

class EventMilestoneView {
  const EventMilestoneView({
    required this.id,
    required this.target,
    required this.rewardCoins,
    required this.completed,
    required this.claimed,
  });
  final String id;
  final int target, rewardCoins;
  final bool completed, claimed;
}

class LiveEventView {
  const LiveEventView({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.cadence,
    required this.metric,
    required this.accent,
    required this.periodKey,
    required this.startsAt,
    required this.endsAt,
    required this.progress,
    required this.milestones,
  });
  final String id, title, subtitle, cadence, metric, accent, periodKey;
  final DateTime startsAt, endsAt;
  final int progress;
  final List<EventMilestoneView> milestones;
}

class EventClaimView {
  const EventClaimView({required this.coins, required this.balance});
  final int coins, balance;
}

class RewardClaimException implements Exception {
  const RewardClaimException(this.code);
  final String code;
  bool get alreadyClaimed => code == 'REWARD_ALREADY_CLAIMED';
}

class SlotPaytable {
  const SlotPaytable({
    required this.lines,
    required this.evaluationType,
    required this.ways,
    required this.minimumWays,
    required this.variableWays,
    required this.targetRtp,
    required this.volatility,
    required this.expectedHitFrequency,
    required this.maxWinMultiplier,
    required this.mathModelVersion,
    required this.betSteps,
    required this.symbols,
  });

  final int lines;
  final String evaluationType;
  final int? ways, minimumWays;
  final bool variableWays;
  final double targetRtp, expectedHitFrequency;
  final String volatility;
  final int maxWinMultiplier;
  final String mathModelVersion;
  final List<int> betSteps;
  final Map<String, Map<String, dynamic>> symbols;
}

class SocialPlayerView {
  const SocialPlayerView({
    required this.id,
    required this.displayName,
    required this.level,
    required this.online,
  });
  final String id, displayName;
  final int level;
  final bool online;
}

class FriendRequestView {
  const FriendRequestView({required this.id, required this.player});
  final String id;
  final SocialPlayerView player;
}

class ClanView {
  const ClanView({
    required this.id,
    required this.name,
    required this.tag,
    required this.memberCount,
    required this.memberLimit,
    required this.weeklyScore,
    required this.role,
  });
  final String id, name, tag;
  final int memberCount, memberLimit, weeklyScore;
  final String? role;
}

class ClanInvitationView {
  const ClanInvitationView({
    required this.id,
    required this.clan,
    required this.inviter,
    required this.expiresAt,
  });
  final String id;
  final ClanView clan;
  final SocialPlayerView inviter;
  final DateTime expiresAt;
}

class ClanMemberView {
  const ClanMemberView({
    required this.player,
    required this.role,
    required this.joinedAt,
  });
  final SocialPlayerView player;
  final String role;
  final DateTime joinedAt;
}

class ClanMessageView {
  const ClanMessageView({
    required this.id,
    required this.author,
    required this.body,
    required this.status,
    required this.createdAt,
  });
  final String id, status;
  final SocialPlayerView author;
  final String? body;
  final DateTime createdAt;
}

class ClanFeedPageView {
  const ClanFeedPageView({required this.messages, required this.nextCursor});
  final List<ClanMessageView> messages;
  final String? nextCursor;
}

class SocialOverviewView {
  const SocialOverviewView({
    required this.player,
    required this.friends,
    required this.incomingRequests,
    required this.suggestions,
    required this.currentClan,
    required this.discoverClans,
    required this.incomingClanInvitations,
  });
  final SocialPlayerView player;
  final List<SocialPlayerView> friends, suggestions;
  final List<FriendRequestView> incomingRequests;
  final ClanView? currentClan;
  final List<ClanView> discoverClans;
  final List<ClanInvitationView> incomingClanInvitations;
}

class LiveOpsCampaignView {
  const LiveOpsCampaignView({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.ctaLabel,
    required this.endsAt,
  });
  final String id, title, subtitle, ctaLabel;
  final DateTime endsAt;
}

class CasinoApi {
  static const _configuredBase = String.fromEnvironment('API_URL');
  static const _appVersion = String.fromEnvironment(
    'APP_VERSION',
    defaultValue: '0.1.0',
  );
  static final base = _configuredBase.isNotEmpty
      ? _configuredBase
      : kIsWeb
      ? Uri.base.origin
      : defaultTargetPlatform == TargetPlatform.android
      ? 'http://10.0.2.2:8080'
      : 'http://localhost:8080';
  static final _sharedSession = AuthSessionManager(
    baseUrl: base,
    client: http.Client(),
    storage: createDefaultSessionStorage(),
    platform: currentClientPlatform(),
  );
  static final _sharedClient = AuthenticatedHttpClient(
    http.Client(),
    _sharedSession,
  );

  CasinoApi({AuthenticatedHttpClient? client})
    : _client = client ?? _sharedClient;

  final AuthenticatedHttpClient _client;
  final Random _random = Random.secure();

  Future<SlotPaytable> paytable(String gameId) async {
    final response = await _client.get(
      Uri.parse('$base/v1/slots/$gameId/paytable'),
    );
    if (response.statusCode != 200) {
      throw StateError('Paytable konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final rawSymbols = data['symbols'] as Map<String, dynamic>;
    final evaluation = data['evaluation'] as Map<String, dynamic>?;
    final evaluationType = evaluation?['type'] as String? ?? 'lines';
    return SlotPaytable(
      lines: data['lines'] as int,
      evaluationType: evaluationType,
      ways: evaluationType == 'ways' ? evaluation!['ways'] as int : null,
      minimumWays: evaluation?['minimumWays'] as int?,
      variableWays: evaluation?['variable'] as bool? ?? false,
      targetRtp: (data['targetRtp'] as num).toDouble(),
      volatility: data['volatility'] as String,
      expectedHitFrequency: (data['expectedHitFrequency'] as num).toDouble(),
      maxWinMultiplier: data['maxWinMultiplier'] as int,
      mathModelVersion: data['mathModelVersion'] as String,
      betSteps: ((data['bet'] as Map<String, dynamic>)['steps'] as List)
          .cast<int>(),
      symbols: rawSymbols.map(
        (key, value) => MapEntry(key, value as Map<String, dynamic>),
      ),
    );
  }

  Future<SpinResponse> spin(
    String gameId,
    int bet, {
    bool bonusBuy = false,
  }) async {
    final response = await _client.post(
      Uri.parse('$base/v1/slots/$gameId/spins'),
      headers: {'content-type': 'application/json', 'idempotency-key': _uuid()},
      body: jsonEncode({'bet': bet, 'bonusBuy': bonusBuy}),
    );
    if (response.statusCode != 200) {
      throw StateError('Spin fehlgeschlagen (${response.statusCode})');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final spin = data['spin'] as Map<String, dynamic>;
    final progression = data['progression'] as Map<String, dynamic>;
    final rounds = (spin['rounds'] as List).map((value) {
      final round = value as Map<String, dynamic>;
      final events = (round['events'] as List).cast<Map<String, dynamic>>();
      final bonusEvents = events.where(
        (event) => event['type'] == 'bonus.awarded',
      );

      final bonusData = bonusEvents.isEmpty
          ? null
          : bonusEvents.first['data'] as Map<String, dynamic>;
      final eventTypes = events.map((event) => event['type'] as String).toSet();
      final multiplierEvents = events.where(
        (event) => event['type'] == 'multiplier.applied',
      );
      final multiplierData = multiplierEvents.isEmpty
          ? null
          : multiplierEvents.last['data'] as Map<String, dynamic>;
      final upgradeEvents = events
          .where((event) => event['type'] == 'symbol.upgraded')
          .toList();
      final upgradeLabel = upgradeEvents.isEmpty
          ? null
          : 'SYMBOL UPGRADE • ${upgradeEvents.map((event) {
              final data = event['data'] as Map<String, dynamic>;
              return '${data['from']}→${data['to']}';
            }).join(' • ')}';
      final ladderEvents = events.where((event) {
        if (event['type'] != 'free_spins.modified') return false;
        final data = event['data'] as Map<String, dynamic>;
        return data['mode'] == 'multiplier_ladder';
      });
      final ladderData = ladderEvents.isEmpty
          ? null
          : ladderEvents.last['data'] as Map<String, dynamic>;
      final extraWildEvents = events.where((event) {
        if (event['type'] != 'free_spins.modified') return false;
        final data = event['data'] as Map<String, dynamic>;
        return data['mode'] == 'extra_wilds';
      });
      final extraWildData = extraWildEvents.isEmpty
          ? null
          : extraWildEvents.last['data'] as Map<String, dynamic>;
      final layoutEvents = events.where(
        (event) => event['type'] == 'layout.changed',
      );
      final layoutData = layoutEvents.isEmpty
          ? null
          : layoutEvents.last['data'] as Map<String, dynamic>;
      final mysteryEvents = events.where(
        (event) => event['type'] == 'mystery.revealed',
      );
      final mysteryData = mysteryEvents.isEmpty
          ? null
          : mysteryEvents.last['data'] as Map<String, dynamic>;
      final wins = (round['wins'] as List).cast<Map<String, dynamic>>();
      final winningCells = <String>{};
      for (final win in wins) {
        for (final cell in win['cells'] as List) {
          final coordinates = cell as List;
          winningCells.add('${coordinates[0]}:${coordinates[1]}');
        }
      }
      for (final event in events.where(
        (event) => event['type'] == 'wild.stacked',
      )) {
        final data = event['data'] as Map<String, dynamic>;
        final reel = data['reel'] as int;
        final startRow = data['startRow'] as int;
        final size = data['size'] as int;
        for (var row = startRow; row < startRow + size; row++) {
          winningCells.add('$reel:$row');
        }
      }
      for (final event in multiplierEvents.where((event) {
        final data = event['data'] as Map<String, dynamic>;
        return data['source'] == 'multiplier_symbols';
      })) {
        final data = event['data'] as Map<String, dynamic>;
        for (final encoded in (data['positions'] as String).split(',')) {
          winningCells.add(encoded.split('=').first);
        }
      }
      if (mysteryData != null) {
        for (final encoded in (mysteryData['positions'] as String).split(',')) {
          winningCells.add(encoded);
        }
      }
      if (extraWildData != null) {
        for (final encoded in (extraWildData['positions'] as String).split(
          ',',
        )) {
          winningCells.add(encoded);
        }
      }
      final lineWins = wins.where((win) => win['kind'] == 'line').toList();
      final waysWins = wins.where((win) => win['kind'] == 'ways').toList();
      final scatterWins = wins
          .where((win) => win['kind'] == 'scatter')
          .toList();
      final winLabel = lineWins.isNotEmpty
          ? '${lineWins.first['count']}× ${lineWins.first['symbol']}  •  ${lineWins.length} ${lineWins.length == 1 ? 'LINIE' : 'LINIEN'}'
          : waysWins.isNotEmpty
          ? '${waysWins.first['ways']} WAYS • ${waysWins.first['count']}× ${waysWins.first['symbol']}'
          : scatterWins.isNotEmpty
          ? '${scatterWins.first['count']}× SCATTER'
          : null;
      return SpinRoundView(
        phase: round['phase'] as String,
        index: round['index'] as int,
        grid: _grid(round['grid']),
        win: round['totalWin'] as int,
        bonusMultiplier: bonusData?['multiplier'] as int?,
        bonusMode: bonusData?['mode'] as String?,
        bonusTier: bonusData?['tier'] as String?,
        bonusSpots: bonusData?['spots'] as int?,
        bonusSegment: bonusData?['segment'] as int?,
        bonusBoardSize: bonusData?['boardSize'] as int?,
        bonusPickMultipliers: _integerList(bonusData?['picks'] as String?),
        bonusInitialSpots: _holdAndWinSpots(
          bonusData?['initialSpots'] as String?,
        ),
        bonusRespinSteps: _holdAndWinSteps(
          bonusData?['respinSteps'] as String?,
        ),
        bonusCoins: _holdAndWinSpots(bonusData?['coins'] as String?),
        featureLabel: eventTypes.contains('max_win.reached')
            ? 'MAX WIN'
            : eventTypes.contains('wild.walked')
            ? 'WALKING WILD'
            : eventTypes.contains('wild.stacked')
            ? 'STACKED WILDS'
            : eventTypes.contains('wild.stuck')
            ? 'STICKY WILDS'
            : eventTypes.contains('mystery.revealed')
            ? 'MYSTERY → ${mysteryData?['target']} • ${mysteryData?['count']} SYMBOLE'
            // The explicit branch keeps the feature-priority chain readable.
            // ignore: prefer_if_null_operators
            : upgradeLabel != null
            ? upgradeLabel
            : eventTypes.contains('free_spins.modified')
            ? extraWildData != null
                  ? 'SPECIAL REELS • +${extraWildData['count']} ICE WILD'
                  : ladderData == null
                  ? 'SPECIAL FREE-SPIN REELS'
                  : 'ULTIMATE FREE SPIN ${ladderData['spin']} • ×${ladderData['multiplier']}'
            : eventTypes.contains('multiplier.applied')
            ? switch (multiplierData?['source']) {
                'cascade' => 'CASCADE ×${multiplierData?['multiplier']}',
                'free_spin' => 'FREE SPINS ×${multiplierData?['multiplier']}',
                'multiplier_symbols' =>
                  'SYMBOL MULTIPLIER ×${multiplierData?['multiplier']}',
                _ => 'WILD MULTIPLIER ×${multiplierData?['multiplier']}',
              }
            : eventTypes.contains('respin.started')
            ? 'RESPIN'
            : layoutData != null
            ? 'MEGAWAYS • ${layoutData['ways']} WAYS'
            : null,
        winningCells: winningCells,
        winLabel: winLabel,
      );
    }).toList();
    return SpinResponse(
      grid: _grid(spin['grid']),
      balance: data['coinBalance'] as int,
      win: spin['totalWin'] as int,
      freeSpins: spin['freeSpinsPlayed'] as int,
      rounds: rounds,
      level: progression['level'] as int,
      xp: progression['xp'] as int,
      spins: progression['spins'] as int,
      totalWon: progression['totalWon'] as int,
      totalFreeSpins: progression['freeSpins'] as int,
      vipPoints: progression['vipPoints'] as int,
      maxWinReached: spin['maxWinReached'] as bool,
      winClass: spin['winClass'] as String?,
      jackpots: _jackpotPools(data['jackpots'] as List),
    );
  }

  Future<List<JackpotPoolView>> jackpots() async {
    final response = await _client.get(Uri.parse('$base/v1/jackpots'));
    if (response.statusCode != 200) {
      throw StateError('Jackpots konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return _jackpotPools(data['jackpots'] as List);
  }

  Future<ProfileResponse> profile() async {
    final response = await _client.get(Uri.parse('$base/v1/profile'));
    if (response.statusCode != 200) {
      throw StateError('Profil konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final progression = data['progression'] as Map<String, dynamic>;
    final vip = data['vip'] as Map<String, dynamic>;
    final tournament = data['tournament'] as Map<String, dynamic>;
    return ProfileResponse(
      playerId: data['playerId'] as String,
      balance: data['coinBalance'] as int,
      gems: data['gemBalance'] as int,
      level: progression['level'] as int,
      xp: progression['xp'] as int,
      spins: progression['spins'] as int,
      totalWon: progression['totalWon'] as int,
      freeSpins: progression['freeSpins'] as int,
      vipPoints: progression['vipPoints'] as int,
      vipTier: vip['tier'] as String,
      vipTierStart: vip['tierStart'] as int,
      vipNextTier: vip['nextTierPoints'] as int,
      economyBalances: {
        for (final entry
            in (data['balances'] as List).cast<Map<String, dynamic>>())
          entry['currency'] as String: entry['balance'] as int,
      },
      claimedRewards: (data['claimedRewards'] as List).cast<String>().toSet(),
      achievements: (data['achievements'] as List).map((value) {
        final item = value as Map<String, dynamic>;
        return AchievementView(
          category: item['category'] as String? ?? 'journey',
          tier: item['tier'] as String? ?? 'bronze',
          name: item['name'] as String,
          description: item['description'] as String,
          rewardId: item['rewardId'] as String,
          progress: item['progress'] as int,
          target: item['target'] as int,
          coins: item['coins'] as int,
          completed: item['completed'] as bool,
          claimed: item['claimed'] as bool,
          unlocked: item['unlocked'] as bool? ?? true,
        );
      }).toList(),
      tournamentRank: tournament['rank'] as int,
      tournamentScore: tournament['score'] as int,
      tournamentName: tournament['name'] as String,
      tournamentEndsAt: DateTime.parse(tournament['endsAt'] as String),
      tournamentPrizePool: tournament['prizePool'] as int,
      tournamentEntrants: tournament['entrants'] as int,
      leaders: (tournament['leaders'] as List).cast<Map<String, dynamic>>(),
    );
  }

  /// Loads the complete shared wallet in the stable order defined by the API.
  Future<List<WalletBalanceView>> wallet() async {
    final response = await _client.get(Uri.parse('$base/v1/wallet'));
    if (response.statusCode != 200) {
      throw StateError('Wallet konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['balances'] as List)
        .map((value) {
          final balance = value as Map<String, dynamic>;
          return WalletBalanceView(
            currency: balance['currency'] as String,
            balance: balance['balance'] as int,
          );
        })
        .toList(growable: false);
  }

  /// Loads the newest immutable wallet movements for account transparency.
  Future<List<WalletTransactionView>> walletTransactions({
    int limit = 50,
  }) async {
    final response = await _client.get(
      Uri.parse('$base/v1/wallet/transactions?limit=$limit'),
    );
    if (response.statusCode != 200) {
      throw StateError('Wallet-Verlauf konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['transactions'] as List)
        .map((value) {
          final transaction = value as Map<String, dynamic>;
          return WalletTransactionView(
            id: transaction['id'] as String,
            currency: transaction['currency'] as String,
            amount: transaction['amount'] as int,
            direction: transaction['direction'] as String,
            reason: transaction['reason'] as String,
            source: transaction['source'] as String,
            balanceAfter: transaction['balanceAfter'] as int,
            createdAt: DateTime.parse(transaction['createdAt'] as String),
          );
        })
        .toList(growable: false);
  }

  Future<CheckWinStatusView> checkWinStatus() async {
    final response = await _client.get(Uri.parse('$base/v1/economy/check-win'));
    if (response.statusCode != 200) {
      throw StateError('Check & Win konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return CheckWinStatusView(
      marks: data['marks'] as int,
      requiredMarks: data['requiredMarks'] as int,
      claimable: data['claimable'] as bool,
      rewardCoins: data['rewardCoins'] as int,
      rewardStamps: data['rewardStamps'] as int,
    );
  }

  Future<CheckWinClaimView> claimCheckWin() async {
    final response = await _client.post(
      Uri.parse('$base/v1/economy/check-win/claim'),
      headers: {'idempotency-key': _uuid()},
    );
    if (response.statusCode != 200) {
      throw StateError('Check-&-Win-Belohnung konnte nicht eingelöst werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return CheckWinClaimView(
      coins: data['coins'] as int,
      stamps: data['stamps'] as int,
      coinBalance: data['coinBalance'] as int,
      markBalance: data['markBalance'] as int,
      stampBalance: data['stampBalance'] as int,
    );
  }

  Future<BoosterStatusView> boosterStatus() async {
    final response = await _client.get(Uri.parse('$base/v1/economy/boosters'));
    if (response.statusCode != 200) {
      throw StateError('Booster konnten nicht geladen werden');
    }
    return _boosterStatus(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<BoosterCraftView> craftBooster() async {
    final response = await _client.post(
      Uri.parse('$base/v1/economy/boosters/craft'),
      headers: {'idempotency-key': _uuid()},
    );
    if (response.statusCode != 200) {
      throw StateError('Booster konnte nicht hergestellt werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return BoosterCraftView(
      stampBalance: data['stampBalance'] as int,
      boosterBalance: data['boosterBalance'] as int,
    );
  }

  Future<BoosterActivationView> activateBooster() async {
    final response = await _client.post(
      Uri.parse('$base/v1/economy/boosters/activate'),
      headers: {'idempotency-key': _uuid()},
    );
    if (response.statusCode != 200) {
      throw StateError('Booster konnte nicht aktiviert werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return BoosterActivationView(
      boosterBalance: data['boosterBalance'] as int,
      activeSpins: data['activeSpins'] as int,
    );
  }

  Future<LoyaltyRewardsView> loyaltyRewards() async {
    final response = await _client.get(
      Uri.parse('$base/v1/economy/loyalty-rewards'),
    );
    if (response.statusCode != 200) {
      throw StateError('Loyalty Rewards konnten nicht geladen werden');
    }
    return _loyaltyRewards(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<LoyaltyRedemptionView> redeemLoyaltyReward(String offerId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/economy/loyalty-rewards/$offerId/redeem'),
      headers: {'idempotency-key': _uuid()},
    );
    if (response.statusCode != 200) {
      throw StateError('Loyalty Reward konnte nicht eingelöst werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return LoyaltyRedemptionView(
      offerId: data['offerId'] as String,
      rewardCurrency: data['rewardCurrency'] as String,
      rewardAmount: data['rewardAmount'] as int,
      loyaltyPointBalance: data['loyaltyPointBalance'] as int,
      rewardBalance: data['rewardBalance'] as int,
    );
  }

  Future<HighRollerClubView> highRollerClub() async {
    final response = await _client.get(
      Uri.parse('$base/v1/economy/high-roller-club'),
    );
    if (response.statusCode != 200) {
      throw StateError('High Roller Club konnte nicht geladen werden');
    }
    return _highRollerClub(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<HighRollerClubView> activateHighRollerClub() async {
    final response = await _client.post(
      Uri.parse('$base/v1/economy/high-roller-club/activate'),
      headers: {'idempotency-key': _uuid()},
    );
    if (response.statusCode != 200) {
      throw StateError('High Roller Club konnte nicht aktiviert werden');
    }
    return _highRollerClub(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<List<ShopOfferView>> shopOffers() async {
    final response = await _client.get(Uri.parse('$base/v1/shop/offers'));
    if (response.statusCode != 200) {
      throw StateError('Shop-Angebote konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['offers'] as List)
        .map((value) {
          final offer = value as Map<String, dynamic>;
          final expiresAt = offer['expiresAt'] as String?;
          return ShopOfferView(
            id: offer['id'] as String,
            title: offer['title'] as String,
            coins: offer['coins'] as int,
            costGems: offer['costGems'] as int,
            badge: offer['badge'] as String,
            featured: offer['featured'] as bool,
            expiresAt: expiresAt == null ? null : DateTime.parse(expiresAt),
          );
        })
        .toList(growable: false);
  }

  Future<List<StoreProductView>> storeProducts(String platform) async {
    final response = await _client.get(
      Uri.parse('$base/v1/store/products?platform=$platform'),
    );
    if (response.statusCode != 200) {
      throw StateError('Store-Katalog konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['products'] as List)
        .map((value) {
          final item = value as Map<String, dynamic>;
          return StoreProductView(
            key: item['key'] as String,
            title: item['title'] as String,
            description: item['description'] as String,
            badge: item['badge'] as String,
            featured: item['featured'] as bool,
            grantCoins: item['grantCoins'] as int,
            grantGems: item['grantGems'] as int,
            purchaseLimit: item['purchaseLimit'] as String,
            storeKind: item['storeKind'] as String,
            storeProductId: item['storeProductId'] as String,
          );
        })
        .toList(growable: false);
  }

  Future<VerifiedStorePurchaseView> verifyStorePurchase({
    required String platform,
    required String productId,
    required String transactionId,
    required String verificationToken,
  }) async {
    final response = await _client.post(
      Uri.parse('$base/v1/store/purchases/verify'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'platform': platform,
        'storeProductId': productId,
        'transactionId': transactionId,
        'verificationToken': verificationToken,
      }),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 409 || response.statusCode == 422) {
      throw ShopPurchaseException(
        data['code'] as String? ?? 'PURCHASE_REJECTED',
      );
    }
    if (response.statusCode != 200) {
      throw StateError('Store-Kauf konnte nicht verifiziert werden');
    }
    return VerifiedStorePurchaseView(
      coins: data['coins'] as int,
      gems: data['gems'] as int,
      coinBalance: data['coinBalance'] as int,
      gemBalance: data['gemBalance'] as int,
      replayed: data['replayed'] as bool,
    );
  }

  Future<SocialOverviewView> socialOverview() async {
    final response = await _client.get(Uri.parse('$base/v1/social/overview'));
    if (response.statusCode != 200) {
      throw StateError('Social-Daten konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return SocialOverviewView(
      player: _socialPlayer(data['player']),
      friends: (data['friends'] as List).map(_socialPlayer).toList(),
      incomingRequests: (data['incomingRequests'] as List).map((value) {
        final item = value as Map<String, dynamic>;
        return FriendRequestView(
          id: item['id'] as String,
          player: _socialPlayer(item['player']),
        );
      }).toList(),
      suggestions: (data['suggestions'] as List).map(_socialPlayer).toList(),
      currentClan: data['currentClan'] == null
          ? null
          : _clan(data['currentClan']),
      discoverClans: (data['discoverClans'] as List).map(_clan).toList(),
      incomingClanInvitations: (data['incomingClanInvitations'] as List)
          .map((value) {
            final invitation = value as Map<String, dynamic>;
            return ClanInvitationView(
              id: invitation['id'] as String,
              clan: _clan(invitation['clan']),
              inviter: _socialPlayer(invitation['inviter']),
              expiresAt: DateTime.parse(invitation['expiresAt'] as String),
            );
          })
          .toList(growable: false),
    );
  }

  Future<List<LiveOpsCampaignView>> liveOpsCampaigns() async {
    final response = await _client.get(Uri.parse('$base/v1/liveops'));
    if (response.statusCode != 200) {
      throw StateError('LiveOps-Kampagnen konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['campaigns'] as List)
        .map((value) {
          final campaign = value as Map<String, dynamic>;
          final creative = campaign['creative'] as Map<String, dynamic>;
          return LiveOpsCampaignView(
            id: campaign['id'] as String,
            title: creative['title'] as String,
            subtitle: creative['subtitle'] as String,
            ctaLabel: creative['ctaLabel'] as String,
            endsAt: DateTime.parse(campaign['endsAt'] as String),
          );
        })
        .toList(growable: false);
  }

  Future<PushPreferencesView> pushPreferences() async {
    final response = await _client.get(
      Uri.parse('$base/v1/messaging/preferences'),
    );
    if (response.statusCode != 200) {
      throw StateError('Benachrichtigungseinstellungen nicht verfügbar');
    }
    return _pushPreferences(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<PushPreferencesView> updatePushPreferences(
    PushPreferencesView preferences,
  ) async {
    final response = await _client.put(
      Uri.parse('$base/v1/messaging/preferences'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'enabled': preferences.enabled,
        'marketing': preferences.marketing,
        'rewards': preferences.rewards,
        'social': preferences.social,
        'quietHoursStartMinutes': preferences.quietHoursStartMinutes,
        'quietHoursEndMinutes': preferences.quietHoursEndMinutes,
        'timeZone': preferences.timeZone,
      }),
    );
    if (response.statusCode != 200) {
      throw StateError('Benachrichtigungseinstellungen nicht gespeichert');
    }
    return _pushPreferences(jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Called by the native/web permission bootstrap after it obtains a real
  /// provider token. The demo never fabricates one.
  Future<void> registerPushInstallation({
    required String installationId,
    required String provider,
    required String token,
  }) async {
    final platform = kIsWeb
        ? 'web'
        : defaultTargetPlatform == TargetPlatform.iOS
        ? 'ios'
        : 'android';
    final response = await _client.put(
      Uri.parse('$base/v1/messaging/installations/current'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'installationId': installationId,
        'platform': platform,
        'provider': provider,
        'token': token,
      }),
    );
    if (response.statusCode != 200) {
      throw StateError('Push-Gerät konnte nicht registriert werden');
    }
  }

  /// Stable identifier for this app installation.
  Future<String> installationId() => _sharedSession.installationId();

  Future<void> removePushInstallation(String installationId) async {
    final response = await _client.delete(
      Uri.parse('$base/v1/messaging/installations/$installationId'),
    );
    if (response.statusCode != 204 && response.statusCode != 404) {
      throw StateError('Push-Gerät konnte nicht abgemeldet werden');
    }
  }

  Future<void> sendFriendRequest(String playerId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/social/friend-requests'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'playerId': playerId}),
    );
    if (response.statusCode != 201) {
      throw StateError('Freundschaftsanfrage fehlgeschlagen');
    }
  }

  Future<void> acceptFriendRequest(String requestId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/social/friend-requests/$requestId/accept'),
    );
    if (response.statusCode != 200) {
      throw StateError('Freundschaftsanfrage konnte nicht angenommen werden');
    }
  }

  Future<void> joinClan(String clanId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/clans/$clanId/join'),
    );
    if (response.statusCode != 200) {
      throw StateError('Clan-Beitritt fehlgeschlagen');
    }
  }

  Future<void> createClan(String name, String tag) async {
    final response = await _client.post(
      Uri.parse('$base/v1/clans'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'name': name, 'tag': tag}),
    );
    if (response.statusCode != 201) {
      throw StateError('Clan konnte nicht erstellt werden');
    }
  }

  Future<void> leaveClan() async {
    final response = await _client.post(Uri.parse('$base/v1/clans/leave'));
    if (response.statusCode != 204) {
      throw StateError('Clan konnte nicht verlassen werden');
    }
  }

  Future<void> inviteToClan(String playerId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/clans/invitations'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'playerId': playerId}),
    );
    if (response.statusCode != 201) {
      throw StateError('Clan-Einladung konnte nicht gesendet werden');
    }
  }

  Future<void> acceptClanInvitation(String invitationId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/clans/invitations/$invitationId/accept'),
    );
    if (response.statusCode != 200) {
      throw StateError('Clan-Einladung konnte nicht angenommen werden');
    }
  }

  Future<List<ClanMemberView>> clanMembers() async {
    final response = await _client.get(Uri.parse('$base/v1/clans/members'));
    if (response.statusCode != 200) {
      throw StateError('Clan-Mitglieder konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['members'] as List)
        .map((value) {
          final member = value as Map<String, dynamic>;
          return ClanMemberView(
            player: _socialPlayer(member['player']),
            role: member['role'] as String,
            joinedAt: DateTime.parse(member['joinedAt'] as String),
          );
        })
        .toList(growable: false);
  }

  Future<void> updateClanMemberRole(String playerId, String role) async {
    final response = await _client.put(
      Uri.parse('$base/v1/clans/members/$playerId/role'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'role': role}),
    );
    if (response.statusCode != 200) {
      throw StateError('Clan-Rolle konnte nicht geändert werden');
    }
  }

  Future<void> removeClanMember(String playerId) async {
    final response = await _client.delete(
      Uri.parse('$base/v1/clans/members/$playerId'),
    );
    if (response.statusCode != 204) {
      throw StateError('Clan-Mitglied konnte nicht entfernt werden');
    }
  }

  Future<void> transferClanOwnership(String playerId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/clans/ownership-transfer'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'playerId': playerId}),
    );
    if (response.statusCode != 200) {
      throw StateError('Clan-Führung konnte nicht übertragen werden');
    }
  }

  Future<ClanFeedPageView> clanFeed({String? cursor, int limit = 30}) async {
    final query = <String, String>{'limit': '$limit'};
    if (cursor != null) query['cursor'] = cursor;
    final response = await _client.get(
      Uri.parse('$base/v1/clans/feed').replace(queryParameters: query),
    );
    if (response.statusCode != 200) {
      throw StateError('Clan-Feed konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return ClanFeedPageView(
      messages: (data['messages'] as List)
          .map((value) {
            final message = value as Map<String, dynamic>;
            return ClanMessageView(
              id: message['id'] as String,
              author: _socialPlayer(message['author']),
              body: message['body'] as String?,
              status: message['status'] as String,
              createdAt: DateTime.parse(message['createdAt'] as String),
            );
          })
          .toList(growable: false),
      nextCursor: data['nextCursor'] as String?,
    );
  }

  Future<void> postClanMessage(String body) async {
    final response = await _client.post(
      Uri.parse('$base/v1/clans/feed'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'body': body}),
    );
    if (response.statusCode != 201) {
      throw StateError('Clan-Nachricht konnte nicht gesendet werden');
    }
  }

  Future<void> removeClanMessage(String messageId) async {
    final response = await _client.delete(
      Uri.parse('$base/v1/clans/feed/$messageId'),
    );
    if (response.statusCode != 204) {
      throw StateError('Clan-Nachricht konnte nicht entfernt werden');
    }
  }

  Future<void> reportClanMessage(
    String messageId,
    String reason,
    String? details,
  ) async {
    final response = await _client.post(
      Uri.parse('$base/v1/clans/feed/$messageId/reports'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'reason': reason, 'details': details}),
    );
    if (response.statusCode != 201) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode == 409) {
        throw StateError('Diese Nachricht wurde bereits gemeldet');
      }
      throw StateError(
        data['code'] == 'CLAN_MESSAGE_NOT_FOUND'
            ? 'Die Nachricht ist nicht mehr verfügbar'
            : 'Nachricht konnte nicht gemeldet werden',
      );
    }
  }

  Future<ShopPurchaseView> purchaseShopOffer(String offerId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/shop/offers/$offerId/purchase'),
      headers: {'idempotency-key': _uuid()},
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 409) {
      throw ShopPurchaseException(data['code'] as String? ?? 'SHOP_REJECTED');
    }
    if (response.statusCode != 200) {
      throw StateError('Shop-Kauf konnte nicht abgeschlossen werden');
    }
    return ShopPurchaseView(
      offerId: data['offerId'] as String,
      coins: data['coins'] as int,
      gemsSpent: data['gemsSpent'] as int,
      coinBalance: data['coinBalance'] as int,
      gemBalance: data['gemBalance'] as int,
    );
  }

  static SocialPlayerView _socialPlayer(dynamic value) {
    final data = value as Map<String, dynamic>;
    return SocialPlayerView(
      id: data['id'] as String,
      displayName: data['displayName'] as String,
      level: data['level'] as int,
      online: data['online'] as bool,
    );
  }

  static ClanView _clan(dynamic value) {
    final data = value as Map<String, dynamic>;
    return ClanView(
      id: data['id'] as String,
      name: data['name'] as String,
      tag: data['tag'] as String,
      memberCount: data['memberCount'] as int,
      memberLimit: data['memberLimit'] as int,
      weeklyScore: data['weeklyScore'] as int,
      role: data['role'] as String?,
    );
  }

  Future<List<MissionView>> missions() async {
    final response = await _client.get(Uri.parse('$base/v1/missions'));
    if (response.statusCode != 200) {
      throw StateError('Missionen konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['missions'] as List)
        .map((value) {
          final item = value as Map<String, dynamic>;
          return MissionView(
            id: item['id'] as String,
            cadence: item['cadence'] as String,
            tier: item['tier'] as String,
            translationKey: item['translationKey'] as String,
            metric: item['metric'] as String,
            target: item['target'] as int,
            progress: item['progress'] as int,
            rewardCoins: item['rewardCoins'] as int,
            rewardMissionPoints:
                (item['rewards'] as Map<String, dynamic>)['missionPoints']
                    as int,
            rewardLoyaltyPoints:
                (item['rewards'] as Map<String, dynamic>)['loyaltyPoints']
                    as int,
            rewardStamps:
                (item['rewards'] as Map<String, dynamic>)['stamps'] as int,
            rewardToolboxes:
                (item['rewards'] as Map<String, dynamic>)['toolboxes'] as int,
            rewardBoosters:
                (item['rewards'] as Map<String, dynamic>)['boosters'] as int,
            completed: item['completed'] as bool,
            claimed: item['claimed'] as bool,
            periodKey: item['periodKey'] as String,
            startsAt: DateTime.parse(item['startsAt'] as String),
            endsAt: DateTime.parse(item['endsAt'] as String),
            unlocked: item['unlocked'] as bool,
            unlockProgress: item['unlockProgress'] as int,
            unlockTarget: item['unlockTarget'] as int,
          );
        })
        .toList(growable: false);
  }

  Future<MissionClaimView> claimMission(String missionId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/missions/$missionId/claim'),
    );
    if (response.statusCode == 409) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw RewardClaimException(data['code'] as String? ?? 'CLAIM_REJECTED');
    }
    if (response.statusCode != 200) {
      throw StateError('Mission konnte nicht abgeholt werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final rewards = data['rewards'] as Map<String, dynamic>;
    return MissionClaimView(
      coins: data['coins'] as int,
      coinBalance: data['coinBalance'] as int,
      missionPoints: rewards['missionPoints'] as int,
      loyaltyPoints: rewards['loyaltyPoints'] as int,
      stamps: rewards['stamps'] as int,
      toolboxes: rewards['toolboxes'] as int,
      boosters: rewards['boosters'] as int,
    );
  }

  Future<RewardClaimResponse> claimReward(String rewardId) async {
    final response = await _client.post(
      Uri.parse('$base/v1/rewards/$rewardId/claims'),
    );
    if (response.statusCode == 409) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw RewardClaimException(data['code'] as String? ?? 'CLAIM_REJECTED');
    }
    if (response.statusCode != 200) {
      throw StateError('Belohnung konnte nicht abgeholt werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return RewardClaimResponse(
      coins: data['coins'] as int,
      balance: data['coinBalance'] as int,
    );
  }

  Future<TimedRewardView> timedReward(String type) async {
    final response = await _client.get(Uri.parse('$base/v1/rewards/$type'));
    if (response.statusCode != 200) {
      throw StateError('Zeitbelohnung konnte nicht geladen werden');
    }
    return _timedReward(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<TimedRewardClaimView> claimTimedReward(String type) async {
    final response = await _client.post(
      Uri.parse('$base/v1/rewards/$type/claim'),
    );
    if (response.statusCode == 409) {
      throw const RewardClaimException('REWARD_NOT_AVAILABLE');
    }
    if (response.statusCode != 200) {
      throw StateError('Zeitbelohnung konnte nicht abgeholt werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return TimedRewardClaimView(
      coins: data['coins'] as int,
      balance: data['coinBalance'] as int,
      wheelUnlocked: data['wheelUnlocked'] as bool,
    );
  }

  Future<WheelView> wheel() async {
    final response = await _client.get(
      Uri.parse('$base/v1/rewards/wheels/standard'),
    );
    if (response.statusCode != 200) {
      throw StateError('Bonusrad konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return WheelView(
      availableSpins: data['availableSpins'] as int,
      segments: (data['segments'] as List)
          .map((value) {
            final item = value as Map<String, dynamic>;
            return WheelSegmentView(
              id: item['id'] as String,
              currency: item['currency'] as String,
              amount: item['amount'] as int,
            );
          })
          .toList(growable: false),
    );
  }

  Future<WheelSpinView> spinWheel() async {
    final response = await _client.post(
      Uri.parse('$base/v1/rewards/wheels/standard/spin'),
      headers: {'idempotency-key': _uuid()},
    );
    if (response.statusCode == 409) {
      throw const RewardClaimException('WHEEL_NOT_AVAILABLE');
    }
    if (response.statusCode != 200) {
      throw StateError('Bonusrad konnte nicht gedreht werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return WheelSpinView(
      segmentId: data['segmentId'] as String,
      currency: data['rewardCurrency'] as String,
      amount: data['rewardAmount'] as int,
      balanceAfter: data['balanceAfter'] as int,
      availableSpins: data['availableSpins'] as int,
    );
  }

  Future<List<LiveEventView>> events() async {
    final response = await _client.get(Uri.parse('$base/v1/events'));
    if (response.statusCode != 200) {
      throw StateError('Live Events konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['events'] as List)
        .map((value) {
          final event = value as Map<String, dynamic>;
          return LiveEventView(
            id: event['id'] as String,
            title: event['title'] as String,
            subtitle: event['subtitle'] as String,
            cadence: event['cadence'] as String,
            metric: event['metric'] as String,
            accent: event['accent'] as String,
            periodKey: event['periodKey'] as String,
            startsAt: DateTime.parse(event['startsAt'] as String),
            endsAt: DateTime.parse(event['endsAt'] as String),
            progress: event['progress'] as int,
            milestones: (event['milestones'] as List)
                .map((raw) {
                  final milestone = raw as Map<String, dynamic>;
                  return EventMilestoneView(
                    id: milestone['id'] as String,
                    target: milestone['target'] as int,
                    rewardCoins: milestone['rewardCoins'] as int,
                    completed: milestone['completed'] as bool,
                    claimed: milestone['claimed'] as bool,
                  );
                })
                .toList(growable: false),
          );
        })
        .toList(growable: false);
  }

  Future<EventClaimView> claimEventMilestone(
    String eventId,
    String milestoneId,
  ) async {
    final response = await _client.post(
      Uri.parse('$base/v1/events/$eventId/milestones/$milestoneId/claim'),
    );
    if (response.statusCode == 409) {
      throw const RewardClaimException('EVENT_MILESTONE_NOT_CLAIMABLE');
    }
    if (response.statusCode != 200) {
      throw StateError('Event-Belohnung konnte nicht abgeholt werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return EventClaimView(
      coins: data['coins'] as int,
      balance: data['coinBalance'] as int,
    );
  }

  /// Sends only allow-listed presentation telemetry; failures never affect play.
  Future<void> trackEvent(
    String name, {
    required String screen,
    String? slotId,
    String? campaignId,
  }) async {
    try {
      final response = await _client.post(
        Uri.parse('$base/v1/analytics/events'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({
          'events': [
            {
              'eventId': _uuid(),
              'name': name,
              'occurredAt': DateTime.now().toUtc().toIso8601String(),
              'platform': kIsWeb
                  ? 'web'
                  : defaultTargetPlatform == TargetPlatform.iOS
                  ? 'ios'
                  : 'android',
              'appVersion': _appVersion,
              'screen': screen,
              'slotId': ?slotId,
              'campaignId': ?campaignId,
            },
          ],
        }),
      );
      if (response.statusCode != 202) return;
    } catch (_) {
      // Analytics is deliberately best-effort and cannot block gameplay.
    }
  }

  static TimedRewardView _timedReward(Map<String, dynamic> data) =>
      TimedRewardView(
        type: data['type'] as String,
        claimable: data['claimable'] as bool,
        availableAt: DateTime.parse(data['availableAt'] as String),
        nextCoins: data['nextCoins'] as int,
        streak: data['streak'] as int,
        cyclePosition: data['cyclePosition'] as int,
        claimsTowardWheel: data['claimsTowardWheel'] as int,
      );

  static PushPreferencesView _pushPreferences(Map<String, dynamic> data) =>
      PushPreferencesView(
        enabled: data['enabled'] as bool,
        marketing: data['marketing'] as bool,
        rewards: data['rewards'] as bool,
        social: data['social'] as bool,
        quietHoursStartMinutes: data['quietHoursStartMinutes'] as int?,
        quietHoursEndMinutes: data['quietHoursEndMinutes'] as int?,
        timeZone: data['timeZone'] as String,
      );

  static List<JackpotPoolView> _jackpotPools(List<dynamic> values) => values
      .map((value) {
        final pool = value as Map<String, dynamic>;
        return JackpotPoolView(
          tier: pool['tier'] as String,
          amount: pool['amount'] as int,
          seedAmount: pool['seedAmount'] as int,
        );
      })
      .toList(growable: false);

  static List<List<String>> _grid(Object? value) =>
      (value as List).map((reel) => (reel as List).cast<String>()).toList();

  static List<int> _integerList(String? value) {
    if (value == null || value.isEmpty) return const [];
    return value.split(',').map(int.parse).toList(growable: false);
  }

  static List<HoldAndWinSpotView> _holdAndWinSpots(String? value) {
    if (value == null || value.isEmpty) return const [];
    return value
        .split(',')
        .map((entry) {
          final separator = entry.indexOf('=');
          if (separator <= 0 || separator == entry.length - 1) {
            throw const FormatException('Invalid hold-and-win spot');
          }
          return HoldAndWinSpotView(
            position: int.parse(entry.substring(0, separator)),
            multiplier: int.parse(entry.substring(separator + 1)),
          );
        })
        .toList(growable: false);
  }

  static List<HoldAndWinStepView> _holdAndWinSteps(String? value) {
    if (value == null || value.isEmpty) return const [];
    return value
        .split(';')
        .map((entry) {
          final separator = entry.indexOf(':');
          if (separator <= 0) {
            throw const FormatException('Invalid hold-and-win respin');
          }
          return HoldAndWinStepView(
            lives: int.parse(entry.substring(0, separator)),
            spots: _holdAndWinSpots(entry.substring(separator + 1)),
          );
        })
        .toList(growable: false);
  }

  String _uuid() {
    final bytes = List.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  static BoosterStatusView _boosterStatus(Map<String, dynamic> data) =>
      BoosterStatusView(
        stamps: data['stamps'] as int,
        stampsPerBooster: data['stampsPerBooster'] as int,
        boosters: data['boosters'] as int,
        activeSpins: data['activeSpins'] as int,
        boostedSpinsPerToken: data['boostedSpinsPerToken'] as int,
        xpMultiplier: data['xpMultiplier'] as int,
        maxActiveSpins: data['maxActiveSpins'] as int,
        canCraft: data['canCraft'] as bool,
        canActivate: data['canActivate'] as bool,
      );

  static LoyaltyRewardsView _loyaltyRewards(Map<String, dynamic> data) =>
      LoyaltyRewardsView(
        version: data['version'] as int,
        loyaltyPoints: data['loyaltyPoints'] as int,
        offers: (data['offers'] as List)
            .map((value) {
              final offer = value as Map<String, dynamic>;
              return LoyaltyRewardOfferView(
                id: offer['id'] as String,
                title: offer['title'] as String,
                costLoyaltyPoints: offer['costLoyaltyPoints'] as int,
                rewardCurrency: offer['rewardCurrency'] as String,
                rewardAmount: offer['rewardAmount'] as int,
                canRedeem: offer['canRedeem'] as bool,
              );
            })
            .toList(growable: false),
      );

  static HighRollerClubView _highRollerClub(Map<String, dynamic> data) =>
      HighRollerClubView(
        points: data['points'] as int,
        entryPoints: data['entryPoints'] as int,
        eligible: data['eligible'] as bool,
        active: data['active'] as bool,
        activeUntil: data['activeUntil'] == null
            ? null
            : DateTime.parse(data['activeUntil'] as String),
        remainingSeconds: data['remainingSeconds'] as int,
        sources: (data['sources'] as List)
            .map((value) {
              final source = value as Map<String, dynamic>;
              return HighRollerSourceView(
                id: source['id'] as String,
                label: source['label'] as String,
                points: source['points'] as int?,
                available: source['available'] as bool,
              );
            })
            .toList(growable: false),
        benefits: (data['benefits'] as List)
            .map((value) {
              final benefit = value as Map<String, dynamic>;
              return HighRollerBenefitView(
                id: benefit['id'] as String,
                label: benefit['label'] as String,
                detail: benefit['detail'] as String,
                active: benefit['active'] as bool,
              );
            })
            .toList(growable: false),
      );
}
