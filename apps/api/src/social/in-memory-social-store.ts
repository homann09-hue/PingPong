import { randomUUID } from "node:crypto";
import type { ClanFeedPage, ClanInvitationView, ClanMemberView, ClanMessageReportReason, ClanMessageReportView, ClanMessageView, ClanRole, ClanView, FriendRequestView, ModerationAuditEntry, ModerationCaseStatus, ModerationCaseView, ModerationDecision, SocialOverview, SocialPlayer, SocialStore } from "./social-store.js";
import { ClanInvitationNotFoundError, ClanMemberNotFoundError, ClanMembershipError, ClanMessageNotFoundError, ClanMessageRateLimitError, ClanMessageReportConflictError, ClanNotFoundError, ClanOfficerLimitError, ClanPermissionError, FriendRequestNotFoundError, ModerationCaseNotFoundError, ModerationCaseStateError, SocialConflictError, SocialPlayerNotFoundError, decodeClanFeedCursor, encodeClanFeedCursor } from "./social-store.js";

interface MutableClan { id: string; name: string; tag: string; memberLimit: number; weeklyScore: number }
interface PendingRequest { id: string; senderId: string; recipientId: string; createdAt: string }
interface MutableInvitation { id: string; clanId: string; inviterId: string; recipientId: string; status: "pending" | "accepted" | "cancelled"; expiresAt: string }
interface MutableMessage { id: string; clanId: string; authorId: string; body: string; status: "active" | "removed"; createdAt: string }
interface MutableReport { id: string; caseId: string; reporterId: string; reason: ClanMessageReportReason; details: string | null; createdAt: string }
interface MutableCase { id: string; clanId: string; messageId: string; messageBody: string; authorId: string; status: ModerationCaseStatus; firstReportedAt: string; lastReportedAt: string; resolvedAt: string | null; resolvedBy: string | null; decision: ModerationDecision | null; note: string | null }

