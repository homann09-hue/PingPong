# Produktions-Rollout

## Einmalige Baseline fuer bestehende Datenbanken

Der Migrations-Runner protokolliert angewandte Dateien in `schema_migrations`.
Eine bestehende Datenbank kann das aktuelle Schema bereits besitzen, ohne dieses
Register zu haben. In diesem Fall darf `npm run migrate` nicht direkt ausgefuehrt
werden, weil es sonst bei bereits vorhandenen Tabellen abbricht. Jede Migration
laeuft transaktional; ein Fehler wird zurueckgerollt.

### Sichere Reihenfolge

```sh
DATABASE_URL="$DATABASE_URL" npm run migrate:status
DATABASE_URL="$DATABASE_URL" npm run migrate:baseline
DATABASE_URL="$DATABASE_URL" npm run migrate:status
```

`migrate:status` ist strikt read-only. Fehlt `schema_migrations`, meldet der
Runner alle Dateien als ausstehend, legt aber keine Tabelle an.

`migrate:baseline` ist absichtlich verriegelt. Das Root-Skript uebergibt
`--confirm-existing-schema`; der Runner prueft vor dem Markieren zentrale Aurora-
Relationen und fuehrt das Eintragen aller Checksums unter Advisory Lock in einer
Transaktion aus. Der Befehl ist nur fuer eine Datenbank vorgesehen, deren Schema
nachweislich bereits aus den vorhandenen SQL-Dateien aufgebaut wurde.

Die genaue Zahl der Migrationen wird aus `infra/postgres/*.sql` ermittelt und
nicht in Deployment-Automation fest codiert. Erwartung nach der Baseline:

```text
<Anzahl> angewandt, 0 ausstehend.
```

## Normale Releases danach

Vor dem Start der neuen API-Version:

```sh
DATABASE_URL="$DATABASE_URL" npm run migrate
DATABASE_URL="$DATABASE_URL" npm run migrate:status
```

Der Runner bietet:

- eine Transaktion je Migration,
- SHA-256-Pruefsummen fuer unveraenderliche Historie,
- einen PostgreSQL-Advisory-Lock gegen parallele Deploys,
- `migrate:dry-run` fuer eine Vorschau,
- einen folgenlosen zweiten `migrate`-Lauf.

## Produktionsschutz

- `DEMO_MODE=true` ist in Produktion und auf gehosteten Vercel-Runtimes verboten.
- Demo-Geheimnisse werden pro Prozess zufaellig erzeugt und niemals ausgegeben.
- Fastify vertraut genau einem vorgeschalteten Proxy (`trustProxy: 1`). Bei einer
  anderen Netzwerktopologie muss diese Annahme vor dem Rollout angepasst werden.
- `DATABASE_URL` und andere Geheimnisse gehoeren ausschliesslich in den Secret-
  Store der Deployment-Plattform, nicht in Shell-Historie, GitHub oder Chat.

## Client-Topologie

Der produktive Spieler-Client ist `apps/player-web` und laeuft als eigener
Next.js-Prozess. Die API ist kein Ersatz fuer diesen Prozess. Das Admin-Panel
bleibt ein separater API-Pfad.

## Rollback

Anwendungscode kann ueber einen normalen Revert zurueckgenommen werden.
`schema_migrations` ist additiv und stoert aeltere Builds nicht. Bereits
angewandte SQL-Migrationen werden nicht automatisch rueckwaerts ausgefuehrt;
Schema-Rollbacks benoetigen eine ausdrueckliche neue Migration.
