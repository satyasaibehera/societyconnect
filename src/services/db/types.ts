/**
 * Shared types for Neon tenant provisioning (database-per-society).
 */

/** Primitive values accepted as SQL bind parameters. */
export type SqlParameter = string | number | boolean | null | Date;

/** Runtime context used to parameterize DDL / seed statements. */
export interface ManifestContext {
  /** Canonical society UUID for this tenant database. */
  societyId: string;
  /** Optional schema name (defaults to public). */
  schemaName?: string;
  /** Optional society metadata used by seed inserts. */
  society?: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    createdBy?: string | null;
    isActive?: boolean;
  };
}

export type ManifestPhase =
  | "extensions"
  | "enums"
  | "tables"
  | "indexes"
  | "constraints"
  | "seeds";

/**
 * One migration step. The provisioner engine never inspects table names —
 * it only executes `sql` (+ optional `params`) in order.
 */
export interface SchemaManifestEntry {
  /** Stable identifier for logging / status reporting. */
  id: string;
  /** Human-readable description. */
  description: string;
  phase: ManifestPhase;
  /**
   * Static SQL or a factory that receives provisioning context
   * (e.g. to inject society_id into seed statements).
   */
  sql: string | ((ctx: ManifestContext) => string);
  /**
   * Optional bind parameters (positional `$1`, `$2`, …).
   * Prefer factories when values depend on society metadata.
   */
  params?: SqlParameter[] | ((ctx: ManifestContext) => SqlParameter[]);
}

export type SchemaManifest = readonly SchemaManifestEntry[];

/** Neon / Postgres connection details for a tenant database. */
export interface TenantConnectionConfig {
  /** Full Postgres connection string (preferred). */
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
}

/** Injectable SQL executor — keeps the migration engine DB-client agnostic. */
export interface SqlExecutor {
  query: (sql: string, params?: SqlParameter[]) => Promise<unknown>;
  begin: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release?: () => Promise<void>;
}

export interface ProvisionTenantOptions {
  /** When false, skip entries with phase === "seeds". Default true. */
  runSeeds?: boolean;
  /** Optional subset of manifest entry ids to run. Default: all. */
  onlyIds?: string[];
  /** Optional phases to include. Default: all. */
  phases?: ManifestPhase[];
  /** Inject a pre-built executor (tests / custom drivers). */
  executor?: SqlExecutor;
  /** Extra context merged into ManifestContext. */
  context?: Partial<Omit<ManifestContext, "societyId">> & { societyId?: string };
  /** Logger hook; defaults to console. */
  logger?: (message: string, meta?: Record<string, unknown>) => void;
  /** When false, allow browser provisioning without an auth session (e.g. enrollment). Default true. */
  requireAuth?: boolean;
}

export type MigrationStepStatus = "pending" | "success" | "failed" | "skipped";

export interface MigrationStepResult {
  id: string;
  description: string;
  phase: ManifestPhase;
  status: MigrationStepStatus;
  durationMs: number;
  error?: string;
}

export interface ProvisionTenantResult {
  success: boolean;
  societyId: string;
  steps: MigrationStepResult[];
  error?: string;
  startedAt: string;
  finishedAt: string;
}

export function resolveConnectionString(config: TenantConnectionConfig): string {
  if (config.connectionString?.trim()) {
    return config.connectionString.trim();
  }

  const {
    host,
    port = 5432,
    database,
    user,
    password,
    ssl = true,
  } = config;

  if (!host || !database || !user) {
    throw new Error(
      "TenantConnectionConfig requires either connectionString or host + database + user",
    );
  }

  const auth = password != null ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  const sslMode = ssl === false ? "disable" : "require";
  return `postgresql://${auth}@${host}:${port}/${database}?sslmode=${sslMode}`;
}
