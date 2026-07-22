import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

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

/**
 * Lazy Neon + Drizzle client so importing route modules does not
 * require env vars until a handler actually runs.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const sql = neon(getDatabaseUrl());
  _db = drizzle(sql, { schema });
  return _db;
}

export type AppDb = ReturnType<typeof getDb>;
