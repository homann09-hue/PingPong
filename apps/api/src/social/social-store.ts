export interface SocialPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly level: number;
  readonly online: boolean;
}

export interface FriendRequestView {
  readonly id: string;
  readonly player: SocialPlayer;
  readonly createdAt: string;
}

export interface ClanView {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly memberCount: number;
  readonly memberLimit: number;
  readonly weeklyScore: number;
  readonly role?: "owner" | "officer" | "member";
}

export interface ClanInvitationView {
  readonly id: string;
  readonly clan: ClanView;
  readonly inviter: SocialPlayer;
  readonly expiresAt: string;
}

export interface ClanMessageView {
  readonly id: string;
  readonly author: SocialPlayer;
  readonly body: string | null;
  readonly status: "active" | "removed";
  readonly createdAt: string;
}

export interface ClanFeedPage {
  readonly messages: readonly ClanMessageView[];
  readonly nextCursor: string | null;
}

export interface SocialOverview {
  readonly player: SocialPlayer;
  readonly friends: readonly SocialPlayer[];
  readonly incomingRequests: readonly FriendRequestView[];
  readonly suggestions: readonly SocialPlayer[];
  readonly currentClan: ClanView | null;
  readonly discoverClans: readonly ClanView[];
  readonly incomingClanInvitations: readonly ClanInvitationView[];
}

export interface SocialStore {
  getOverview(playerId: string): Promise<SocialOverview>;
  sendFriendRequest(playerId: string, targetPlayerId: string): Promise<FriendRequestView>;
  acceptFriendRequest(playerId: string, requestId: string): Promise<SocialPlayer>;
  createClan(playerId: string, name: string, tag: string): Promise<ClanView>;
  joinClan(playerId: string, clanId: string): Promise<ClanView>;
  leaveClan(playerId: string): Promise<void>;
  inviteToClan(playerId: string, targetPlayerId: string): Promise<ClanInvitationView>;
  acceptClanInvitation(playerId: string, invitationId: string): Promise<ClanView>;
  listClanFeed(playerId: string, cursor: string | undefined, limit: number): Promise<ClanFeedPage>;
  postClanMessage(playerId: string, body: string): Promise<ClanMessageView>;
  removeClanMessage(playerId: string, messageId: string): Promise<void>;
  close(): Promise<void>;
}

export class SocialPlayerNotFoundError extends Error {}
export class SocialConflictError extends Error {}
export class FriendRequestNotFoundError extends Error {}
export class ClanNotFoundError extends Error {}
export class ClanMembershipError extends Error {}
export class ClanPermissionError extends Error {}
export class ClanInvitationNotFoundError extends Error {}
export class ClanMessageNotFoundError extends Error {}
export class ClanMessageRateLimitError extends Error {}

export interface ClanFeedCursor {
  readonly createdAt: string;
  readonly id: string;
}

export function encodeClanFeedCursor(cursor: ClanFeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeClanFeedCursor(value: string): ClanFeedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<ClanFeedCursor>;
    if (typeof parsed.createdAt !== "string" || !Number.isFinite(Date.parse(parsed.createdAt))) return null;
    if (typeof parsed.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)) return null;
    return { createdAt: new Date(parsed.createdAt).toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}
