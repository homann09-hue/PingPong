"use client";

import { useCallback, useEffect, useState } from "react";
import type { JackpotTier, LiveEvent, Mission } from "@/lib/contracts";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

/** Laedt Missionen, Events und Jackpots ueber die vorhandenen BFF-Endpunkte. */
export function useLobbyData() {
  const [missions, setMissions] = useState<readonly Mission[]>([]);
  const [events, setEvents] = useState<readonly LiveEvent[]>([]);
  const [jackpots, setJackpots] = useState<readonly JackpotTier[]>([]);
  const refresh = useCallback(async () => {
    const [missionsBody, eventsBody, jackpotsBody] = await Promise.all([
      fetchJson<{ missions: Mission[] }>("/api/player/missions"),
      fetchJson<{ events: LiveEvent[] }>("/api/player/events"),
      fetchJson<{ jackpots: JackpotTier[] }>("/api/player/jackpots"),
    ]);
    if (missionsBody) setMissions(missionsBody.missions);
    if (eventsBody) setEvents(eventsBody.events);
    if (jackpotsBody) setJackpots(jackpotsBody.jackpots);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { missions, events, jackpots, refresh };
}

/** Loest einen Claim-Endpunkt aus und meldet Erfolg/Fehlercode zurueck. */
export async function postClaim(path: string): Promise<{ ok: boolean; code?: string }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({}),
    });
    if (response.ok) return { ok: true };
    const body = await response.json().catch(() => null) as { code?: string } | null;
    return { ok: false, code: body?.code };
  } catch {
    return { ok: false, code: "NETWORK" };
  }
}
