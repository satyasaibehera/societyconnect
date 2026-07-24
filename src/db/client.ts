import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

/**
 * neon() HTTP driver posts to https://api.neon.tech/sql.
 * That host is unreachable in some local networks (ConnectionRefused).
 * Pool + WebSocket talks directly to the Neon host in DATABASE_URL instead.
 */
neonConfig.webSocketConstructor = ws;

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.VITE_DATABASE_URL;

  if (!url?.trim()) {
    throw new Error(
      "Missing DATABASE_URL (or NEON_DATABASE_URL) for Drizzle / Neon connection",
    );
  }

  return url.trim();
}

type AppDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Lazy Neon Pool + Drizzle client so importing route modules does not
 * require env vars until a handler actually runs.
 */
let _db: AppDb | null = null;
let _pool: Pool | null = null;

export function getDb(): AppDb {
  if (_db) return _db;

  const connectionString = getDatabaseUrl();
  _pool = new Pool({ connectionString });
  _db = drizzle(_pool, { schema });
  return _db;
}

/** Underlying Neon Pool (creates the shared client if needed). */
export function getPool(): Pool {
  getDb();
  if (!_pool) {
    throw new Error("Database pool was not initialized");
  }
  return _pool;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

export type { AppDb };
