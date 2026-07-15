import type { AnalyticsIngestResult, AnalyticsStore, ClientAnalyticsEvent } from "./analytics-store.js";

export class InMemoryAnalyticsStore implements AnalyticsStore {
  private readonly eventIds = new Set<string>();
  public async ingest(_playerId: string, events: readonly ClientAnalyticsEvent[], _receivedAt: Date): Promise<AnalyticsIngestResult> {
    let accepted = 0;
    for (const event of events) { if (!this.eventIds.has(event.eventId)) { this.eventIds.add(event.eventId); accepted += 1; } }
    return { accepted, duplicates: events.length - accepted };
  }
  public async close(): Promise<void> {}
}
