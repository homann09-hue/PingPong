export function compactNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function coinNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}

/** "endet in 2 T 5 Std" — leer, wenn das Datum fehlt oder vorbei ist. */
export function timeLeft(endsAt: string | undefined): string {
  if (!endsAt) return "";
  const remaining = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "";
  const hours = Math.floor(remaining / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} T ${hours % 24} Std`;
  if (hours > 0) return `${hours} Std ${Math.floor((remaining % 3_600_000) / 60_000)} Min`;
  return `${Math.max(1, Math.floor(remaining / 60_000))} Min`;
}

/** Deutsche Beschreibung einer Mission aus Metrik und Zielwert. */
export function describeMission(metric: string, target: number): string {
  const amount = coinNumber(target);
  switch (metric) {
    case "spin_count": return `Spiele ${amount} Spins`;
    case "wager_total": return `Setze insgesamt ${amount} Coins`;
    case "win_total": return `Gewinne insgesamt ${amount} Coins`;
    case "free_spin_count": return `Spiele ${amount} Freispiele`;
    case "daily_mission_claims": return `Schliesse ${amount} Tagesmissionen ab`;
    default: return `Erreiche ${amount}`;
  }
}

export function missionTierLabel(tier: string, cadence: string): string {
  if (cadence === "weekly") return "Woche";
  switch (tier) {
    case "pro": return "Pro";
    case "super": return "Super";
    case "crazy": return "Crazy";
    default: return "Täglich";
  }
}
