export interface DurableOperationsSnapshot {
  readonly activePlayers: number;
  readonly suspendedPlayers: number;
  readonly spinsLast15Minutes: number;
  readonly analyticsEventsLast24Hours: number;
  readonly pendingEconomyGrants: number;
  readonly openModerationCases: number;
  readonly pushPending: number;
  readonly pushProcessing: number;
  readonly pushStale: number;
  readonly pushFailedLast24Hours: number;
  readonly adminActionsLast24Hours: number;
}

/** Read-only aggregate port for workforce operational health. */
export interface OperationsStore {
  snapshot(now: Date): Promise<DurableOperationsSnapshot>;
  close(): Promise<void>;
}

