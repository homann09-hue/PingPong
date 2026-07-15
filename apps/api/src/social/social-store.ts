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

export interface SocialOverview {
  readonly player: SocialPlayer;
  readonly friends: readonly SocialPlayer[];
  readonly incomingRequests: readonly FriendRequestView[];
  readonly suggestions: readonly SocialPlayer[];
  readonly currentClan: ClanView | null;
  readonly discoverClans: readonly ClanView[];
}

export interface SocialStore {
  getOverview(playerId: string): Promise<SocialOverview>;
  sendFriendRequest(playerId: string, targetPlayerId: string): Promise<FriendRequestView>;
  acceptFriendRequest(playerId: string, requestId: string): Promise<SocialPlayer>;
  createClan(playerId: string, name: string, tag: string): Promise<ClanView>;
  joinClan(playerId: string, clanId: string): Promise<ClanView>;
  leaveClan(playerId: string): Promise<void>;
  close(): Promise<void>;
}

export class SocialPlayerNotFoundError extends Error {}
export class SocialConflictError extends Error {}
export class FriendRequestNotFoundError extends Error {}
export class ClanNotFoundError extends Error {}
export class ClanMembershipError extends Error {}
