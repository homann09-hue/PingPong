# Deployment-Leitfaden

Stand: 21.07.2026

## Ist-Zustand

| Projekt | URL | Zustand |
|---|---|---|
| `aurora-player-web` | aurora-player-web.vercel.app | Production haengt auf dem Merge von PR #4 |
| `aurora-game-api` | aurora-game-api.vercel.app | **aktuell und funktionsfaehig**, alle `/v1/`-Routen antworten |
| `ping-pong-api` | ping-pong-api-alpha.vercel.app | antwortet nicht, vermutlich Altlast |

## Warum die Web-App nicht aktuell ist

Nicht der Build schlaegt fehl — es wird gar keiner erstellt. Fuer die Merges der
PRs #5 bis #13 existiert in Vercel **kein einziger Deployment-Eintrag**, weder
`Error` noch `Blocked`. Der GitHub-Status meldet dazu:

```
Vercel – aurora-player-web = failure
https://vercel.com/bau-pro?upgradeToPro=build-rate-limit
```

Das Build-Kontingent des Hobby-Tarifs ist erschoepft. Preview-Builds derselben
Commits liefen kurz zuvor noch durch — die Grenze wurde also im Lauf des Tages
erreicht.

### Verstaerkender Faktor

Am selben Repository haengen **drei** Vercel-Projekte. Jeder Push baut alle drei
und verbraucht das Kontingent dreifach. `ping-pong-api` antwortet nicht mehr und
ist vermutlich eine Altlast; `aurora-game-api` ist das produktive Backend.
Zwei Projekte weniger bedeuten das dreifache nutzbare Kontingent fuer das eine,
auf das es ankommt.

## Was NICHT hilft

**Eine Preview-Bereitstellung nach Production befoerdern.** Naheliegend, aber
gefaehrlich: `AURORA_API_URL` ist ausschliesslich fuer die Umgebung `Production`
gesetzt. Ein Preview-Build kennt die Variable nicht und faellt auf
`http://127.0.0.1:8080` zurueck. Die Seite saehe aktuell aus und waere komplett
funktionslos — jede API-Anfrage endet in `503 PLAYER_SERVICE_UNAVAILABLE`.
Das waere schlechter als der aktuelle, veraltete, aber funktionierende Stand.

## Der Weg zum aktuellen Stand

1. Warten, bis das Tageskontingent zurueckgesetzt ist.
2. Beliebigen Commit auf `main` schieben — die Git-Integration baut Production
   dann automatisch. Alternativ in Vercel bei `aurora-player-web` auf `Redeploy`.
3. Danach pruefen: die Lobby muss acht spielbare Slots zeigen (keine
   "coming soon"-Kacheln), Boost-Center, Gluecksrad und Shop muessen erscheinen.

## Bereits umgesetzt (21.07.2026)

- **Neues Projekt `aurora-player-web-live`** angelegt (Root `apps/player-web`,
  Preset Next.js, `AURORA_API_URL` fuer Production und Preview gesetzt).
  Grund: die Kontingentsperre gilt **pro Projekt**, nicht pro Konto — waehrend
  `aurora-player-web` gesperrt war, hat `aurora-game-api` im selben Moment
  problemlos deployt. Ein frisches Projekt hat ein eigenes Kontingent.
  URL: `aurora-player-web-live.vercel.app`.
- Die alte Domain `aurora-player-web.vercel.app` bleibt vorerst am alten Projekt.
  Das Umhaengen ist eine bewusste Entscheidung und wurde nicht ungefragt gemacht.


- `AURORA_API_URL` gilt jetzt fuer **alle Umgebungen** statt nur fuer Production.
  Vorschau-Bereitstellungen erreichen damit dasselbe Backend
  (`https://aurora-game-api.vercel.app`) und sind erstmals wirklich bedienbar.
- Die Git-Verbindung von `ping-pong-api` wurde **getrennt** (nicht geloescht —
  Projekt und Konfiguration bleiben erhalten und lassen sich jederzeit wieder
  verbinden). Damit loest ein Push nur noch zwei Builds statt drei aus.

### Dauerhafte Entlastung

- Nicht mehr benoetigte Vercel-Projekte entfernen (Entscheidung liegt beim Betreiber).
- `AURORA_API_URL` zusaetzlich fuer die Umgebung `Preview` setzen, damit
  Vorschau-Bereitstellungen ueberhaupt bedienbar sind. Aktuell ist jede Preview
  ohne Backend und damit nur als optische Kontrolle brauchbar.

## Lokal starten — ohne Datenbank, ohne Vercel

`DEMO_MODE` schaltet die API auf In-Memory-Speicher um. Es wird kein Postgres
benoetigt.

```bash
npm install

# Terminal 1 — API auf Port 8080
DEMO_MODE=true npm run dev

# Terminal 2 — Web-App auf Port 3000
npm run dev:player-web
```

Danach `http://localhost:3000` oeffnen. Das ist der vollstaendige aktuelle Stand.

## Reproduzierbarkeit

Der Migrationsplan nach Cloudflare Pages, Railway, Supabase und R2 steht in
`docs/MIGRATION.md`. Der Wechsel loest das Kontingentproblem strukturell, ist
aber eine eigene Entscheidung und kein Notbehelf fuer heute.
