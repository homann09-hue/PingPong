import { describe, expect, it } from "vitest";
import {
  achievementClaimRequestHash,
  validateAchievementBackfill,
  validateClaimAchievementCommand,
} from "./achievement-store.js";

const command = {
  playerId: "00000000-0000-4000-8000-000000000001",
  achievementId: "achievement-first-spin",
  idempotencyKey: "00000000-0000-4000-8000-000000000101",
} as const;

describe("achievement store contract", () => {
  it("creates stable request fingerprints independent of the retry key", () => {
    const first = achievementClaimRequestHash(command);
    const retry = achievementClaimRequestHash({
      ...command,
      idempotencyKey: "00000000-0000-4000-8000-000000000102",
    });
    expect(first).toEqual(retry);
    expect(first).toHaveLength(32);
  });

  it("changes the fingerprint when the semantic claim changes", () => {
    expect(achievementClaimRequestHash(command)).not.toEqual(achievementClaimRequestHash({
      ...command,
      achievementId: "achievement-high-roller",
    }));
  });

  it("rejects malformed claim and backfill inputs", () => {
    expect(() => validateClaimAchievementCommand({ ...command, playerId: "not-a-uuid" })).toThrow(/UUID/);
    expect(() => validateClaimAchievementCommand({ ...command, achievementId: "INVALID" })).toThrow(/slug/);
    expect(() => validateClaimAchievementCommand({ ...command, idempotencyKey: "" })).toThrow(/between 1 and 200/);
    expect(() => validateAchievementBackfill(null, 0, new Date())).toThrow(/between 1 and 1000/);
    expect(() => validateAchievementBackfill(null, 10, new Date("invalid"))).toThrow(/valid date/);
  });
});
