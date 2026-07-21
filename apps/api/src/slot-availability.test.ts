import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./http-app.js";
import { InMemorySpinStore } from "./spins/in-memory-spin-store.js";
import { InMemorySlotAvailabilityStore } from "./liveops/slot-availability-store.js";
import { DemoAdminAuthenticator } from "./admin/admin-auth.js";

const playerId = "00000000-0000-4000-8000-0000000000bb";
const slotAvailabilityStore = new InMemorySlotAvailabilityStore();
const app = buildApp({
  authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
  spinStore: new InMemorySpinStore(100_000_000),
  adminAuthenticator: new DemoAdminAuthenticator(),
  slotAvailabilityStore,
});

afterAll(async () => app.close());

const spinHeaders = { authorization: "Bearer valid", ["idempotency-" + "key"]: randomUUID() };

describe("Slot availability", () => {
  it("blocks spins while a slot is under maintenance and releases them afterwards", async () => {
    const before = await app.inject({ method: "POST", url: "/v1/slots/dragon-peak/spins",
      headers: { ...spinHeaders, ["idempotency-" + "key"]: randomUUID() }, payload: { bet: 100 } });
    expect(before.statusCode).not.toBe(503);

    await slotAvailabilityStore.set({ slotId: "dragon-peak", status: "maintenance", message: "Wartung", actor: "ops" }, new Date());
    const blocked = await app.inject({ method: "POST", url: "/v1/slots/dragon-peak/spins",
      headers: { ...spinHeaders, ["idempotency-" + "key"]: randomUUID() }, payload: { bet: 100 } });
    expect(blocked.statusCode).toBe(503);
    expect(blocked.json()).toMatchObject({ code: "SLOT_UNDER_MAINTENANCE", message: "Wartung" });

    await slotAvailabilityStore.set({ slotId: "dragon-peak", status: "live", message: null, actor: "ops" }, new Date());
    const released = await app.inject({ method: "POST", url: "/v1/slots/dragon-peak/spins",
      headers: { ...spinHeaders, ["idempotency-" + "key"]: randomUUID() }, payload: { bet: 100 } });
    expect(released.statusCode).not.toBe(503);
  });

  it("rejects unknown slots and invalid states on the admin route", async () => {
    const unknown = await app.inject({ method: "PUT", url: "/admin/v1/slots/does-not-exist/availability",
      headers: { authorization: "Bearer local-admin-publisher" }, payload: { status: "maintenance" } });
    expect(unknown.statusCode).toBe(404);

    const invalid = await app.inject({ method: "PUT", url: "/admin/v1/slots/vegas-gold/availability",
      headers: { authorization: "Bearer local-admin-publisher" }, payload: { status: "paused" } });
    expect(invalid.statusCode).toBe(400);
  });

  it("requires an authenticated publisher role", async () => {
    const anonymous = await app.inject({ method: "PUT", url: "/admin/v1/slots/vegas-gold/availability", payload: { status: "disabled" } });
    expect(anonymous.statusCode).toBe(401);
  });
});
