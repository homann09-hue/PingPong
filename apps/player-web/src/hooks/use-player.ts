"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/contracts";

export function usePlayer() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/player/profile", { cache: "no-store" });
      if (!response.ok) throw new Error(`Profile returned ${response.status}`);
      setProfile(await response.json() as Profile);
      setError(null);
    } catch {
      setError("Die Spieler-Dienste sind gerade nicht erreichbar.");
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { profile, setProfile, error, refresh };
}
