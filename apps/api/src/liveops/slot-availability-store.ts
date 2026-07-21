/**
 * Betriebsstatus je Slot. Erlaubt es, ein Spiel geordnet aus dem Verkehr zu nehmen
 * (Wartung) oder dauerhaft zu deaktivieren, ohne ein Deployment auszuloesen.
 *
 * Der Status ist server-authoritativ: die Spin-Route lehnt nicht spielbare Slots ab,
 * die Lobby blendet sie entsprechend aus. Jede Aenderung wird im Admin-Audit-Log
 * mit vorherigem und neuem Wert festgehalten.
 */
export type SlotStatus = 'live' | 'maintenance' | 'disabled';

export interface SlotAvailability {
  readonly slotId: string;
  readonly status: SlotStatus;
  /** Optionaler Hinweis fuer Spieler, z. B. "Wartung bis 14:00 UTC". */
  readonly message: string | null;
  readonly updatedBy: string | null;
  readonly updatedAt: string | null;
}

export interface SlotAvailabilityUpdate {
  readonly slotId: string;
  readonly status: SlotStatus;
  readonly message: string | null;
  readonly actor: string;
}

export interface SlotAvailabilityStore {
  list(): Promise<readonly SlotAvailability[]>;
  get(slotId: string): Promise<SlotAvailability>;
  set(update: SlotAvailabilityUpdate, now: Date): Promise<{ readonly previous: SlotAvailability; readonly current: SlotAvailability }>;
  close(): Promise<void>;
}

/** Ein Slot ohne gespeicherten Eintrag gilt als regulaer spielbar. */
export function defaultAvailability(slotId: string): SlotAvailability {
  return { slotId, status: 'live', message: null, updatedBy: null, updatedAt: null };
}

export class InMemorySlotAvailabilityStore implements SlotAvailabilityStore {
  private readonly entries = new Map<string, SlotAvailability>();

  public async list(): Promise<readonly SlotAvailability[]> {
    return [...this.entries.values()].sort((left, right) => left.slotId.localeCompare(right.slotId));
  }

  public async get(slotId: string): Promise<SlotAvailability> {
    return this.entries.get(slotId) ?? defaultAvailability(slotId);
  }

  public async set(update: SlotAvailabilityUpdate, now: Date) {
    const previous = await this.get(update.slotId);
    const current: SlotAvailability = {
      slotId: update.slotId,
      status: update.status,
      message: update.message,
      updatedBy: update.actor,
      updatedAt: now.toISOString(),
    };
    this.entries.set(update.slotId, current);
    return { previous, current };
  }

  public async close(): Promise<void> { /* nichts zu schliessen */ }
}
