import { describe, expect, it } from "vitest";
import { isAllowedPlayerPath } from "./player-proxy";

/**
 * Diese Suite deckt die Routen ab, die bisher serverseitig fertig, aber vom Web
 * nicht erreichbar waren: Shop, Store, Wallet-Historie, Event-Meilensteine,
 * Turniere, LiveOps, Freunde, Clans, Push-Einstellungen und Telemetrie.
 *
 * Die Allowlist entscheidet nur, WELCHE Endpunkte erreichbar sind. Ob eine ID
 * gueltig ist, prueft die API selbst — hier geht es darum, dass kein Pfad
 * ausbricht und keine Admin-Route mitgeoeffnet wird.
 */
describe("player BFF allowlist: bisher unerreichbare Bereiche", () => {
  it.each([
    "shop/offers",
    "shop/offers/starter-pack/purchase",
    "store/products",
    "store/purchases/verify",
    "wallet/transactions",
    "events/summer-2026/milestones/stage-3/claim",
    "tournaments/active",
    "liveops",
    "social/overview",
    "social/friend-requests",
    "social/friend-requests/9f1c2b3a/accept",
    "clans",
    "clans/leave",
    "clans/invitations",
    "clans/members",
    "clans/feed",
    "clans/ownership-transfer",
    "clans/aurora-legion/join",
    "clans/invitations/inv-42/accept",
    "clans/members/player-7",
    "clans/members/player-7/role",
    "clans/feed/msg-9",
    "clans/feed/msg-9/reports",
    "messaging/preferences",
    "messaging/installations",
    "messaging/installations/current",
    "analytics/events",
  ])("laesst %s durch", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(true);
  });

  it.each([
    // Kein Ausbruch aus dem Pfad.
    "clans/../admin/v1/players",
    "shop/offers/../../admin/v1/slots/availability/purchase",
    "clans/feed/%2e%2e/reports",
    "events/../../wallet/milestones/x/claim",
    // Keine Admin-Oberflaeche ueber das Spieler-BFF.
    "admin/v1/slots/availability",
    "admin/v1/players",
    // Benachbarte, nicht existierende Endpunkte bleiben zu.
    "shop",
    "store",
    "clans/feed/msg-9/reports/all",
    "clans/members/player-7/ban",
    "tournaments",
    "tournaments/archive",
    "analytics",
    "messaging",
    "wallet/transactions/export",
  ])("blockiert %s", (path) => {
    expect(isAllowedPlayerPath(path)).toBe(false);
  });

  it("begrenzt die Laenge eines ID-Segments", () => {
    expect(isAllowedPlayerPath(`clans/${"a".repeat(64)}/join`)).toBe(true);
    expect(isAllowedPlayerPath(`clans/${"a".repeat(65)}/join`)).toBe(false);
  });
});
