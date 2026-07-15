import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresSocialStore } from "./postgres-social-store.js";
import { ClanMembershipError, SocialConflictError } from "./social-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("Postgres social graph", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresSocialStore(pool);
  const firstPlayer = randomUUID();
  const secondPlayer = randomUUID();

  beforeAll(async () => {
    const exists = await pool.query<{ table_name: string | null }>("SELECT to_regclass('public.players') AS table_name");
    if (!exists.rows[0]?.table_name) {
      const core = await readFile(new URL("../../../../infra/postgres/001_core.sql", import.meta.url), "utf8");
      await pool.query(core);
    }
    const socialExists = await pool.query<{ table_name: string | null }>("SELECT to_regclass('public.social_profiles') AS table_name");
    if (!socialExists.rows[0]?.table_name) {
      const social = await readFile(new URL("../../../../infra/postgres/014_social.sql", import.meta.url), "utf8");
      await pool.query(social);
    }
    await pool.query("INSERT INTO players (id,level) VALUES ($1,12),($2,27)", [firstPlayer, secondPlayer]);
    await store.getOverview(firstPlayer);
    await store.getOverview(secondPlayer);
  });

  afterAll(async () => store.close());

  it("persists friend requests and accepted symmetric friendships", async () => {
    const request = await store.sendFriendRequest(firstPlayer, secondPlayer);
    await expect(store.sendFriendRequest(firstPlayer, secondPlayer)).rejects.toBeInstanceOf(SocialConflictError);
    const incoming = await store.getOverview(secondPlayer);
    expect(incoming.incomingRequests[0]?.id).toBe(request.id);
    const friend = await store.acceptFriendRequest(secondPlayer, request.id);
    expect(friend.id).toBe(firstPlayer);
    const [first, second] = await Promise.all([store.getOverview(firstPlayer), store.getOverview(secondPlayer)]);
    expect(first.friends.map((item) => item.id)).toContain(secondPlayer);
    expect(second.friends.map((item) => item.id)).toContain(firstPlayer);
  });

  it("enforces one durable clan membership per player", async () => {
    const clan = await store.createClan(firstPlayer, `Aurora ${firstPlayer.slice(0, 6)}`, firstPlayer.slice(0, 6).toUpperCase());
    const joined = await store.joinClan(secondPlayer, clan.id);
    expect(joined.memberCount).toBe(2);
    await expect(store.createClan(secondPlayer, "Second Clan", "SECOND")).rejects.toBeInstanceOf(ClanMembershipError);
    await store.leaveClan(secondPlayer);
    expect((await store.getOverview(secondPlayer)).currentClan).toBeNull();
  });
});
