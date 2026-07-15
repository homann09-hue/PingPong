import { randomUUID } from "node:crypto";
import type { InMemorySpinStore } from "../spins/in-memory-spin-store.js";
import type { AdminPlayerSummary, CreateEconomyGrantCommand, EconomyAdminAuditEntry, EconomyAdminStore, EconomyGrant, EconomyGrantStatus } from "./economy-admin-store.js";
import { EconomyFourEyesViolationError, EconomyGrantNotFoundError, EconomyGrantStateError, EconomyPlayerNotFoundError } from "./economy-admin-store.js";

/** Local demo adapter with the same approval boundary as the PostgreSQL implementation. */
export class InMemoryEconomyAdminStore implements EconomyAdminStore {
  private readonly grants = new Map<string, EconomyGrant>();
  private readonly audit: EconomyAdminAuditEntry[] = [];
  public constructor(private readonly spinStore: InMemorySpinStore, private readonly playerId: string) {}

  public async searchPlayers(query: string, limit: number): Promise<readonly AdminPlayerSummary[]> {
    const normalized = query.trim().toLowerCase();
    const displayName = "Aurora Player";
    if (normalized && !this.playerId.toLowerCase().includes(normalized) && !displayName.toLowerCase().includes(normalized)) return [];
    const profile = await this.spinStore.getProfile(this.playerId);
    const player: AdminPlayerSummary = { id: this.playerId, displayName, status: "active", level: profile.progression.level, xp: profile.progression.xp,
      vipPoints: profile.progression.vipPoints, coinBalance: profile.coinBalance, gemBalance: profile.gemBalance,
      createdAt: new Date(0).toISOString() };
    return [player].slice(0, limit);
  }

  public async listGrants(status: EconomyGrantStatus | undefined, limit: number): Promise<readonly EconomyGrant[]> {
    return [...this.grants.values()].filter((grant) => !status || grant.status === status).slice(-limit).reverse();
  }

  public async createGrant(command: CreateEconomyGrantCommand): Promise<EconomyGrant> {
    if (command.playerId !== this.playerId) throw new EconomyPlayerNotFoundError();
    const grant: EconomyGrant = { id: randomUUID(), playerId: command.playerId, currency: command.currency, amount: command.amount,
      reason: command.reason, status: "pending", requestedBy: command.actor, resolvedBy: null,
      requestedAt: command.now.toISOString(), resolvedAt: null, balanceBefore: null, balanceAfter: null };
    this.grants.set(grant.id, grant); this.record(command.actor, "economy_grant.created", grant.id, command.now); return grant;
  }

  public async approveGrant(grantId: string, actor: string, now: Date): Promise<EconomyGrant> {
    const grant = this.pending(grantId, actor);
    const balances = await this.spinStore.applyAdminGrant(grant.playerId, grant.currency, grant.amount, grant.id, grant.reason);
    const approved: EconomyGrant = { ...grant, status: "approved", resolvedBy: actor, resolvedAt: now.toISOString(),
      balanceBefore: balances.balanceBefore, balanceAfter: balances.balanceAfter };
    this.grants.set(grantId, approved); this.record(actor, "economy_grant.approved", grantId, now); return approved;
  }

  public async rejectGrant(grantId: string, actor: string, now: Date): Promise<EconomyGrant> {
    const grant = this.pending(grantId, actor);
    const rejected: EconomyGrant = { ...grant, status: "rejected", resolvedBy: actor, resolvedAt: now.toISOString() };
    this.grants.set(grantId, rejected); this.record(actor, "economy_grant.rejected", grantId, now); return rejected;
  }

  public async listAudit(limit: number): Promise<readonly EconomyAdminAuditEntry[]> { return this.audit.slice(-limit).reverse(); }
  public async close(): Promise<void> {}

  private pending(grantId: string, actor: string): EconomyGrant {
    const grant = this.grants.get(grantId); if (!grant) throw new EconomyGrantNotFoundError();
    if (grant.status !== "pending") throw new EconomyGrantStateError();
    if (grant.requestedBy === actor) throw new EconomyFourEyesViolationError();
    return grant;
  }
  private record(actor: string, action: string, grantId: string, now: Date): void {
    this.audit.push({ id: randomUUID(), actor, action, grantId, createdAt: now.toISOString() });
  }
}
