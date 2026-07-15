import { describe, expect, it } from "vitest";
import { InMemoryLiveOpsStore } from "./in-memory-liveops-store.js";
import { FourEyesViolationError } from "./liveops-store.js";

describe("LiveOps approval", () => {
  it("prevents the draft author from publishing their own campaign", async () => {
    const store = new InMemoryLiveOpsStore(false); const now = new Date();
    const campaign = await store.createDraft({ name: "Four eyes", startsAt: now, endsAt: new Date(now.getTime() + 60_000),
      audience: { minLevel: 1, minVipPoints: 0 }, creative: { title: "FOUR EYES", subtitle: "Approval required", ctaLabel: "PLAY" }, actor: "alice" });
    await expect(store.publish(campaign.id, "alice", now)).rejects.toBeInstanceOf(FourEyesViolationError);
    expect((await store.listCampaigns())[0]?.status).toBe("draft");
  });
});
