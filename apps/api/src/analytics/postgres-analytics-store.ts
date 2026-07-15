import { Pool } from "pg";
import type { AnalyticsIngestResult, AnalyticsStore, ClientAnalyticsEvent } from "./analytics-store.js";

export class PostgresAnalyticsStore implements AnalyticsStore {
  private constructor(private readonly pool: Pool) {}
  public static connect(connectionString: string): PostgresAnalyticsStore { return new PostgresAnalyticsStore(new Pool({ connectionString })); }
  public async ingest(playerId: string, events: readonly ClientAnalyticsEvent[], receivedAt: Date): Promise<AnalyticsIngestResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN"); let accepted = 0;
      for (const event of events) {
        const result = await client.query(
          `INSERT INTO client_analytics_events
           (event_id,player_id,event_name,occurred_at,received_at,platform,app_version,screen,slot_id,campaign_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (event_id) DO NOTHING`,
          [event.eventId, playerId, event.name, event.occurredAt, receivedAt, event.platform, event.appVersion,
            event.screen ?? null, event.slotId ?? null, event.campaignId ?? null],
        );
        accepted += result.rowCount ?? 0;
      }
      await client.query("COMMIT"); return { accepted, duplicates: events.length - accepted };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  public async close(): Promise<void> { await this.pool.end(); }
}
