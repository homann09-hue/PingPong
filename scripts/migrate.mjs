#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "infra", "postgres");
const LOCK_KEY = "8274119003";
const args = new Set(process.argv.slice(2));
const mode = args.has("--status") ? "status" : args.has("--baseline") ? "baseline" : args.has("--dry-run") ? "dry-run" : "apply";
const baselineConfirmed = args.has("--confirm-existing-schema") || process.env.MIGRATION_BASELINE_CONFIRM === "existing-schema-verified";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL ist nicht gesetzt.");
  process.exit(1);
}

function loadMigrations() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(migrationsDir, name), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

async function registryExists(client) {
  const result = await client.query("SELECT to_regclass('public.schema_migrations') AS registry");
  return result.rows[0]?.registry !== null;
}

async function ensureRegistry(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
}

async function appliedMigrations(client, exists) {
  if (!exists) return new Map();
  const rows = await client.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
  return new Map(rows.rows.map((row) => [row.name, row.checksum]));
}

async function assertBaselineShape(client) {
  const requiredRelations = [
    "players", "wallet_ledger", "spin_audit", "player_progression",
    "missions", "mission_progress", "live_events", "progressive_jackpots",
  ];
  const result = await client.query(
    "SELECT name, to_regclass('public.' || name) AS relation FROM unnest($1::text[]) AS name",
    [requiredRelations],
  );
  const missing = result.rows.filter((row) => row.relation === null).map((row) => row.name);
  if (missing.length > 0) throw new Error(`Baseline abgebrochen: zentrale Relationen fehlen: ${missing.join(", ")}`);

  const players = await client.query("SELECT count(*)::bigint AS count FROM players");
  const tableCount = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
  if (Number(tableCount.rows[0]?.count ?? 0) < requiredRelations.length) {
    throw new Error("Baseline abgebrochen: die Datenbank sieht nicht wie ein vorhandenes Aurora-Schema aus.");
  }
  console.log(`Baseline-Pruefung: ${tableCount.rows[0].count} Tabellen, ${players.rows[0].count} Spieler.`);
}

function assertNoChecksumDrift(migrations, applied) {
  const drifted = migrations.filter((migration) => applied.has(migration.name) && applied.get(migration.name) !== migration.checksum);
  if (drifted.length === 0) return;
  throw new Error(`Bereits angewandte Migrationen wurden geaendert: ${drifted.map((item) => item.name).join(", ")}`);
}

async function main() {
  const migrations = loadMigrations();
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const exists = await registryExists(client);
    const applied = await appliedMigrations(client, exists);
    assertNoChecksumDrift(migrations, applied);
    const pending = migrations.filter((migration) => !applied.has(migration.name));

    if (mode === "status") {
      console.log(`${applied.size} angewandt, ${pending.length} ausstehend.`);
      if (!exists) console.log("Hinweis: schema_migrations existiert noch nicht; die Datenbank wurde nicht veraendert.");
      for (const migration of pending) console.log(`  ausstehend: ${migration.name}`);
      return;
    }

    if (mode === "dry-run") {
      console.log(`${pending.length} Migrationen wuerden angewandt:`);
      for (const migration of pending) console.log(`  - ${migration.name}`);
      return;
    }

    const lock = await client.query("SELECT pg_try_advisory_lock($1::bigint) AS acquired", [LOCK_KEY]);
    if (!lock.rows[0]?.acquired) throw new Error("Ein anderer Prozess migriert bereits.");

    if (mode === "baseline") {
      if (!baselineConfirmed) {
        throw new Error("Baseline verlangt --confirm-existing-schema oder MIGRATION_BASELINE_CONFIRM=existing-schema-verified.");
      }
      await assertBaselineShape(client);
      await client.query("BEGIN");
      try {
        await ensureRegistry(client);
        for (const migration of pending) {
          await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", [migration.name, migration.checksum]);
          console.log(`  markiert: ${migration.name}`);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      console.log(`${pending.length} Migrationen als angewandt markiert, ohne SQL auszufuehren.`);
      return;
    }

    await ensureRegistry(client);
    if (pending.length === 0) {
      console.log("Keine ausstehenden Migrationen.");
      return;
    }

    for (const migration of pending) {
      process.stdout.write(`  ${migration.name} ... `);
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [migration.name, migration.checksum]);
        await client.query("COMMIT");
        console.log("ok");
      } catch (error) {
        await client.query("ROLLBACK");
        console.log("fehlgeschlagen");
        throw new Error(`${migration.name} abgebrochen und zurueckgerollt: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(`${pending.length} Migrationen angewandt.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
