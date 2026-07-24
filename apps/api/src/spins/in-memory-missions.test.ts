import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SpinResult } from "@aurora/slot-engine";
import { InMemorySpinStore } from "./in-memory-spin-store.js";

function missionSpin(freeSpinsPlayed = 0): SpinResult {
  return {
    configId: "mission-test", configVersion: 1, mathModelVersion: "test", seed: "1",
    baseBet: 1_000, wager: 1_000, bonusBuy: false, stops: [0, 0, 0], grid: [["A"], ["A"], ["A"]],
    wins: [], rounds: [{ phase: "base", index: 0, grid: [["A"], ["A"], ["A"]], wins: [], totalWin: 50_000, events: [] }],
    freeSpinsPlayed, totalWin: 50_000, maxWinReached: false, maxWinMultiplier: 1_000,
  };
}

describe("InMemorySpinStore mission tracks", () => {
  it("unlocks Super missions from three daily claims and advances the weekly bar", async () => {
    const store = new InMemorySpinStore(1_000_000);
    const playerId = randomUUID();
    for (let index = 0; index < 10; index += 1) {
      await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "mission-test",
        configVersion: 1, bet: 1_000, seed: BigInt(index) }, () => missionSpin());
    }
    let missions = await store.getMissions(playerId, new Date());
    expect(missions.filter((mission) => mission.cadence === "daily" && mission.tier === "standard" && mission.completed)).toHaveLength(3);
    expect(missions.find((mission) => mission.tier === "super")).toMatchObject({ unlocked: false, unlockProgress: 0, unlockTarget: 3 });

    for (const id of ["daily-spins-10", "daily-wager-10000", "daily-win-50000"]) {
      await store.claimMission({ playerId, missionId: id, idempotencyKey: randomUUID() }, new Date());
    }
    missions = await store.getMissions(playerId, new Date());
    expect(missions.find((mission) => mission.id === "super-free-spins-3")).toMatchObject({ unlocked: true, progress: 0 });
    expect(missions.find((mission) => mission.id === "weekly-bar-3")).toMatchObject({ progress: 3, completed: true });

    await store.settle({ playerId, idempotencyKey: randomUUID(), slotId: "mission-test",
      configVersion: 1, bet: 1_000, seed: 99n }, () => missionSpin(3));
    const superCommand = { playerId, missionId: "super-free-spins-3", idempotencyKey: randomUUID() };
    const superClaim = await store.claimMission(superCommand, new Date());
    expect(superClaim).toMatchObject({ rewards: { coins: 35_000, missionPoints: 50,
      loyaltyPoints: 125, stamps: 1, toolboxes: 0, boosters: 1 } });
    expect(superClaim).toMatchObject({ missionVersion: 3, lootEntitlement: null, replayed: false });
    expect(superClaim.balances.booster).toBe(1);
    const replay = await store.claimMission(superCommand, new Date());
    expect(replay.claimId).toBe(superClaim.claimId);
    expect(replay.replayed).toBe(true);
    expect((await store.listWalletTransactions(playerId, 200)).filter((entry) => entry.source === "mission").length)
      .toBeGreaterThanOrEqual(12);
  });
});
