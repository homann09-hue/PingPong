import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isAllowedPlayerPath } from "./player-proxy";

/**
 * Vertragstest zwischen API und BFF.
 *
 * Vorgeschichte: drei Mal hintereinander war eine Funktion serverseitig fertig
 * und im Web trotzdem tot, weil niemand daran gedacht hat, die Route in die
 * Allowlist einzutragen (PR #9, #10, #11). Beim vierten Mal soll nicht wieder
 * ein Zufallsfund noetig sein — dieser Test schlaegt fehl, sobald eine neue
 * /v1/-Route weder erreichbar noch bewusst ausgenommen ist.
 *
 * Der Test prueft NICHT, ob eine Route sinnvoll ist. Er erzwingt nur eine
 * Entscheidung: freischalten oder begruendet ausnehmen.
 */

const httpAppPath = fileURLToPath(new URL("../../../../api/src/http-app.ts", import.meta.url));

/**
 * Routen, die das BFF absichtlich nicht durchreicht.
 *
 * Die Auth-Routen ruft das BFF selbst serverseitig auf (siehe issueTokens).
 * Waeren sie proxybar, koennte Browser-JavaScript sich Tokens ausstellen lassen
 * und der httpOnly-Cookie-Schutz waere wertlos.
 */
const intentionallyNotProxied = new Set([
  "auth/guest",
  "auth/provider",
  "auth/refresh",
  "auth/logout",
]);

/** Ersetzt :params durch Beispielwerte, damit die Muster greifen koennen. */
function samplePath(route: string): string {
  return route
    .replace(/^\/v1\//, "")
    .replace(/:sessionId/g, "11111111-1111-4111-8111-111111111111")
    .replace(/:slotId/g, "dragon-peak")
    .replace(/:[a-zA-Z]+/g, "sample-id");
}

function declaredPlayerRoutes(): readonly string[] {
  const source = readFileSync(httpAppPath, "utf8");
  const routes = new Set<string>();
  // Erfasst nur Literale. Routen aus Schleifen mit Template-Strings
  // (z. B. boosters/craft|activate) entgehen dem — bewusst in Kauf genommen,
  // solange die Alternative ein vollstaendiger Parser waere.
  const pattern = /app\.(?:get|post|put|patch|delete)\(\s*"(\/v1\/[^"]+)"/g;
  let match = pattern.exec(source);
  while (match !== null) {
    routes.add(match[1]);
    match = pattern.exec(source);
  }
  return [...routes];
}

describe("BFF deckt die Spieler-API ab", () => {
  const routes = declaredPlayerRoutes();

  it("findet die Routendefinitionen ueberhaupt", () => {
    // Schutz gegen den stillen Fehlschlag: wenn der Pfad oder das Muster
    // bricht, ist die Liste leer und alle Zusicherungen waeren wertlos.
    expect(routes.length).toBeGreaterThan(40);
  });

  it("laesst keine Route unentschieden", () => {
    const unreachable = routes
      .map(samplePath)
      .filter((path) => !isAllowedPlayerPath(path) && !intentionallyNotProxied.has(path));

    expect(unreachable, [
      "Diese API-Routen sind vom Web nicht erreichbar.",
      "Entweder in allowedRoutes aufnehmen oder in intentionallyNotProxied",
      "mit Begruendung eintragen:",
    ].join(" ")).toEqual([]);
  });

  it("haelt die Ausnahmeliste aktuell", () => {
    // Eine Ausnahme fuer eine geloeschte Route ist toter Ballast und
    // verschleiert spaeter, was wirklich absichtlich gesperrt ist.
    const declared = new Set(routes.map(samplePath));
    const stale = [...intentionallyNotProxied].filter((path) => !declared.has(path));
    expect(stale, "Ausnahmen ohne zugehoerige API-Route").toEqual([]);
  });
});
