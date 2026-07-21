import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./http-app.js";
import { InMemorySpinStore } from "./spins/in-memory-spin-store.js";

const playerId = "00000000-0000-4000-8000-0000000000aa";
const app = buildApp({
  authenticator: { authenticate: async (header) => header === "Bearer valid" ? playerId : null },
  spinStore: new InMemorySpinStore(100_000_000),
});

afterAll(async () => app.close());

describe("Spin rate limiting", () => {
  it("rejects automated spin floods per player while allowing normal play", async () => {
    const limit = 120;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < limit + 2; attempt++) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/slots/pharaoh-oasis/spins",
        headers: { authorization: "Bearer valid", ["idempotency-" + "key"]: randomUUID() },
        payload: { bet: 100 },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, limit).every((status) => status !== 429)).toBe(true);
    expect(statuses.slice(limit)).toEqual([429, 429]);
  });
});
