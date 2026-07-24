import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  InventoryIdempotencyConflictError,
  InventoryInsufficientQuantityError,
  type GrantInventoryCommand,
} from "./inventory.js";
import { PostgresInventoryStore } from "./postgres-inventory-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("PostgresInventoryStore integration", () => {
  const schema = `inventory_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  const store = new PostgresInventoryStore(pool);
  const playerId = randomUUID();

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const client = await pool.connect();
    try {
      const core = await readFile(new URL("../../../../infra/postgres/001_core.sql", import.meta.url), "utf8");
      const inventory = await readFile(new URL("../../../../infra/postgres/036_inventory_ledger_v1.sql", import.meta.url), "utf8");
      await client.query(core);
      await client.query(inventory);
      await client.query("INSERT INTO players (id) VALUES ($1)", [playerId]);
      await client.query(
        `INSERT INTO inventory_item_definitions
           (item_id,version,category,rarity,max_stack,tradable,metadata)
         VALUES
           ('golden-key',1,'key','epic',10,false,'{}'),
           ('summer-ticket',1,'event_item','rare',100,false,'{}')`,
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
  });

  it("splits grants across bounded stacks and replays idempotently", async () => {
    const command = grantCommand({ quantity: 25, idempotencyKey: "grant:1", referenceId: "loot:1" });
    const first = await store.grant(command, new Date("2026-07-24T10:00:00.000Z"));
    const replay = await store.grant(command, new Date("2026-07-24T10:01:00.000Z"));

    expect(first).toMatchObject({
      operationType: "grant", itemId: "golden-key", quantity: 25, remainingQuantity: 25, replayed: false,
    });
    expect(first.changedStacks.map((stack) => stack.quantity)).toEqual([10, 10, 5]);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(store.grant({ ...command, quantity: 26 }, new Date("2026-07-24T10:02:00.000Z")))
      .rejects.toBeInstanceOf(InventoryIdempotencyConflictError);

    const second = await store.grant(
      grantCommand({ quantity: 8, idempotencyKey: "grant:2", referenceId: "loot:2" }),
      new Date("2026-07-24T10:03:00.000Z"),
    );
    expect(second.changedStacks.map((stack) => stack.quantity)).toEqual([10, 3]);
    expect(second.remainingQuantity).toBe(33);
    expect((await store.list(playerId)).map((stack) => stack.quantity)).toEqual([10, 10, 10, 3]);
  });

  it("consumes atomically across stacks and rolls back insufficient requests", async () => {
    const first = await store.consume({
      operationType: "consume",
      playerId,
      idempotencyKey: "consume:1",
      itemId: "golden-key",
      itemVersion: 1,
      quantity: 23,
      eventId: null,
      reason: "chest_open",
      source: "loot",
      referenceId: "chest:1",
    }, new Date("2026-07-24T11:00:00.000Z"));

    expect(first).toMatchObject({ operationType: "consume", quantity: 23, remainingQuantity: 10, replayed: false });
    expect(first.changedStacks.map((stack) => stack.quantity)).toEqual([0, 0, 7]);
    expect(await store.consume({
      operationType: "consume",
      playerId,
      idempotencyKey: "consume:1",
      itemId: "golden-key",
      itemVersion: 1,
      quantity: 23,
      eventId: null,
      reason: "chest_open",
      source: "loot",
      referenceId: "chest:1",
    }, new Date("2026-07-24T11:01:00.000Z"))).toEqual({ ...first, replayed: true });

    await expect(store.consume({
      operationType: "consume",
      playerId,
      idempotencyKey: "consume:insufficient",
      itemId: "golden-key",
      itemVersion: 1,
      quantity: 11,
      eventId: null,
      reason: "chest_open",
      source: "loot",
      referenceId: "chest:2",
    }, new Date("2026-07-24T11:02:00.000Z"))).rejects.toBeInstanceOf(InventoryInsufficientQuantityError);

    expect((await store.list(playerId)).map((stack) => stack.quantity)).toEqual([7, 3]);
    const failedOperation = await pool.query(
      "SELECT count(*)::int AS count FROM inventory_operations WHERE idempotency_key='consume:insufficient'",
    );
    expect(failedOperation.rows[0]?.count).toBe(0);
  });

  it("expires due stacks through the server cleanup path", async () => {
    const expiresAt = new Date("2026-07-25T00:00:00.000Z");
    await store.grant({
      operationType: "grant",
      playerId,
      idempotencyKey: "event:grant",
      itemId: "summer-ticket",
      itemVersion: 1,
      quantity: 4,
      expiresAt,
      eventId: "summer-2026",
      reason: "event_reward",
      source: "live_event",
      referenceId: "event:summer:milestone:1",
    }, new Date("2026-07-24T12:00:00.000Z"));

    expect((await store.list(playerId, new Date("2026-07-24T23:59:00.000Z"))).find(
      (stack) => stack.itemId === "summer-ticket",
    )).toMatchObject({ quantity: 4, eventId: "summer-2026" });
    expect(await store.expireDue(new Date("2026-07-25T00:01:00.000Z"), 10)).toBe(1);
    expect((await store.list(playerId, new Date("2026-07-25T00:01:00.000Z"))).some(
      (stack) => stack.itemId === "summer-ticket",
    )).toBe(false);
  });

  it("keeps every ledger transition valid and emits one outbox event per operation", async () => {
    const audit = await pool.query<{ invalid: string; entries: string }>(
      `SELECT count(*) FILTER (WHERE quantity_after <> quantity_before + delta) AS invalid,
              count(*) AS entries
         FROM inventory_ledger`,
    );
    expect(audit.rows[0]).toMatchObject({ invalid: "0", entries: "10" });

    const operationCount = await pool.query<{ count: string }>("SELECT count(*) FROM inventory_operations");
    const outboxCount = await pool.query<{ count: string }>(
      "SELECT count(*) FROM outbox_events WHERE aggregate_type='inventory'",
    );
    const eventTypes = await pool.query<{ event_type: string; count: string }>(
      `SELECT event_type,count(*)::text AS count
         FROM outbox_events
        WHERE aggregate_type='inventory'
        GROUP BY event_type
        ORDER BY event_type`,
    );
    expect(operationCount.rows[0]?.count).toBe("5");
    expect(outboxCount.rows[0]?.count).toBe(operationCount.rows[0]?.count);
    expect(eventTypes.rows).toEqual([
      { event_type: "inventory.consumed", count: "1" },
      { event_type: "inventory.expired", count: "1" },
      { event_type: "inventory.granted", count: "3" },
    ]);
  });

  function grantCommand(overrides: {
    readonly quantity: number;
    readonly idempotencyKey: string;
    readonly referenceId: string;
  }): GrantInventoryCommand {
    return {
      operationType: "grant",
      playerId,
      idempotencyKey: overrides.idempotencyKey,
      itemId: "golden-key",
      itemVersion: 1,
      quantity: overrides.quantity,
      expiresAt: null,
      eventId: null,
      reason: "loot_reward",
      source: "loot",
      referenceId: overrides.referenceId,
      metadata: { tableVersion: 1 },
    };
  }
});
