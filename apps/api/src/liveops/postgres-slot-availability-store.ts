import { Pool } from "pg";
import {
  defaultAvailability,
  type SlotAvailability,
  type SlotAvailabilityStore,
  type SlotAvailabilityUpdate,
  type SlotStatus,
} from "./slot-availability-store.js";

interface Row { slot_id: string; status: SlotStatus; message: string | null; updated_by: string; updated_at: Date }

/** Dauerhafter Betriebsstatus je Slot mit optimistischer Versionierung. */
export class PostgresSlotAvailabilityStore implements SlotAvailabilityStore {
  public constructor(private readonly pool: Pool) {}

  public static connect(connectionString: string): PostgresSlotAvailabilityStore {
    return new PostgresSlotAvailabilityStore(new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, statement_timeout: 3_000 }));
  }

  public async list(): Promise<readonly SlotAvailability[]> {
    const result = await this.pool.query<Row>(
      "SELECT slot_id, status, message, updated_by, updated_at FROM slot_availability ORDER BY slot_id",
    );
    return result.rows.map((row) => this.toAvailability(row));
  }

  public async get(slotId: string): Promise<SlotAvailability> {
    const result = await this.pool.query<Row>(
      "SELECT slot_id, status, message, updated_by, updated_at FROM slot_availability WHERE slot_id=$1",
      [slotId],
    );
    const row = result.rows[0];
    return row ? this.toAvailability(row) : defaultAvailability(slotId);
  }

  public async set(update: SlotAvailabilityUpdate, now: Date) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<Row>(
        "SELECT slot_id, status, message, updated_by, updated_at FROM slot_availability WHERE slot_id=$1 FOR UPDATE",
        [update.slotId],
      );
      const previous = existing.rows[0] ? this.toAvailability(existing.rows[0]) : defaultAvailability(update.slotId);
      const written = await client.query<Row>(
        `INSERT INTO slot_availability (slot_id, status, message, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (slot_id) DO UPDATE
           SET status=EXCLUDED.status, message=EXCLUDED.message, updated_by=EXCLUDED.updated_by,
               updated_at=EXCLUDED.updated_at, version=slot_availability.version+1
         RETURNING slot_id, status, message, updated_by, updated_at`,
        [update.slotId, update.status, update.message, update.actor, now],
      );
      await client.query("COMMIT");
      return { previous, current: this.toAvailability(written.rows[0]!) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> { await this.pool.end(); }

  private toAvailability(row: Row): SlotAvailability {
    return {
      slotId: row.slot_id,
      status: row.status,
      message: row.message,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
