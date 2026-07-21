"use client";

import { useEffect, useState } from "react";

export type SlotStatus = "live" | "maintenance" | "disabled";

export interface SlotAvailabilityEntry {
  readonly slotId: string;
  readonly status: SlotStatus;
  readonly message: string | null;
}

/**
 * Betriebsstatus aller Slots. Der Server setzt die Sperre ohnehin durch (503 beim
 * Spin) — dieser Hook sorgt nur dafuer, dass ein Spieler das schon in der Lobby
 * sieht statt erst nach dem Klick.
 *
 * Faellt der Abruf aus, bleibt die Map leer und alles gilt als spielbar. Das ist
 * die richtige Richtung: die Anzeige darf niemals Slots sperren, die es gar nicht
 * sind, und sie kann umgekehrt nichts freigeben, was der Server blockiert.
 */
export function useSlotAvailability(): ReadonlyMap<string, SlotAvailabilityEntry> {
  const [entries, setEntries] = useState<ReadonlyMap<string, SlotAvailabilityEntry>>(new Map());

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/player/slots/availability");
        if (!response.ok) return;
        const body = await response.json() as { entries?: readonly SlotAvailabilityEntry[] };
        if (!active || !Array.isArray(body.entries)) return;
        setEntries(new Map(body.entries.map((entry) => [entry.slotId, entry])));
      } catch {
        // Stiller Fehlschlag: die Lobby bleibt bedienbar, der Spin-Endpunkt schuetzt weiterhin.
      }
    })();
    return () => { active = false; };
  }, []);

  return entries;
}
