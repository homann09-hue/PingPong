import { describe, expect, it } from "vitest";
import { InMemoryEconomyAdminStore } from "../admin/in-memory-economy-admin-store.js";
import { InMemorySpinStore } from "../spins/in-memory-spin-store.js";
import { InMemoryOperationsStore } from "./in-memory-operations-store.js";

describe("InMemoryOperationsStore", () => {
  it("reflects the live demo economy approval queue without exposing grant details", async () => {
    const playerId = "00000000-0000-4000-8000-000000000001";
    const economy = new InMemoryEconomyAdminStore(new InMemorySpinStore(), playerId);
    const operations = new InMemoryOperationsStore(economy);
    await economy.createGrant({ playerId, currency: "gem", amount: 20, reason: "Operations queue test", actor: "support", now: new Date() });
    await expect(operations.snapshot(new Date())).resolves.toMatchObject({ pendingEconomyGrants: 1, adminActionsLast24Hours: 1 });
  });
});

