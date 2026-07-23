import type { Pool } from "@neondatabase/serverless";
import { SOCIETIES_CONNECT_MIGRATIONS } from "./registry";

export type MigrationRunResult = {
  applied: string[];
  skipped: string[];
};

const ENSURE_SCHEMA_MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS _schema_migrations (
  version text PRIMARY KEY,
  app_name text NOT NULL,
  description text,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

/**
 * Apply any pending Societies Connect migrations against the given pool.
 *
 * - Ensures `_schema_migrations` exists
 * - Skips versions already recorded
 * - Runs each unapplied migration SQL inside BEGIN / COMMIT (ROLLBACK on error)
 * - Records applied version metadata in `_schema_migrations`
 */
export async function runPendingMigrations(pool: Pool): Promise<MigrationRunResult> {
  const applied: string[] = [];
  const skipped: string[] = [];

  await pool.query(ENSURE_SCHEMA_MIGRATIONS_SQL);

  const existing = await pool.query<{ version: string }>(
    `SELECT version FROM _schema_migrations ORDER BY applied_at ASC, version ASC`,
  );
  const appliedVersions = new Set(existing.rows.map((row) => row.version));

  for (const migration of SOCIETIES_CONNECT_MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      skipped.push(migration.version);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO _schema_migrations (version, app_name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING`,
        [migration.version, migration.appName, migration.description],
      );
      await client.query("COMMIT");
      applied.push(migration.version);
      appliedVersions.add(migration.version);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors; surface the original failure
      }
      throw err;
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
}
