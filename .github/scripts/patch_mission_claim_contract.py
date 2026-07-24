from pathlib import Path
import re


def replace_once(path: str, old: str, new: str, marker: str) -> None:
    file = Path(path)
    text = file.read_text()
    if marker in text:
        print(f"skip {path}: {marker}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact anchor for {marker}, found {count}")
    file.write_text(text.replace(old, new))
    print(f"patched {path}: {marker}")


def replace_regex_once(path: str, pattern: str, replacement: str, marker: str) -> None:
    file = Path(path)
    text = file.read_text()
    if marker in text:
        print(f"skip {path}: {marker}")
        return
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex anchor for {marker}, found {count}")
    file.write_text(updated)
    print(f"patched {path}: {marker}")


replace_regex_once(
    "apps/api/src/spins/spin-store.ts",
    r'''export function missionClaimRequestHash\(command: ClaimMissionCommand\): Buffer \{\n  return createHash\("sha256"\)\.update\(JSON\.stringify\(\{\n    playerId: command\.playerId,\n    missionId: command\.missionId,\n  \}\)\)\.digest\(\);\n\}''',
    '''export function missionClaimRequestHash(command: ClaimMissionCommand, periodKey: string): Buffer {
  return createHash("sha256").update(JSON.stringify({
    playerId: command.playerId,
    missionId: command.missionId,
    periodKey,
  })).digest();
}''',
    "periodKey: string): Buffer",
)

