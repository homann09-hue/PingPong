export type EconomyCurrency = "coin" | "gem";
export type EconomyGrantStatus = "pending" | "approved" | "rejected";

export interface AdminPlayerSummary {
  readonly id: string;
  readonly displayName: string;
  readonly status: "active" | "suspended" | "deleted";
  readonly level: number;
  readonly xp: number;
  readonly vipPoints: number;
  readonly coinBalance: number;
  readonly gemBalance: number;
  readonly createdAt: string;
}

export interface EconomyGrant {
  readonly id: string;
  readonly playerId: string;
  readonly currency: EconomyCurrency;
  readonly amount: number;
  readonly reason: string;
  readonly status: EconomyGrantStatus;
  readonly requestedBy: string;
  readonly resolvedBy: string | null;
  readonly requestedAt: string;
  readonly resolvedAt: string | null;
  readonly balanceBefore: number | null;
  readonly balanceAfter: number | null;
}

export interface CreateEconomyGrantCommand {
  readonly playerId: string;
  readonly currency: EconomyCurrency;
  readonly amount: number;
  readonly reason: string;
  readonly actor: string;
  readonly now: Date;
}

export interface EconomyAdminAuditEntry {
  readonly id: string;
  readonly actor: string;
  readonly action: string;
  readonly grantId: string;
  readonly createdAt: string;
}

/** Workforce-only port for searchable player support and four-eyes wallet grants. */
export interface EconomyAdminStore {
  searchPlayers(query: string, limit: number): Promise<readonly AdminPlayerSummary[]>;
  listGrants(status: EconomyGrantStatus | undefined, limit: number): Promise<readonly EconomyGrant[]>;
  createGrant(command: CreateEconomyGrantCommand): Promise<EconomyGrant>;
  approveGrant(grantId: string, actor: string, now: Date): Promise<EconomyGrant>;
  rejectGrant(grantId: string, actor: string, now: Date): Promise<EconomyGrant>;
  listAudit(limit: number): Promise<readonly EconomyAdminAuditEntry[]>;
  close(): Promise<void>;
}

export class EconomyPlayerNotFoundError extends Error {}
export class EconomyGrantNotFoundError extends Error {}
export class EconomyGrantStateError extends Error {}
export class EconomyFourEyesViolationError extends Error {}

