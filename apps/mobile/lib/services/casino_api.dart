import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

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
  final String? featureLabel;
  final Set<String> winningCells;
  final String? winLabel;
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
    required this.name,
    required this.description,
    required this.rewardId,
    required this.progress,
    required this.target,
    required this.coins,
    required this.completed,
    required this.claimed,
  });

  final String name, description, rewardId;
  final int progress, target, coins;
  final bool completed, claimed;
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
    required this.completed,
    required this.claimed,
    required this.periodKey,
  });

  final String id, cadence, tier, translationKey, metric, periodKey;
  final int target, progress, rewardCoins;
  final bool completed, claimed;
}

class ProfileResponse {
  const ProfileResponse({
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

  final int balance, gems, level, xp, spins, totalWon, freeSpins;
  final int vipPoints, vipTierStart, vipNextTier;
  final String vipTier;
  final Set<String> claimedRewards;
  final List<AchievementView> achievements;
  final int tournamentRank, tournamentScore;
  final String tournamentName;
  final DateTime tournamentEndsAt;
  final int tournamentPrizePool, tournamentEntrants;
  final List<Map<String, dynamic>> leaders;
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
    required this.targetRtp,
    required this.volatility,
    required this.expectedHitFrequency,
    required this.maxWinMultiplier,
    required this.mathModelVersion,
    required this.betSteps,
    required this.symbols,
  });

  final int lines;
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

class SocialOverviewView {
  const SocialOverviewView({
    required this.friends,
    required this.incomingRequests,
    required this.suggestions,
    required this.currentClan,
    required this.discoverClans,
  });
  final List<SocialPlayerView> friends, suggestions;
  final List<FriendRequestView> incomingRequests;
  final ClanView? currentClan;
  final List<ClanView> discoverClans;
}

class CasinoApi {
  static const _configuredBase = String.fromEnvironment('API_URL');
  static final base = _configuredBase.isNotEmpty
      ? _configuredBase
      : kIsWeb
      ? Uri.base.origin
      : 'http://localhost:8080';
  final Random _random = Random.secure();