replace_once(
    "apps/api/src/spins/in-memory-spin-store.ts",
    'import type { EventMilestoneClaim, GrantStorePurchaseCommand, LiveEventView, MissionClaim, MissionView, PlayerProfile, PlayerProgression, RewardClaim, ShopPurchase, SpinStore, SettleSpinCommand, SettledSpin, StorePurchaseSettlement, StoreRefundCommand, TimedRewardClaim, TimedRewardStatus, TimedRewardType, TournamentView, WalletTransaction, WheelSpinResult, WheelStatus } from "./spin-store.js";',
    'import type { ClaimMissionCommand, EventMilestoneClaim, GrantStorePurchaseCommand, LiveEventView, MissionClaim, MissionView, PlayerProfile, PlayerProgression, RewardClaim, ShopPurchase, SpinStore, SettleSpinCommand, SettledSpin, StorePurchaseSettlement, StoreRefundCommand, TimedRewardClaim, TimedRewardStatus, TimedRewardType, TournamentView, WalletTransaction, WheelSpinResult, WheelStatus } from "./spin-store.js";',
    "ClaimMissionCommand, EventMilestoneClaim",
)
replace_once(
    "apps/api/src/spins/in-memory-spin-store.ts",
    'import { BoosterActionConflictError, BoosterNotAvailableError, BoosterNotCraftableError, CheckWinNotClaimableError, EventMilestoneNotClaimableError, HighRollerAlreadyActiveError, HighRollerNotEligibleError, InsufficientFundsError, InsufficientGemsError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, StoreProductLimitReachedError, StorePurchaseDebtError, StorePurchaseRevokedError, StoreTransactionConflictError, WheelNotAvailableError } from "./spin-store.js";',
    'import { BoosterActionConflictError, BoosterNotAvailableError, BoosterNotCraftableError, CheckWinNotClaimableError, EventMilestoneNotClaimableError, HighRollerAlreadyActiveError, HighRollerNotEligibleError, InsufficientFundsError, InsufficientGemsError, MissionIdempotencyConflictError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, StoreProductLimitReachedError, StorePurchaseDebtError, StorePurchaseRevokedError, StoreTransactionConflictError, WheelNotAvailableError } from "./spin-store.js";',
    "MissionIdempotencyConflictError, MissionNotClaimableError",
)
replace_once(
    "apps/api/src/spins/in-memory-spin-store.ts",
    "  private readonly missionProgress = new Map<string, { progress: number; claimed: boolean }>();\n",
    "  private readonly missionProgress = new Map<string, { progress: number; claimed: boolean }>();\n  private readonly missionClaimRetries = new Map<string, { semanticKey: string; claim: MissionClaim }>();\n  private readonly missionClaims = new Map<string, MissionClaim>();\n",
    "missionClaimRetries",
)
replace_regex_once(
    "apps/api/src/spins/in-memory-spin-store.ts",
    r'''  public async claimMission\(playerId: string, missionId: string, now: Date\): Promise<MissionClaim> \{.*?\n  \}\n\n  public async getLiveEvents''',
    '''  public async claimMission(command: ClaimMissionCommand, now: Date): Promise<MissionClaim> {
    const mission = (await this.getMissions(command.playerId, now)).find((item) => item.id === command.missionId);
    if (!mission) throw new MissionNotClaimableError();
    const semanticKey = `${command.playerId}:${mission.id}:v${mission.version}:${mission.periodKey}`;
    const retryKey = `${command.playerId}:${command.idempotencyKey}`;
    const retry = this.missionClaimRetries.get(retryKey);
    if (retry) {
      if (retry.semanticKey !== semanticKey) throw new MissionIdempotencyConflictError();
      return { ...retry.claim, replayed: true };
    }
    const semanticReplay = this.missionClaims.get(semanticKey);
    if (semanticReplay) {
      this.missionClaimRetries.set(retryKey, { semanticKey, claim: semanticReplay });
      return { ...semanticReplay, replayed: true };
    }
    if (!mission.completed || mission.claimed) throw new MissionNotClaimableError();
    const progressKey = `${command.playerId}:${mission.id}:${mission.periodKey}`;
    this.missionProgress.set(progressKey, { progress: mission.progress, claimed: true });
    const coinBefore = this.balances.get(command.playerId) ?? this.defaultBalance;
    const coinBalance = coinBefore + mission.rewards.coins;
    if (!Number.isSafeInteger(coinBalance) || coinBalance < 0) throw new RangeError("Mission coin balance is unsafe");
    this.balances.set(command.playerId, coinBalance);
    const claimId = randomUUID();
    if (mission.rewards.coins > 0) {
      this.record(command.playerId, mission.rewards.coins, "mission_claim", "mission", claimId,
        coinBefore, coinBalance);
    }
    const wallet = { ...this.economy.get(command.playerId) };
    const rewardCurrencies: readonly [SpinEconomyCurrency, number][] = [
      ["mission_point", mission.rewards.missionPoints], ["loyalty_point", mission.rewards.loyaltyPoints],
      ["stamp", mission.rewards.stamps], ["toolbox", mission.rewards.toolboxes], ["booster", mission.rewards.boosters],
    ];
    const balances: Record<string, number> = { coin: coinBalance };
    for (const [currency, amount] of rewardCurrencies) {
      const before = wallet[currency] ?? 0;
      const after = before + amount;
      if (!Number.isSafeInteger(after) || after < 0) throw new RangeError(`Mission ${currency} balance is unsafe`);
      wallet[currency] = after;
      balances[currency] = after;
      if (amount > 0) this.record(command.playerId, amount, "mission_claim", "mission", claimId,
        before, after, currency);
    }
    this.economy.set(command.playerId, wallet);
    const definition = missionCatalog.definitions.find((item) => item.id === command.missionId)!;
    if (definition.cadence === "daily" && definition.tier === "standard") {
      this.advanceWeeklyMissionBar(command.playerId, now);
    }
    const claim: MissionClaim = {
      claimId,
      missionId: mission.id,
      missionVersion: mission.version,
      periodKey: mission.periodKey,
      coins: mission.rewards.coins,
      coinBalance,
      rewards: mission.rewards,
      balances,
      lootEntitlement: null,
      replayed: false,
    };
    this.missionClaims.set(semanticKey, claim);
    this.missionClaimRetries.set(retryKey, { semanticKey, claim });
    return claim;
  }

  public async getLiveEvents''',
    "public async claimMission(command: ClaimMissionCommand",
)

