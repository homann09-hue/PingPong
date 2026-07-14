import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InMemorySpinStore } from "../spins/in-memory-spin-store.js";
import { WheelNotAvailableError } from "../spins/spin-store.js";
import { selectWheelSegment } from "./bonus-wheel.js";

describe("standard bonus wheel", () => {
  it("maps deterministic unit values to weighted segments", () => {
    expect(selectWheelSegment(0).id).toBe("coins-50k");
    expect(selectWheelSegment(0.999999).id).toBe("coins-1m");
  });

  it("consumes one entitlement and replays without a second credit", async () => {
    const store = new InMemorySpinStore(1_000);
    const playerId = randomUUID();
    for (let hour = 0; hour < 4; hour++) {
      await store.claimTimedReward(playerId, "hourly", new Date(Date.UTC(2026, 6, 1, hour)));
    }
    expect((await store.getWheelStatus(playerId, new Date())).availableSpins).toBe(1);
    const key = randomUUID();
    const first = await store.spinWheel(playerId, key, 0.999999, new Date());
    const replay = await store.spinWheel(playerId, key, 0, new Date());
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ segmentId: "coins-1m", rewardAmount: 1_000_000, availableSpins: 0 });
    await expect(store.spinWheel(playerId, randomUUID(), 0, new Date())).rejects.toBeInstanceOf(WheelNotAvailableError);
  });
});
