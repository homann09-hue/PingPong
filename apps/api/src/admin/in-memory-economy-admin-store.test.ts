import { describe, expect, it } from "vitest";
import { InMemorySpinStore } from "../spins/in-memory-spin-store.js";
import { EconomyFourEyesViolationError } from "./economy-admin-store.js";
import { InMemoryEconomyAdminStore } from "./in-memory-economy-admin-store.js";

describe("InMemoryEconomyAdminStore", () => {
  it("enforces a second actor even when an identity has both capabilities", async () => {
    const playerId = "00000000-0000-4000-8000-000000000001";
    const store = new InMemoryEconomyAdminStore(new InMemorySpinStore(), playerId);
    const grant = await store.createGrant({ playerId, currency: "coin", amount: 100, reason: "Support correction", actor: "operator-1", now: new Date() });
    await expect(store.approveGrant(grant.id, "operator-1", new Date())).rejects.toBeInstanceOf(EconomyFourEyesViolationError);
  });
});

