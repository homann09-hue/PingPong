# BFF-Routenabdeckung

Stand: 21.07.2026

## Warum es dieses Dokument gibt

Drei Mal hintereinander war der Befund derselbe: eine Funktion war serverseitig
vollstaendig fertig, getestet und produktionsreif — und im Web trotzdem tot, weil
die Route nicht in der Allowlist des Player-BFF stand.

- PR #9: acht Oekonomie-Routen (Check &amp; Win, Booster, Loyalitaet, High Roller Club)
- PR #10: die oeffentliche Slot-Verfuegbarkeit
- PR #11: das Gluecksrad

Nach dem dritten Fund war klar, dass Einzelfunde die falsche Methode sind.
Dieses Dokument haelt den systematischen Abgleich fest.

## Methode

Alle `app.get/post/put/patch/delete`-Registrierungen aus `apps/api/src/http-app.ts`
extrahieren, auf `/v1/` filtern, Pfadparameter durch Beispielwerte ersetzen und
gegen `allowedRoutes` aus `apps/player-web/src/lib/server/player-proxy.ts` pruefen.

## Ergebnis

| | Anzahl |
|---|---|
| Spieler-Routen (`/v1/*`) gesamt | 63 |
| davon erreichbar (vorher) | 29 |
| davon nicht erreichbar (vorher) | 34 |
| korrekt ausgeschlossen | 4 |
| **echte Luecken** | **30** |

Die vier korrekt ausgeschlossenen Routen sind `auth/guest`, `auth/provider`,
`auth/refresh` und `auth/logout`. Die ruft das BFF selbst serverseitig auf, um die
Tokens aus dem Browser-JavaScript herauszuhalten. Sie duerfen nicht proxybar sein.

## Die 30 Luecken

| Bereich | Routen | Auswirkung fuer Spieler |
|---|---|---|
| Shop | `shop/offers`, `shop/offers/:id/purchase` | Der Shop zeigte Platzhalter statt Angeboten. Kaufen war nicht moeglich. |
| Store | `store/products`, `store/purchases/verify` | Keine Belegpruefung, also kein IAP-Pfad im Web. |
| Wallet | `wallet/transactions` | Keine Transaktionshistorie einsehbar. |
| Events | `events/:id/milestones/:id/claim` | Meilensteine sichtbar, aber nicht einloesbar. |
| Turniere | `tournaments/active` | Komplett unsichtbar. |
| LiveOps | `liveops` | Konfiguration kam nie beim Client an. |
| Freunde | `social/overview`, `social/friend-requests`, `.../accept` | Kein soziales System im Web. |
| Clans | 13 Routen inkl. Feed, Mitglieder, Rollen, Meldungen | Die Lobby sagte "Clans kommen ins Web" — dabei war das Backend fertig. |
| Push | `messaging/preferences`, `messaging/installations*` | Keine Benachrichtigungseinstellungen. |
| Telemetrie | `analytics/events` | Kein Nutzungssignal aus dem Web. |

## Zusaetzlicher Befund: fehlender Idempotenz-Schluessel

`POST /v1/shop/offers/:offerId/purchase` verlangt einen `idempotency-key`. Das BFF
setzte ihn nur fuer Pfade auf `/spins`, `/claim`, `/claims`, `/craft`, `/activate`,
`/redeem` und `/spin`. Ein Shop-Kauf waere also selbst nach Freischaltung der Route
mit `400 INVALID_IDEMPOTENCY_KEY` gescheitert. `/purchase` ist jetzt ergaenzt.

## Sicherheitsabwaegung

Eine breitere Allowlist ist eine groessere Angriffsflaeche. Drei Punkte dazu:

1. Alle freigegebenen Routen sind spielerbezogen und authentifiziert. Das BFF haengt
   den Bearer-Token an, der Client sieht ihn nie.
2. Die ID-Segmente sind auf `[A-Za-z0-9_-]{1,64}` begrenzt. Damit ist Pfad-Ausbruch
   ausgeschlossen; ob eine ID inhaltlich gueltig ist, prueft weiterhin die API.
   Die Allowlist entscheidet, **welche** Endpunkte erreichbar sind — sie ist keine
   zweite Eingabevalidierung.
3. `admin/*` bleibt vollstaendig gesperrt und ist explizit durch Tests abgedeckt.

## Offen

Freigeschaltet heisst noch nicht bedienbar. Fuer die meisten Bereiche fehlt weiterhin
die Oberflaeche im Web. Reihenfolge nach Nutzen:

1. Shop (steht in der Definition of Done, zeigt aktuell tote Platzhalter)
2. Event-Meilensteine (sichtbarer Fortschritt ohne Einloesung frustriert)
3. Wallet-Historie (Transparenz, geringer Aufwand)
4. Turniere
5. Clans und Freunde (groesster Aufwand)

## Wiederholung des Abgleichs

Der Abgleich sollte bei jeder neuen API-Route laufen. Solange es dafuer keinen
automatisierten Test gibt, bleibt das eine manuelle Pflicht — und genau deshalb
ist die Luecke dreimal unbemerkt entstanden.
