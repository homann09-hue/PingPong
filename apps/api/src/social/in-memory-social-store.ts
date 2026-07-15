import { randomUUID } from "node:crypto";
import type { ClanView, FriendRequestView, SocialOverview, SocialPlayer, SocialStore } from "./social-store.js";
import { ClanMembershipError, ClanNotFoundError, FriendRequestNotFoundError, SocialConflictError, SocialPlayerNotFoundError } from "./social-store.js";

interface MutableClan { id: string; name: string; tag: string; memberLimit: number; weeklyScore: number }
interface PendingRequest { id: string; senderId: string; recipientId: string; createdAt: string }

/** Deterministic demo adapter with the same invariants as the PostgreSQL social store. */
export class InMemorySocialStore implements SocialStore {
  private readonly players = new Map<string, SocialPlayer>();
  private readonly requests = new Map<string, PendingRequest>();
  private readonly friendships = new Set<string>();
  private readonly clans = new Map<string, MutableClan>();
  private readonly memberships = new Map<string, { clanId: string; role: "owner" | "officer" | "member" }>();

  public constructor(private readonly localPlayerId: string) {
    const players: SocialPlayer[] = [
      { id: localPlayerId, displayName: "AURORA PLAYER", level: 12, online: true },
      { id: "00000000-0000-4000-8000-000000000101", displayName: "LuckyLuna", level: 38, online: true },
      { id: "00000000-0000-4000-8000-000000000102", displayName: "SpinMaster", level: 27, online: false },
      { id: "00000000-0000-4000-8000-000000000103", displayName: "RoyalAce", level: 51, online: true },
    ];
    for (const player of players) this.players.set(player.id, player);
    for (const clan of [
      { id: "10000000-0000-4000-8000-000000000001", name: "Royal Spinners", tag: "ROYAL", memberLimit: 50, weeklyScore: 8_400_000 },
      { id: "10000000-0000-4000-8000-000000000002", name: "Lucky Dragons", tag: "LUCKY", memberLimit: 50, weeklyScore: 7_900_000 },
      { id: "10000000-0000-4000-8000-000000000003", name: "Aurora Legends", tag: "AURORA", memberLimit: 50, weeklyScore: 7_200_000 },
    ]) this.clans.set(clan.id, clan);
    this.memberships.set(players[1]!.id, { clanId: "10000000-0000-4000-8000-000000000003", role: "member" });
  }

  public async getOverview(playerId: string): Promise<SocialOverview> {
    const player = this.ensureAuthenticatedPlayer(playerId);
    const friends = [...this.friendships].filter((key) => key.includes(playerId)).map((key) => {
      const [left, right] = key.split(":"); return this.requirePlayer(left === playerId ? right! : left!);
    });
    const requested = new Set([...this.requests.values()].flatMap((item) => [item.senderId, item.recipientId]));
    const suggestions = [...this.players.values()].filter((candidate) =>
      candidate.id !== playerId && !friends.some((friend) => friend.id === candidate.id) && !requested.has(candidate.id),
    ).slice(0, 10);
    const incomingRequests = [...this.requests.values()].filter((request) => request.recipientId === playerId).map((request) => ({
      id: request.id, player: this.requirePlayer(request.senderId), createdAt: request.createdAt,
    }));
    const membership = this.memberships.get(playerId);
    return {
      player, friends, incomingRequests, suggestions,
      currentClan: membership ? this.clanView(this.clans.get(membership.clanId)!, membership.role) : null,
      discoverClans: [...this.clans.values()].filter((clan) => clan.id !== membership?.clanId).map((clan) => this.clanView(clan)),
    };
  }

  public async sendFriendRequest(playerId: string, targetPlayerId: string): Promise<FriendRequestView> {
    this.ensureAuthenticatedPlayer(playerId); const target = this.requirePlayer(targetPlayerId);
    if (playerId === targetPlayerId || this.friendships.has(this.friendKey(playerId, targetPlayerId))) throw new SocialConflictError();
    if ([...this.requests.values()].some((item) =>
      (item.senderId === playerId && item.recipientId === targetPlayerId) ||
      (item.senderId === targetPlayerId && item.recipientId === playerId))) throw new SocialConflictError();
    const request = { id: randomUUID(), senderId: playerId, recipientId: targetPlayerId, createdAt: new Date().toISOString() };
    this.requests.set(request.id, request);
    return { id: request.id, player: target, createdAt: request.createdAt };
  }

  public async acceptFriendRequest(playerId: string, requestId: string): Promise<SocialPlayer> {
    this.ensureAuthenticatedPlayer(playerId);
    const request = this.requests.get(requestId);
    if (!request || request.recipientId !== playerId) throw new FriendRequestNotFoundError();
    this.requests.delete(requestId); this.friendships.add(this.friendKey(request.senderId, request.recipientId));
    return this.requirePlayer(request.senderId);
  }

  public async createClan(playerId: string, name: string, tag: string): Promise<ClanView> {
    this.ensureAuthenticatedPlayer(playerId);
    if (this.memberships.has(playerId) || [...this.clans.values()].some((clan) =>
      clan.name.toLowerCase() === name.toLowerCase() || clan.tag.toLowerCase() === tag.toLowerCase())) throw new ClanMembershipError();
    const clan = { id: randomUUID(), name, tag: tag.toUpperCase(), memberLimit: 50, weeklyScore: 0 };
    this.clans.set(clan.id, clan); this.memberships.set(playerId, { clanId: clan.id, role: "owner" });
    return this.clanView(clan, "owner");
  }

  public async joinClan(playerId: string, clanId: string): Promise<ClanView> {
    this.ensureAuthenticatedPlayer(playerId); const clan = this.clans.get(clanId);
    if (!clan) throw new ClanNotFoundError();
    if (this.memberships.has(playerId) || this.memberCount(clanId) >= clan.memberLimit) throw new ClanMembershipError();
    this.memberships.set(playerId, { clanId, role: "member" }); return this.clanView(clan, "member");
  }

  public async leaveClan(playerId: string): Promise<void> {
    this.ensureAuthenticatedPlayer(playerId);
    const membership = this.memberships.get(playerId);
    if (!membership || membership.role === "owner") throw new ClanMembershipError();
    this.memberships.delete(playerId);
  }

  public async close(): Promise<void> {}

  private ensureAuthenticatedPlayer(id: string): SocialPlayer {
    const existing = this.players.get(id);
    if (existing) return existing;
    const player = {
      id,
      displayName: `AURORA ${id.slice(0, 8).toUpperCase()}`,
      level: 12,
      online: true,
    };
    this.players.set(id, player);
    return player;
  }

  private requirePlayer(id: string): SocialPlayer { const value = this.players.get(id); if (!value) throw new SocialPlayerNotFoundError(); return value; }
  private friendKey(left: string, right: string): string { return [left, right].sort().join(":"); }
  private memberCount(clanId: string): number { return [...this.memberships.values()].filter((item) => item.clanId === clanId).length; }
  private clanView(clan: MutableClan, role?: "owner" | "officer" | "member"): ClanView {
    return { ...clan, memberCount: this.memberCount(clan.id), ...(role ? { role } : {}) };
  }
}
