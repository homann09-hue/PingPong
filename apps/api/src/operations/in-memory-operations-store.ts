import type { EconomyAdminStore } from "../admin/economy-admin-store.js";
import type { SocialStore } from "../social/social-store.js";
import type { DurableOperationsSnapshot, OperationsStore } from "./operations-store.js";

/** Demo aggregate adapter backed by the same in-memory moderation and grant queues. */
export class InMemoryOperationsStore implements OperationsStore {
  public constructor(
    private readonly economyStore?: EconomyAdminStore,
    private readonly socialStore?: SocialStore,
  ) {}

  public async snapshot(_now: Date): Promise<DurableOperationsSnapshot> {
    const [pendingGrants, moderationCases, audit] = await Promise.all([
      this.economyStore?.listGrants("pending", 100) ?? [],
      this.socialStore?.listModerationCases("open", 100) ?? [],
      this.economyStore?.listAudit(200) ?? [],
    ]);
    return {
      activePlayers: 1, suspendedPlayers: 0, spinsLast15Minutes: 0, analyticsEventsLast24Hours: 0,
      pendingEconomyGrants: pendingGrants.length, openModerationCases: moderationCases.length,
      pushPending: 0, pushProcessing: 0, pushStale: 0, pushFailedLast24Hours: 0,
      adminActionsLast24Hours: audit.length,
    };
  }
  public async close(): Promise<void> {}
}

