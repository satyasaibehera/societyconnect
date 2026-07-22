/**
 * Dynamic, table-agnostic tenant database provisioner.
 *
 * Executes a configured manifest of DDL/seed statements in a single transaction.
 * Adding tables only requires updating the manifest — not this engine.
 */

import { resolveManifestEntry, TENANT_SCHEMA_MANIFEST } from "./schemaManifest";
import type {
  ManifestContext,
  MigrationStepResult,
  ProvisionTenantOptions,
  ProvisionTenantResult,
  SchemaManifest,
  SchemaManifestEntry,
  SqlExecutor,
  SqlParameter,
  TenantConnectionConfig,
} from "./types";
import { resolveConnectionString } from "./types";

type NeonQueryResult = { rows?: unknown[] };

type NeonClientLike = {
  query: (sql: string, params?: SqlParameter[]) => Promise<NeonQueryResult>;
  release: () => void;
};

type NeonPoolLike = {
  connect: () => Promise<NeonClientLike>;
  end: () => Promise<void>;
};

/**
 * Create a SqlExecutor backed by @neondatabase/serverless.
 * Intended for server-side / admin tooling — do not embed Neon credentials in the browser.
 */
export async function createNeonSqlExecutor(
  connectionConfig: TenantConnectionConfig,
): Promise<SqlExecutor & { end: () => Promise<void> }> {
  const connectionString = resolveConnectionString(connectionConfig);
  const neon = await import("@neondatabase/serverless");
  const Pool = neon.Pool as unknown as new (config: { connectionString: string }) => NeonPoolLike;
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  return {
    query: async (sql: string, params: SqlParameter[] = []) => client.query(sql, params),
    begin: async () => {
      await client.query("BEGIN");
    },
    commit: async () => {
      await client.query("COMMIT");
    },
    rollback: async () => {
      await client.query("ROLLBACK");
    },
    release: async () => {
      client.release();
    },
    end: async () => {
      client.release();
      await pool.end();
    },
  };
}

function defaultLogger(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.info(`[tenantProvisioner] ${message}`, meta);
  } else {
    console.info(`[tenantProvisioner] ${message}`);
  }
}

function shouldRunEntry(
  entry: SchemaManifestEntry,
  options: ProvisionTenantOptions,
): boolean {
  if (options.runSeeds === false && entry.phase === "seeds") return false;
  if (options.onlyIds && !options.onlyIds.includes(entry.id)) return false;
  if (options.phases && !options.phases.includes(entry.phase)) return false;
  return true;
}

/**
 * Provision (or migrate) a tenant Neon database from a DDL/seed manifest.
 *
 * @param connectionConfig - Neon/Postgres connection details
 * @param manifestArray - Ordered schema/seed steps (defaults to TENANT_SCHEMA_MANIFEST)
 * @param options - Seeds toggle, filters, injectable executor, society context
 */
export async function provisionTenantDatabase(
  connectionConfig: TenantConnectionConfig,
  manifestArray: SchemaManifest | SchemaManifestEntry[] = TENANT_SCHEMA_MANIFEST,
  options: ProvisionTenantOptions = {},
): Promise<ProvisionTenantResult> {
  const logger = options.logger ?? defaultLogger;
  const startedAt = new Date().toISOString();
  const societyId =
    options.context?.societyId ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const ctx: ManifestContext = {
    societyId,
    schemaName: options.context?.schemaName ?? "public",
    society: options.context?.society,
  };

  const steps: MigrationStepResult[] = [];
  const entries = [...manifestArray];

  let executor: (SqlExecutor & { end?: () => Promise<void> }) | null = null;
  let ownsExecutor = false;

  try {
    if (options.executor) {
      executor = options.executor;
    } else {
      executor = await createNeonSqlExecutor(connectionConfig);
      ownsExecutor = true;
    }

    logger("Starting tenant provisioning", {
      societyId,
      steps: entries.length,
    });

    await executor.begin();

    for (const entry of entries) {
      if (!shouldRunEntry(entry, options)) {
        steps.push({
          id: entry.id,
          description: entry.description,
          phase: entry.phase,
          status: "skipped",
          durationMs: 0,
        });
        continue;
      }

      const resolved = resolveManifestEntry(entry, ctx);
      const stepStarted = Date.now();

      try {
        await executor.query(resolved.sql, resolved.params);
        const durationMs = Date.now() - stepStarted;
        steps.push({
          id: resolved.id,
          description: resolved.description,
          phase: resolved.phase,
          status: "success",
          durationMs,
        });
        logger("Migration step ok", { id: resolved.id, durationMs });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const durationMs = Date.now() - stepStarted;
        steps.push({
          id: resolved.id,
          description: resolved.description,
          phase: resolved.phase,
          status: "failed",
          durationMs,
          error: message,
        });

        logger("Migration step failed — rolling back", {
          id: resolved.id,
          error: message,
        });

        try {
          await executor.rollback();
        } catch (rollbackErr) {
          logger("Rollback failed", {
            error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
          });
        }

        const finishedAt = new Date().toISOString();
        return {
          success: false,
          societyId,
          steps,
          error: `Provisioning failed at "${resolved.id}": ${message}`,
          startedAt,
          finishedAt,
        };
      }
    }

    await executor.commit();
    const finishedAt = new Date().toISOString();
    logger("Tenant provisioning committed", { societyId, steps: steps.length });

    return {
      success: true,
      societyId,
      steps,
      startedAt,
      finishedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (executor) {
      try {
        await executor.rollback();
      } catch {
        // ignore secondary rollback errors
      }
    }

    logger("Tenant provisioning aborted", { error: message });
    return {
      success: false,
      societyId,
      steps,
      error: message,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } finally {
    if (ownsExecutor && executor) {
      try {
        if (executor.end) await executor.end();
        else if (executor.release) await executor.release();
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

/**
 * Serialize a manifest to plain SQL payloads (for router / remote provision APIs).
 * The remote executor remains table-agnostic — it only runs the provided statements.
 */
export function serializeManifestForRemote(
  manifestArray: SchemaManifest | SchemaManifestEntry[],
  ctx: ManifestContext,
  options: Pick<ProvisionTenantOptions, "runSeeds" | "onlyIds" | "phases"> = {},
): Array<{ id: string; description: string; phase: string; sql: string; params: SqlParameter[] }> {
  return [...manifestArray]
    .filter((entry) => shouldRunEntry(entry, options))
    .map((entry) => resolveManifestEntry(entry, ctx));
}
