import type { Pool, PoolClient } from "@neondatabase/serverless";
import { getPool } from "@/db/client";

/** Tables allowed for generic tenant CRUD (Neon tenant schema). */
export const ALLOWED_TENANT_TABLES = new Set([
  "access_controls",
  "approval_delegates",
  "buildings",
  "complaints",
  "emergency_alerts",
  "helper_assignments",
  "helpers",
  "meetings",
  "move_passes",
  "notice_types",
  "notices",
  "notifications",
  "office_bearers",
  "owner_payment_config",
  "payment_categories",
  "payment_records",
  "polls",
  "profiles",
  "rent_receipts",
  "residents",
  "resolutions",
  "role_requests",
  "security_staff",
  "societies",
  "units",
  "user_roles",
  "vehicle_passes",
  "vehicles",
  "visitors",
  "votes",
]);

export function assertAllowedTable(table: string): string {
  const normalized = table.trim().toLowerCase();
  if (!ALLOWED_TENANT_TABLES.has(normalized)) {
    throw new Error(`Table not allowed: ${table}`);
  }
  return normalized;
}

export function quoteIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

export type SqlQueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

export async function withTenantClient<T>(
  schema: string,
  fn: (query: SqlQueryFn, client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool: Pool = getPool();
  const client = await pool.connect();
  const safeSchema = quoteIdent(schema);

  try {
    await client.query(`SET search_path TO ${safeSchema}, public`);

    const query: SqlQueryFn = async (sql, params = []) => {
      const result = await client.query(sql, params);
      return {
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? 0,
      };
    };

    return await fn(query, client);
  } finally {
    client.release();
  }
}