  Future<SlotPaytable> paytable(String gameId) async {
    final response = await http.get(
      Uri.parse('$base/v1/slots/$gameId/paytable'),
    );
    if (response.statusCode != 200) {
      throw StateError('Paytable konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final rawSymbols = data['symbols'] as Map<String, dynamic>;
    return SlotPaytable(
      lines: data['lines'] as int,
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
    final response = await http.post(
      Uri.parse('$base/v1/slots/$gameId/spins'),
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer local-demo',
        'idempotency-key': _uuid(),
      },
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
      final wins = (round['wins'] as List).cast<Map<String, dynamic>>();
      final winningCells = <String>{};
      for (final win in wins) {
        for (final cell in win['cells'] as List) {
          final coordinates = cell as List;
          winningCells.add('${coordinates[0]}:${coordinates[1]}');
        }
      }
      final lineWins = wins.where((win) => win['kind'] == 'line').toList();
      final scatterWins = wins
          .where((win) => win['kind'] == 'scatter')
          .toList();
      final winLabel = lineWins.isNotEmpty
          ? '${lineWins.first['count']}× ${lineWins.first['symbol']}  •  ${lineWins.length} ${lineWins.length == 1 ? 'LINIE' : 'LINIEN'}'
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
        featureLabel: eventTypes.contains('max_win.reached')
            ? 'MAX WIN'
            : eventTypes.contains('wild.walked')
            ? 'WALKING WILD'
            : eventTypes.contains('wild.stuck')
            ? 'STICKY WILDS'
            : eventTypes.contains('multiplier.applied')
            ? switch (multiplierData?['source']) {
                'cascade' => 'CASCADE ×${multiplierData?['multiplier']}',
                'free_spin' => 'FREE SPINS ×${multiplierData?['multiplier']}',
                _ => 'WILD MULTIPLIER ×${multiplierData?['multiplier']}',
              }
            : eventTypes.contains('respin.started')
            ? 'RESPIN'
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
    final response = await http.get(Uri.parse('$base/v1/jackpots'));
    if (response.statusCode != 200) {
      throw StateError('Jackpots konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return _jackpotPools(data['jackpots'] as List);
  }

  Future<ProfileResponse> profile() async {
    final response = await http.get(
      Uri.parse('$base/v1/profile'),
      headers: {'authorization': 'Bearer local-demo'},
    );
    if (response.statusCode != 200) {
      throw StateError('Profil konnte nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final progression = data['progression'] as Map<String, dynamic>;
    final vip = data['vip'] as Map<String, dynamic>;
    final tournament = data['tournament'] as Map<String, dynamic>;
    return ProfileResponse(
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
      claimedRewards: (data['claimedRewards'] as List).cast<String>().toSet(),
      achievements: (data['achievements'] as List).map((value) {
        final item = value as Map<String, dynamic>;
        return AchievementView(
          name: item['name'] as String,
          description: item['description'] as String,
          rewardId: item['rewardId'] as String,
          progress: item['progress'] as int,
          target: item['target'] as int,
          coins: item['coins'] as int,
          completed: item['completed'] as bool,
          claimed: item['claimed'] as bool,
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

  Future<List<ShopOfferView>> shopOffers() async {
    final response = await http.get(Uri.parse('$base/v1/shop/offers'));
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

  Future<SocialOverviewView> socialOverview() async {
    final response = await http.get(
      Uri.parse('$base/v1/social/overview'),
      headers: {'authorization': 'Bearer local-demo'},
    );
    if (response.statusCode != 200) {
      throw StateError('Social-Daten konnten nicht geladen werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return SocialOverviewView(
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
    );
  }

  Future<void> sendFriendRequest(String playerId) async {
    final response = await http.post(
      Uri.parse('$base/v1/social/friend-requests'),
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer local-demo',
      },
      body: jsonEncode({'playerId': playerId}),
    );
    if (response.statusCode != 201) {
      throw StateError('Freundschaftsanfrage fehlgeschlagen');
    }
  }

  Future<void> acceptFriendRequest(String requestId) async {
    final response = await http.post(
      Uri.parse('$base/v1/social/friend-requests/$requestId/accept'),
      headers: {'authorization': 'Bearer local-demo'},
    );
    if (response.statusCode != 200) {
      throw StateError('Freundschaftsanfrage konnte nicht angenommen werden');
    }
  }

  Future<void> joinClan(String clanId) async {
    final response = await http.post(
      Uri.parse('$base/v1/clans/$clanId/join'),
      headers: {'authorization': 'Bearer local-demo'},
    );
    if (response.statusCode != 200) {
      throw StateError('Clan-Beitritt fehlgeschlagen');
    }
  }

  Future<void> createClan(String name, String tag) async {
    final response = await http.post(
      Uri.parse('$base/v1/clans'),
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer local-demo',
      },
      body: jsonEncode({'name': name, 'tag': tag}),
    );
    if (response.statusCode != 201) {
      throw StateError('Clan konnte nicht erstellt werden');
    }
  }

  Future<void> leaveClan() async {
    final response = await http.post(
      Uri.parse('$base/v1/clans/leave'),
      headers: {'authorization': 'Bearer local-demo'},
    );
    if (response.statusCode != 204) {
      throw StateError('Clan konnte nicht verlassen werden');
    }
  }

  Future<ShopPurchaseView> purchaseShopOffer(String offerId) async {
    final response = await http.post(
      Uri.parse('$base/v1/shop/offers/$offerId/purchase'),
      headers: {
        'authorization': 'Bearer local-demo',
        'idempotency-key': _uuid(),
      },
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
    final response = await http.get(
      Uri.parse('$base/v1/missions'),
      headers: {'authorization': 'Bearer local-demo'},
    );
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
            completed: item['completed'] as bool,
            claimed: item['claimed'] as bool,
            periodKey: item['periodKey'] as String,
          );
        })
        .toList(growable: false);
  }

  Future<RewardClaimResponse> claimMission(String missionId) async {
    final response = await http.post(
      Uri.parse('$base/v1/missions/$missionId/claim'),
      headers: {'authorization': 'Bearer local-demo'},
    );
    if (response.statusCode == 409) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw RewardClaimException(data['code'] as String? ?? 'CLAIM_REJECTED');
    }
    if (response.statusCode != 200) {
      throw StateError('Mission konnte nicht abgeholt werden');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return RewardClaimResponse(
      coins: data['coins'] as int,
      balance: data['coinBalance'] as int,
    );
  }

  Future<RewardClaimResponse> claimReward(String rewardId) async {
    final response = await http.post(
      Uri.parse('$base/v1/rewards/$rewardId/claims'),
      headers: {'authorization': 'Bearer local-demo'},
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
    final response = await http.get(
      Uri.parse('$base/v1/rewards/$type'),
      headers: {'authorization': 'Bearer local-demo'},
    );
    if (response.statusCode != 200) {
      throw StateError('Zeitbelohnung konnte nicht geladen werden');
    }
    return _timedReward(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<TimedRewardClaimView> claimTimedReward(String type) async {
    final response = await http.post(
      Uri.parse('$base/v1/rewards/$type/claim'),
      headers: {'authorization': 'Bearer local-demo'},
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
    final response = await http.get(
      Uri.parse('$base/v1/rewards/wheels/standard'),
      headers: {'authorization': 'Bearer local-demo'},
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
    final response = await http.post(
      Uri.parse('$base/v1/rewards/wheels/standard/spin'),
      headers: {
        'authorization': 'Bearer local-demo',
        'idempotency-key': _uuid(),
      },
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
    final response = await http.get(
      Uri.parse('$base/v1/events'),
      headers: {'authorization': 'Bearer local-demo'},
    );
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
    final response = await http.post(
      Uri.parse('$base/v1/events/$eventId/milestones/$milestoneId/claim'),
      headers: {'authorization': 'Bearer local-demo'},
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

  String _uuid() {
    final bytes = List.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}