replace_once(
    "apps/api/src/http-app.ts",
    'import { BoosterActionConflictError, BoosterNotAvailableError, BoosterNotCraftableError, CheckWinNotClaimableError, EventMilestoneNotClaimableError, HighRollerAlreadyActiveError, HighRollerNotEligibleError, InsufficientFundsError, InsufficientGemsError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, WheelNotAvailableError } from "./spins/spin-store.js";',
    'import { BoosterActionConflictError, BoosterNotAvailableError, BoosterNotCraftableError, CheckWinNotClaimableError, EventMilestoneNotClaimableError, HighRollerAlreadyActiveError, HighRollerNotEligibleError, InsufficientFundsError, InsufficientGemsError, MissionIdempotencyConflictError, MissionNotClaimableError, RewardAlreadyClaimedError, RewardNotAvailableError, ShopOfferLimitReachedError, WheelNotAvailableError } from "./spins/spin-store.js";',
    "MissionIdempotencyConflictError, MissionNotClaimableError",
)
replace_regex_once(
    "apps/api/src/http-app.ts",
    r'''  app\.post\("/v1/missions/:missionId/claim", async \(request, reply\) => \{.*?\n  \}\);\n  app\.get\("/v1/events"''',
    '''  app.post("/v1/missions/:missionId/claim", async (request, reply) => {
    const playerId = await dependencies.authenticator.authenticate(request.headers.authorization);
    if (!playerId) return reply.code(401).send({ code: "UNAUTHORIZED" });
    const missionId = (request.params as { missionId: string }).missionId;
    if (!/^[a-z0-9-]{3,64}$/.test(missionId)) return reply.code(400).send({ code: "INVALID_REQUEST" });
    const keyResult = idempotencyKey.safeParse(request.headers["idempotency-key"]);
    if (!keyResult.success) return reply.code(400).send({ code: "INVALID_IDEMPOTENCY_KEY" });
    const rate = authRateLimiter.consume(`mission-claim:${playerId}`, 20, 60_000);
    if (!rate.allowed) return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });
    try {
      return await dependencies.spinStore.claimMission({
        playerId, missionId, idempotencyKey: keyResult.data,
      }, new Date());
    } catch (error) {
      if (error instanceof MissionNotClaimableError) return reply.code(409).send({ code: "MISSION_NOT_CLAIMABLE" });
      if (error instanceof MissionIdempotencyConflictError) return reply.code(409).send({ code: "IDEMPOTENCY_CONFLICT" });
      throw error;
    }
  });
  app.get("/v1/events"''',
    "mission-claim:${playerId}",
)

replace_once(
    "apps/mobile/lib/services/casino_api.dart",
    """    final response = await _client.post(
      Uri.parse('$base/v1/missions/$missionId/claim'),
    );""",
    """    final response = await _client.post(
      Uri.parse('$base/v1/missions/$missionId/claim'),
      headers: {'idempotency-key': _uuid()},
    );""",
    "Uri.parse('$base/v1/missions/$missionId/claim'),\n      headers: {'idempotency-key': _uuid()},",
)

replace_once(
    "apps/api/src/spins/in-memory-missions.test.ts",
    "      await store.claimMission(playerId, id, new Date());",
    "      await store.claimMission({ playerId, missionId: id, idempotencyKey: randomUUID() }, new Date());",
    "missionId: id, idempotencyKey: randomUUID()",
)
replace_once(
    "apps/api/src/spins/in-memory-missions.test.ts",
    '    const superClaim = await store.claimMission(playerId, "super-free-spins-3", new Date());',
    '    const superCommand = { playerId, missionId: "super-free-spins-3", idempotencyKey: randomUUID() };\n    const superClaim = await store.claimMission(superCommand, new Date());',
    "const superCommand =",
)
replace_once(
    "apps/api/src/spins/in-memory-missions.test.ts",
    '''    expect(superClaim.balances.booster).toBe(1);
    expect((await store.listWalletTransactions(playerId, 200)).filter((entry) => entry.source === "mission").length)''',
    '''    expect(superClaim).toMatchObject({ missionVersion: 3, lootEntitlement: null, replayed: false });
    expect(superClaim.balances.booster).toBe(1);
    const replay = await store.claimMission(superCommand, new Date());
    expect(replay.claimId).toBe(superClaim.claimId);
    expect(replay.replayed).toBe(true);
    expect((await store.listWalletTransactions(playerId, 200)).filter((entry) => entry.source === "mission").length)''',
    "expect(replay.claimId).toBe(superClaim.claimId)",
)

replace_once(
    "apps/api/src/missions/mission-system.test.ts",
    '''  it("applies the approved reduced coin rewards", () => {
    expect(missionById("daily-wager-10000").rewards.coins).toBe(15_000);
    expect(missionById("daily-win-50000").rewards.coins).toBe(20_000);
    expect(missionById("weekly-bar-7").rewards.coins).toBe(200_000);
  });
''',
    '''  it("applies the approved reduced coin rewards", () => {
    expect(missionById("daily-wager-10000").rewards.coins).toBe(15_000);
    expect(missionById("daily-win-50000").rewards.coins).toBe(20_000);
    expect(missionById("weekly-bar-7").rewards.coins).toBe(200_000);
  });

  it("binds every definition to its exact versioned tier reward", () => {
    for (const mission of missionCatalog.definitions) {
      expect(mission.version).toBe(3);
      expect(mission.lootReward).toEqual({
        tableId: `mission-${mission.tier}-reward`,
        tableVersion: 1,
        expiresInSeconds: 604_800,
      });
    }
  });
''',
    "binds every definition to its exact versioned tier reward",
)
