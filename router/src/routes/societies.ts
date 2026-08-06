import { neon } from "@neondatabase/serverless";

/** Safe public projection for registration dropdowns — no internal/security fields. */
export type PublicSociety = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url?.trim()) {
    throw new Error("Missing DATABASE_URL for public.societies access");
  }

  return url.trim();
}

/**
 * Load active societies from the root Neon DB (`public.societies`).
 * Omits internal fields such as created_by and any connection metadata.
 */
export async function listActiveSocieties(): Promise<PublicSociety[]> {
  const sql = neon(getDatabaseUrl());

  const rows = await sql`
    SELECT
      id,
      name,
      city,
      state,
      is_active
    FROM public.societies
    WHERE is_active = true
    ORDER BY name ASC
  `;

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    city: row.city == null ? null : String(row.city),
    state: row.state == null ? null : String(row.state),
    is_active: Boolean(row.is_active),
  }));
}
