import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ClanFeedPage, ClanInvitationView, ClanMessageView, ClanView, FriendRequestView, SocialOverview, SocialPlayer, SocialStore } from "./social-store.js";
import { ClanInvitationNotFoundError, ClanMembershipError, ClanMessageNotFoundError, ClanMessageRateLimitError, ClanNotFoundError, ClanPermissionError, FriendRequestNotFoundError, SocialConflictError, SocialPlayerNotFoundError, decodeClanFeedCursor, encodeClanFeedCursor } from "./social-store.js";

interface PlayerRow { id: string; display_name: string; level: number }
interface ClanRow { id: string; name: string; tag: string; member_count: string; member_limit: number; weekly_score: string; role?: "owner" | "officer" | "member" }
interface InvitationRow extends ClanRow { invitation_id: string; inviter_id: string; inviter_name: string; inviter_level: number; expires_at: Date }
interface MessageRow extends PlayerRow { message_id: string; body: string; status: "active" | "removed"; created_at: Date }

/** PostgreSQL social graph adapter with transactional friend and clan membership changes. */
export class PostgresSocialStore implements SocialStore {
  public constructor(private readonly pool: Pool) {}
  public static connect(connectionString: string): PostgresSocialStore {
    return new PostgresSocialStore(new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 }));
  }

  public async getOverview(playerId: string): Promise<SocialOverview> {
    await this.ensureProfile(this.pool, playerId);
    const playerResult = await this.pool.query<PlayerRow>(
      "SELECT p.id, s.display_name, p.level FROM players p JOIN social_profiles s ON s.player_id=p.id WHERE p.id=$1", [playerId],
    );
    const player = this.player(playerResult.rows[0]);
    const friends = await this.pool.query<PlayerRow>(
      `SELECT p.id, profiles.display_name, p.level
         FROM friendships f
         JOIN players p ON p.id=CASE WHEN f.player_low=$1 THEN f.player_high ELSE f.player_low END
         JOIN social_profiles profiles ON profiles.player_id=p.id
        WHERE f.player_low=$1 OR f.player_high=$1 ORDER BY profiles.display_name LIMIT 100`, [playerId],
    );
    const incoming = await this.pool.query<PlayerRow & { request_id: string; created_at: Date }>(
      `SELECT requests.id AS request_id, requests.created_at, p.id, profiles.display_name, p.level
         FROM friend_requests requests JOIN players p ON p.id=requests.sender_id
         JOIN social_profiles profiles ON profiles.player_id=p.id
        WHERE requests.recipient_id=$1 AND requests.status='pending' ORDER BY requests.created_at DESC LIMIT 50`, [playerId],
    );
    const suggestions = await this.pool.query<PlayerRow>(
      `SELECT p.id, profiles.display_name, p.level FROM social_profiles profiles JOIN players p ON p.id=profiles.player_id
        WHERE p.id<>$1 AND p.status='active'
          AND NOT EXISTS (SELECT 1 FROM friendships f WHERE (f.player_low=$1 AND f.player_high=p.id) OR (f.player_high=$1 AND f.player_low=p.id))
          AND NOT EXISTS (SELECT 1 FROM friend_requests r WHERE r.status='pending' AND ((r.sender_id=$1 AND r.recipient_id=p.id) OR (r.recipient_id=$1 AND r.sender_id=p.id)))
        ORDER BY p.level DESC, profiles.display_name LIMIT 10`, [playerId],
    );
    const currentClan = await this.pool.query<ClanRow>(this.clanQuery("members.player_id=$1"), [playerId]);
    const discoverClans = await this.pool.query<ClanRow>(
      `SELECT clans.id,clans.name,clans.tag,clans.member_limit,clans.weekly_score,
              NULL::text AS role,
              (SELECT COUNT(*) FROM clan_members count_members WHERE count_members.clan_id=clans.id) AS member_count
         FROM clans WHERE clans.status='active'
          AND NOT EXISTS (SELECT 1 FROM clan_members own WHERE own.player_id=$1 AND own.clan_id=clans.id)
        ORDER BY clans.weekly_score DESC LIMIT 20`, [playerId],
    );
    const invitations = await this.pool.query<InvitationRow>(
      `SELECT invitations.id AS invitation_id,invitations.expires_at,
              clans.id,clans.name,clans.tag,clans.member_limit,clans.weekly_score,
              NULL::text AS role,
              (SELECT COUNT(*) FROM clan_members count_members WHERE count_members.clan_id=clans.id) AS member_count,
              inviter.id AS inviter_id,profiles.display_name AS inviter_name,inviter.level AS inviter_level
         FROM clan_invitations invitations
         JOIN clans ON clans.id=invitations.clan_id AND clans.status='active'
         JOIN players inviter ON inviter.id=invitations.inviter_id
         JOIN social_profiles profiles ON profiles.player_id=inviter.id
        WHERE invitations.recipient_id=$1 AND invitations.status='pending' AND invitations.expires_at>now()
        ORDER BY invitations.created_at DESC LIMIT 20`, [playerId],
    );
    return {
      player,
      friends: friends.rows.map((row) => this.player(row)),
      incomingRequests: incoming.rows.map((row) => ({ id: row.request_id, player: this.player(row), createdAt: row.created_at.toISOString() })),
      suggestions: suggestions.rows.map((row) => this.player(row)),
      currentClan: currentClan.rows[0] ? this.clan(currentClan.rows[0]) : null,
      discoverClans: discoverClans.rows.map((row) => this.clan(row)),
      incomingClanInvitations: invitations.rows.map((row) => ({
        id: row.invitation_id,
        clan: this.clan(row),
        inviter: { id: row.inviter_id, displayName: row.inviter_name, level: row.inviter_level, online: false },
        expiresAt: row.expires_at.toISOString(),
      })),
    };
  }

  public async sendFriendRequest(playerId: string, targetPlayerId: string): Promise<FriendRequestView> {
    if (playerId === targetPlayerId) throw new SocialConflictError();
    const target = await this.pool.query<PlayerRow>(
      "SELECT p.id, s.display_name, p.level FROM players p JOIN social_profiles s ON s.player_id=p.id WHERE p.id=$1 AND p.status='active'", [targetPlayerId],
    );
    if (!target.rows[0]) throw new SocialPlayerNotFoundError();
    const existing = await this.pool.query(
      `SELECT 1 FROM friendships WHERE (player_low=LEAST($1::uuid,$2::uuid) AND player_high=GREATEST($1::uuid,$2::uuid))
       UNION ALL SELECT 1 FROM friend_requests WHERE status='pending' AND ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)) LIMIT 1`,
      [playerId, targetPlayerId],
    );
    if (existing.rowCount) throw new SocialConflictError();
    const id = randomUUID(); const createdAt = new Date();
    try {
      await this.pool.query("INSERT INTO friend_requests (id,sender_id,recipient_id) VALUES ($1,$2,$3)", [id, playerId, targetPlayerId]);
    } catch (error) { if ((error as { code?: string }).code === "23505") throw new SocialConflictError(); throw error; }
    return { id, player: this.player(target.rows[0]), createdAt: createdAt.toISOString() };
  }

  public async acceptFriendRequest(playerId: string, requestId: string): Promise<SocialPlayer> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const request = await client.query<{ sender_id: string }>(
        "SELECT sender_id FROM friend_requests WHERE id=$1 AND recipient_id=$2 AND status='pending' FOR UPDATE", [requestId, playerId],
      );
      if (!request.rows[0]) throw new FriendRequestNotFoundError();
      const senderId = request.rows[0].sender_id;
      await client.query(
        "INSERT INTO friendships (player_low,player_high) VALUES (LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid)) ON CONFLICT DO NOTHING",
        [playerId, senderId],
      );
      await client.query("UPDATE friend_requests SET status='accepted',responded_at=now() WHERE id=$1", [requestId]);
      const sender = await client.query<PlayerRow>(
        "SELECT p.id, s.display_name, p.level FROM players p JOIN social_profiles s ON s.player_id=p.id WHERE p.id=$1", [senderId],
      );
      await client.query("COMMIT"); return this.player(sender.rows[0]);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async createClan(playerId: string, name: string, tag: string): Promise<ClanView> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN"); await this.ensureProfile(client, playerId);
      if ((await client.query("SELECT 1 FROM clan_members WHERE player_id=$1 FOR UPDATE", [playerId])).rowCount) throw new ClanMembershipError();
      const id = randomUUID();
      try { await client.query("INSERT INTO clans (id,name,tag,owner_id) VALUES ($1,$2,$3,$4)", [id, name, tag.toUpperCase(), playerId]); }
      catch (error) { if ((error as { code?: string }).code === "23505") throw new SocialConflictError(); throw error; }
      await client.query("INSERT INTO clan_members (clan_id,player_id,role) VALUES ($1,$2,'owner')", [id, playerId]);
      await client.query("UPDATE clan_invitations SET status='cancelled',responded_at=now() WHERE recipient_id=$1 AND status='pending'", [playerId]);
      await client.query("COMMIT");
      return { id, name, tag: tag.toUpperCase(), memberCount: 1, memberLimit: 50, weeklyScore: 0, role: "owner" };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async joinClan(playerId: string, clanId: string): Promise<ClanView> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN"); await this.ensureProfile(client, playerId);
      if ((await client.query("SELECT 1 FROM clan_members WHERE player_id=$1 FOR UPDATE", [playerId])).rowCount) throw new ClanMembershipError();
      const clan = await client.query<{ member_limit: number }>("SELECT member_limit FROM clans WHERE id=$1 AND status='active' FOR UPDATE", [clanId]);
      if (!clan.rows[0]) throw new ClanNotFoundError();
      const count = Number((await client.query<{ count: string }>("SELECT COUNT(*) AS count FROM clan_members WHERE clan_id=$1", [clanId])).rows[0]!.count);
      if (count >= clan.rows[0].member_limit) throw new ClanMembershipError();
      await client.query("INSERT INTO clan_members (clan_id,player_id,role) VALUES ($1,$2,'member')", [clanId, playerId]);
      await client.query("UPDATE clan_invitations SET status='cancelled',responded_at=now() WHERE recipient_id=$1 AND status='pending'", [playerId]);
      const result = await client.query<ClanRow>(this.clanQuery("clans.id=$1 AND members.player_id=$2"), [clanId, playerId]);
      await client.query("COMMIT"); return this.clan(result.rows[0]!);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async leaveClan(playerId: string): Promise<void> {
    const membership = await this.pool.query<{ role: string }>("SELECT role FROM clan_members WHERE player_id=$1", [playerId]);
    if (!membership.rows[0] || membership.rows[0].role === "owner") throw new ClanMembershipError();
    await this.pool.query("DELETE FROM clan_members WHERE player_id=$1", [playerId]);
  }

  public async inviteToClan(playerId: string, targetPlayerId: string): Promise<ClanInvitationView> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.ensureProfile(client, targetPlayerId);
      const membership = await client.query<{ clan_id: string; role: "owner" | "officer" | "member" }>(
        "SELECT clan_id,role FROM clan_members WHERE player_id=$1 FOR UPDATE", [playerId],
      );
      const actor = membership.rows[0];
      if (!actor) throw new ClanMembershipError();
      if (actor.role === "member") throw new ClanPermissionError();
      if ((await client.query("SELECT 1 FROM clan_members WHERE player_id=$1 FOR UPDATE", [targetPlayerId])).rowCount) {
        throw new ClanMembershipError();
      }
      const id = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 86_400_000);
      await client.query(
        "UPDATE clan_invitations SET status='expired',responded_at=now() WHERE clan_id=$1 AND recipient_id=$2 AND status='pending' AND expires_at<=now()",
        [actor.clan_id, targetPlayerId],
      );
      try {
        await client.query(
          "INSERT INTO clan_invitations (id,clan_id,inviter_id,recipient_id,expires_at) VALUES ($1,$2,$3,$4,$5)",
          [id, actor.clan_id, playerId, targetPlayerId, expiresAt],
        );
      } catch (error) {
        if ((error as { code?: string }).code === "23505") throw new SocialConflictError();
        throw error;
      }
      const clan = await client.query<ClanRow>(
        `SELECT clans.id,clans.name,clans.tag,clans.member_limit,clans.weekly_score,NULL::text AS role,
                (SELECT COUNT(*) FROM clan_members count_members WHERE count_members.clan_id=clans.id) AS member_count
           FROM clans WHERE clans.id=$1 AND clans.status='active'`, [actor.clan_id],
      );
      const inviter = await client.query<PlayerRow>(
        "SELECT p.id,s.display_name,p.level FROM players p JOIN social_profiles s ON s.player_id=p.id WHERE p.id=$1", [playerId],
      );
      await client.query("COMMIT");
      return { id, clan: this.clan(clan.rows[0]!), inviter: this.player(inviter.rows[0]), expiresAt: expiresAt.toISOString() };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async acceptClanInvitation(playerId: string, invitationId: string): Promise<ClanView> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.ensureProfile(client, playerId);
      const invitation = await client.query<{ clan_id: string }>(
        `SELECT clan_id FROM clan_invitations
          WHERE id=$1 AND recipient_id=$2 AND status='pending' AND expires_at>now() FOR UPDATE`,
        [invitationId, playerId],
      );
      const pending = invitation.rows[0];
      if (!pending) throw new ClanInvitationNotFoundError();
      if ((await client.query("SELECT 1 FROM clan_members WHERE player_id=$1 FOR UPDATE", [playerId])).rowCount) {
        throw new ClanMembershipError();
      }
      const clan = await client.query<{ member_limit: number }>(
        "SELECT member_limit FROM clans WHERE id=$1 AND status='active' FOR UPDATE", [pending.clan_id],
      );
      if (!clan.rows[0]) throw new ClanNotFoundError();
      const count = Number((await client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM clan_members WHERE clan_id=$1", [pending.clan_id],
      )).rows[0]!.count);
      if (count >= clan.rows[0].member_limit) throw new ClanMembershipError();
      await client.query("INSERT INTO clan_members (clan_id,player_id,role) VALUES ($1,$2,'member')", [pending.clan_id, playerId]);
      await client.query("UPDATE clan_invitations SET status='accepted',responded_at=now() WHERE id=$1", [invitationId]);
      await client.query(
        "UPDATE clan_invitations SET status='cancelled',responded_at=now() WHERE recipient_id=$1 AND status='pending' AND id<>$2",
        [playerId, invitationId],
      );
      const result = await client.query<ClanRow>(this.clanQuery("clans.id=$1 AND members.player_id=$2"), [pending.clan_id, playerId]);
      await client.query("COMMIT");
      return this.clan(result.rows[0]!);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async listClanFeed(playerId: string, cursor: string | undefined, limit: number): Promise<ClanFeedPage> {
    const membership = await this.pool.query<{ clan_id: string }>("SELECT clan_id FROM clan_members WHERE player_id=$1", [playerId]);
    if (!membership.rows[0]) throw new ClanMembershipError();
    const decoded = cursor ? decodeClanFeedCursor(cursor) : null;
    if (cursor && !decoded) throw new RangeError("invalid clan feed cursor");
    const messages = await this.pool.query<MessageRow>(
      `SELECT messages.id AS message_id,messages.body,messages.status,messages.created_at,
              players.id,profiles.display_name,players.level
         FROM clan_messages messages JOIN players ON players.id=messages.author_id
         JOIN social_profiles profiles ON profiles.player_id=players.id
        WHERE messages.clan_id=$1
          AND ($2::timestamptz IS NULL OR (messages.created_at,messages.id)<($2::timestamptz,$3::uuid))
        ORDER BY messages.created_at DESC,messages.id DESC LIMIT $4`,
      [membership.rows[0].clan_id, decoded?.createdAt ?? null, decoded?.id ?? null, limit + 1],
    );
    const hasMore = messages.rows.length > limit;
    const selected = messages.rows.slice(0, limit);
    const last = selected.at(-1);
    return {
      messages: selected.map((row) => this.message(row)),
      nextCursor: hasMore && last ? encodeClanFeedCursor({ createdAt: last.created_at.toISOString(), id: last.message_id }) : null,
    };
  }

  public async postClanMessage(playerId: string, body: string): Promise<ClanMessageView> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const membership = await client.query<{ clan_id: string }>(
        "SELECT clan_id FROM clan_members WHERE player_id=$1 FOR UPDATE", [playerId],
      );
      if (!membership.rows[0]) throw new ClanMembershipError();
      const recent = Number((await client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM clan_messages WHERE author_id=$1 AND created_at>now()-interval '1 minute'", [playerId],
      )).rows[0]!.count);
      if (recent >= 5) throw new ClanMessageRateLimitError();
      const id = randomUUID();
      const inserted = await client.query<{ created_at: Date }>(
        "INSERT INTO clan_messages (id,clan_id,author_id,body) VALUES ($1,$2,$3,$4) RETURNING created_at",
        [id, membership.rows[0].clan_id, playerId, body],
      );
      const author = await client.query<PlayerRow>(
        "SELECT p.id,s.display_name,p.level FROM players p JOIN social_profiles s ON s.player_id=p.id WHERE p.id=$1", [playerId],
      );
      await client.query("COMMIT");
      return { id, author: this.player(author.rows[0]), body, status: "active", createdAt: inserted.rows[0]!.created_at.toISOString() };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async removeClanMessage(playerId: string, messageId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const membership = await client.query<{ clan_id: string; role: "owner" | "officer" | "member" }>(
        "SELECT clan_id,role FROM clan_members WHERE player_id=$1 FOR UPDATE", [playerId],
      );
      const actor = membership.rows[0];
      if (!actor) throw new ClanMembershipError();
      const message = await client.query<{ author_id: string; clan_id: string }>(
        "SELECT author_id,clan_id FROM clan_messages WHERE id=$1 FOR UPDATE", [messageId],
      );
      if (!message.rows[0] || message.rows[0].clan_id !== actor.clan_id) throw new ClanMessageNotFoundError();
      if (message.rows[0].author_id !== playerId && actor.role === "member") throw new ClanPermissionError();
      await client.query(
        "UPDATE clan_messages SET status='removed',body='[removed]',removed_at=now(),removed_by=$2 WHERE id=$1 AND status='active'",
        [messageId, playerId],
      );
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async close(): Promise<void> { await this.pool.end(); }

  private async ensureProfile(queryable: Pick<Pool, "query"> | Pick<PoolClient, "query">, playerId: string): Promise<void> {
    const inserted = await queryable.query(
      `INSERT INTO social_profiles (player_id,display_name)
       SELECT id, 'PLAYER-' || upper(left(replace(id::text,'-',''),6)) FROM players WHERE id=$1
       ON CONFLICT (player_id) DO NOTHING`, [playerId],
    );
    if (!inserted.rowCount && !(await queryable.query("SELECT 1 FROM social_profiles WHERE player_id=$1", [playerId])).rowCount) throw new SocialPlayerNotFoundError();
  }
  private player(row?: PlayerRow): SocialPlayer { if (!row) throw new SocialPlayerNotFoundError(); return { id: row.id, displayName: row.display_name, level: row.level, online: false }; }
  private message(row: MessageRow): ClanMessageView {
    return { id: row.message_id, author: this.player(row), body: row.status === "active" ? row.body : null, status: row.status, createdAt: row.created_at.toISOString() };
  }
  private clan(row: ClanRow): ClanView { return { id: row.id, name: row.name, tag: row.tag, memberCount: Number(row.member_count), memberLimit: row.member_limit, weeklyScore: Number(row.weekly_score), ...(row.role ? { role: row.role } : {}) }; }
  private clanQuery(where: string): string {
    return `SELECT clans.id,clans.name,clans.tag,clans.member_limit,clans.weekly_score,members.role,
      (SELECT COUNT(*) FROM clan_members count_members WHERE count_members.clan_id=clans.id) AS member_count
      FROM clans LEFT JOIN clan_members members ON members.clan_id=clans.id WHERE clans.status='active' AND ${where}`;
  }
}