/** Deterministic demo adapter with the same invariants as the PostgreSQL social store. */
export class InMemorySocialStore implements SocialStore {
  private readonly players = new Map<string, SocialPlayer>();
  private readonly requests = new Map<string, PendingRequest>();
  private readonly friendships = new Set<string>();
  private readonly clans = new Map<string, MutableClan>();
  private readonly memberships = new Map<string, { clanId: string; role: ClanRole; joinedAt: string }>();
  private readonly invitations = new Map<string, MutableInvitation>();
  private readonly messages = new Map<string, MutableMessage>();
  private readonly reports = new Map<string, MutableReport>();
  private readonly moderationCases = new Map<string, MutableCase>();
  private readonly moderationAudit: ModerationAuditEntry[] = [];

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
    this.memberships.set(players[1]!.id, { clanId: "10000000-0000-4000-8000-000000000003", role: "member", joinedAt: new Date().toISOString() });
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
      incomingClanInvitations: [...this.invitations.values()]
        .filter((invitation) => invitation.recipientId === playerId && invitation.status === "pending" && Date.parse(invitation.expiresAt) > Date.now())
        .map((invitation) => this.invitationView(invitation)),
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
    this.clans.set(clan.id, clan); this.memberships.set(playerId, { clanId: clan.id, role: "owner", joinedAt: new Date().toISOString() });
    this.cancelInvitationsFor(playerId);
    return this.clanView(clan, "owner");
  }

  public async joinClan(playerId: string, clanId: string): Promise<ClanView> {
    this.ensureAuthenticatedPlayer(playerId); const clan = this.clans.get(clanId);
    if (!clan) throw new ClanNotFoundError();
    if (this.memberships.has(playerId) || this.memberCount(clanId) >= clan.memberLimit) throw new ClanMembershipError();
    this.memberships.set(playerId, { clanId, role: "member", joinedAt: new Date().toISOString() }); this.cancelInvitationsFor(playerId); return this.clanView(clan, "member");
  }

  public async leaveClan(playerId: string): Promise<void> {
    this.ensureAuthenticatedPlayer(playerId);
    const membership = this.memberships.get(playerId);
    if (!membership || membership.role === "owner") throw new ClanMembershipError();
    this.memberships.delete(playerId);
  }

  public async inviteToClan(playerId: string, targetPlayerId: string): Promise<ClanInvitationView> {
    this.ensureAuthenticatedPlayer(playerId);
    const target = this.requirePlayer(targetPlayerId);
    const membership = this.requireClanMembership(playerId);
    if (membership.role === "member") throw new ClanPermissionError();
    if (this.memberships.has(target.id)) throw new ClanMembershipError();
    if ([...this.invitations.values()].some((value) => value.clanId === membership.clanId
      && value.recipientId === target.id && value.status === "pending" && Date.parse(value.expiresAt) > Date.now())) {
      throw new SocialConflictError();
    }
    const invitation: MutableInvitation = {
      id: randomUUID(), clanId: membership.clanId, inviterId: playerId, recipientId: target.id,
      status: "pending", expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    this.invitations.set(invitation.id, invitation);
    return this.invitationView(invitation);
  }

  public async acceptClanInvitation(playerId: string, invitationId: string): Promise<ClanView> {
    this.ensureAuthenticatedPlayer(playerId);
    const invitation = this.invitations.get(invitationId);
    if (!invitation || invitation.recipientId !== playerId || invitation.status !== "pending"
      || Date.parse(invitation.expiresAt) <= Date.now()) throw new ClanInvitationNotFoundError();
    if (this.memberships.has(playerId)) throw new ClanMembershipError();
    const clan = this.clans.get(invitation.clanId);
    if (!clan) throw new ClanNotFoundError();
    if (this.memberCount(clan.id) >= clan.memberLimit) throw new ClanMembershipError();
    invitation.status = "accepted";
    this.memberships.set(playerId, { clanId: clan.id, role: "member", joinedAt: new Date().toISOString() });
    this.cancelInvitationsFor(playerId, invitation.id);
    return this.clanView(clan, "member");
  }

  public async listClanMembers(playerId: string): Promise<readonly ClanMemberView[]> {
    const membership = this.requireClanMembership(playerId);
    return this.membersForClan(membership.clanId);
  }

  public async updateClanMemberRole(playerId: string, targetPlayerId: string, role: "officer" | "member"): Promise<ClanMemberView> {
    const actor = this.requireClanMembership(playerId);
    const target = this.memberships.get(targetPlayerId);
    if (!target || target.clanId !== actor.clanId) throw new ClanMemberNotFoundError();
    if (actor.role !== "owner" || playerId === targetPlayerId || target.role === "owner") throw new ClanPermissionError();
    if (role === "officer" && target.role !== "officer"
      && [...this.memberships.values()].filter((item) => item.clanId === actor.clanId && item.role === "officer").length >= 5) {
      throw new ClanOfficerLimitError();
    }
    if (target.role === role) return this.memberView(targetPlayerId, target);
    target.role = role;
    return this.memberView(targetPlayerId, target);
  }

  public async removeClanMember(playerId: string, targetPlayerId: string): Promise<void> {
    const actor = this.requireClanMembership(playerId);
    const target = this.memberships.get(targetPlayerId);
    if (!target || target.clanId !== actor.clanId) throw new ClanMemberNotFoundError();
    if (playerId === targetPlayerId || target.role === "owner" || actor.role === "member"
      || (actor.role === "officer" && target.role !== "member")) throw new ClanPermissionError();
    this.memberships.delete(targetPlayerId);
  }

  public async transferClanOwnership(playerId: string, targetPlayerId: string): Promise<readonly ClanMemberView[]> {
    const actor = this.requireClanMembership(playerId);
    const target = this.memberships.get(targetPlayerId);
    if (!target || target.clanId !== actor.clanId) throw new ClanMemberNotFoundError();
    if (actor.role !== "owner" || playerId === targetPlayerId) throw new ClanPermissionError();
    actor.role = "officer";
    target.role = "owner";
    return this.membersForClan(actor.clanId);
  }

  public async listClanFeed(playerId: string, cursor: string | undefined, limit: number): Promise<ClanFeedPage> {
    const membership = this.requireClanMembership(playerId);
    const decoded = cursor ? decodeClanFeedCursor(cursor) : null;
    if (cursor && !decoded) throw new RangeError("invalid clan feed cursor");
    const ordered = [...this.messages.values()]
      .filter((message) => message.clanId === membership.clanId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
      .filter((message) => !decoded || message.createdAt < decoded.createdAt
        || (message.createdAt === decoded.createdAt && message.id < decoded.id));
    const selected = ordered.slice(0, limit);
    const last = selected[selected.length - 1];
    return {
      messages: selected.map((message) => this.messageView(message)),
      nextCursor: ordered.length > selected.length && last
        ? encodeClanFeedCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  public async postClanMessage(playerId: string, body: string): Promise<ClanMessageView> {
    const membership = this.requireClanMembership(playerId);
    const recent = [...this.messages.values()].filter((message) => message.authorId === playerId
      && Date.parse(message.createdAt) > Date.now() - 60_000).length;
    if (recent >= 5) throw new ClanMessageRateLimitError();
    const message: MutableMessage = {
      id: randomUUID(), clanId: membership.clanId, authorId: playerId, body,
      status: "active", createdAt: new Date().toISOString(),
    };
    this.messages.set(message.id, message);
    return this.messageView(message);
  }

  public async removeClanMessage(playerId: string, messageId: string): Promise<void> {
    const membership = this.requireClanMembership(playerId);
    const message = this.messages.get(messageId);
    if (!message || message.clanId !== membership.clanId) throw new ClanMessageNotFoundError();
    if (message.authorId !== playerId && membership.role === "member") throw new ClanPermissionError();
    message.status = "removed";
  }

  public async reportClanMessage(playerId: string, messageId: string, reason: ClanMessageReportReason, details: string | null): Promise<ClanMessageReportView> {
    const membership = this.requireClanMembership(playerId);
    const message = this.messages.get(messageId);
    if (!message || message.clanId !== membership.clanId || message.status !== "active") throw new ClanMessageNotFoundError();
    if (message.authorId === playerId) throw new ClanMessageReportConflictError();
    let moderationCase = [...this.moderationCases.values()].find((item) => item.messageId === messageId);
    if (moderationCase?.status !== undefined && moderationCase.status !== "open") throw new ClanMessageReportConflictError();
    if (moderationCase && [...this.reports.values()].some((item) => item.caseId === moderationCase!.id && item.reporterId === playerId)) {
      throw new ClanMessageReportConflictError();
    }
    const now = new Date().toISOString();
    moderationCase ??= { id: randomUUID(), clanId: message.clanId, messageId, messageBody: message.body, authorId: message.authorId,
      status: "open", firstReportedAt: now, lastReportedAt: now, resolvedAt: null, resolvedBy: null, decision: null, note: null };
    moderationCase.lastReportedAt = now;
    this.moderationCases.set(moderationCase.id, moderationCase);
    const report: MutableReport = { id: randomUUID(), caseId: moderationCase.id, reporterId: playerId, reason, details, createdAt: now };
    this.reports.set(report.id, report);
    return { id: report.id, messageId, reason, status: moderationCase.status, createdAt: now };
  }

  public async listModerationCases(status: ModerationCaseStatus, limit: number): Promise<readonly ModerationCaseView[]> {
    return [...this.moderationCases.values()].filter((item) => item.status === status)
      .sort((left, right) => right.lastReportedAt.localeCompare(left.lastReportedAt)).slice(0, limit).map((item) => this.caseView(item));
  }

  public async resolveModerationCase(caseId: string, actor: string, decision: ModerationDecision, note: string): Promise<ModerationCaseView> {
    const moderationCase = this.moderationCases.get(caseId);
    if (!moderationCase) throw new ModerationCaseNotFoundError();
    if (moderationCase.status !== "open") throw new ModerationCaseStateError();
    if (decision === "remove_message") {
      const message = this.messages.get(moderationCase.messageId);
      if (message) message.status = "removed";
    }
    moderationCase.status = decision === "remove_message" ? "actioned" : "dismissed";
    moderationCase.resolvedAt = new Date().toISOString(); moderationCase.resolvedBy = actor; moderationCase.decision = decision; moderationCase.note = note;
    this.moderationAudit.unshift({ id: randomUUID(), caseId, actor, decision, note, createdAt: moderationCase.resolvedAt });
    return this.caseView(moderationCase);
  }

  public async listModerationAudit(limit: number): Promise<readonly ModerationAuditEntry[]> { return this.moderationAudit.slice(0, limit); }

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
  private cancelInvitationsFor(playerId: string, acceptedId?: string): void {
    for (const invitation of this.invitations.values()) {
      if (invitation.recipientId === playerId && invitation.status === "pending" && invitation.id !== acceptedId) {
        invitation.status = "cancelled";
      }
    }
  }
  private requireClanMembership(playerId: string): { clanId: string; role: ClanRole; joinedAt: string } {
    this.ensureAuthenticatedPlayer(playerId);
    const membership = this.memberships.get(playerId);
    if (!membership) throw new ClanMembershipError();
    return membership;
  }
  private clanView(clan: MutableClan, role?: "owner" | "officer" | "member"): ClanView {
    return { ...clan, memberCount: this.memberCount(clan.id), ...(role ? { role } : {}) };
  }
  private invitationView(invitation: MutableInvitation): ClanInvitationView {
    return {
      id: invitation.id,
      clan: this.clanView(this.clans.get(invitation.clanId)!),
      inviter: this.requirePlayer(invitation.inviterId),
      expiresAt: invitation.expiresAt,
    };
  }
  private messageView(message: MutableMessage): ClanMessageView {
    return {
      id: message.id,
      author: this.requirePlayer(message.authorId),
      body: message.status === "active" ? message.body : null,
      status: message.status,
      createdAt: message.createdAt,
    };
  }
  private caseView(value: MutableCase): ModerationCaseView {
    const reports = [...this.reports.values()].filter((item) => item.caseId === value.id);
    const reasons = { spam: 0, harassment: 0, hate: 0, sexual: 0, personal_data: 0, other: 0 };
    for (const report of reports) reasons[report.reason] += 1;
    return { ...value, author: this.requirePlayer(value.authorId), reportCount: reports.length, reasons };
  }
  private memberView(playerId: string, membership: { clanId: string; role: ClanRole; joinedAt: string }): ClanMemberView {
    return { player: this.requirePlayer(playerId), role: membership.role, joinedAt: membership.joinedAt };
  }
  private membersForClan(clanId: string): readonly ClanMemberView[] {
    const roleOrder: Record<ClanRole, number> = { owner: 0, officer: 1, member: 2 };
    return [...this.memberships.entries()].filter(([, item]) => item.clanId === clanId)
      .map(([id, item]) => this.memberView(id, item))
      .sort((left, right) => roleOrder[left.role] - roleOrder[right.role]
        || right.player.level - left.player.level || left.player.displayName.localeCompare(right.player.displayName));
  }
}
