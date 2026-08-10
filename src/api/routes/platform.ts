import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "@/db/client";
import { societies } from "@/db/schema";
import { assertAllowedTable, quoteIdent, withTenantClient } from "../lib/tenantSql";

const router = Router();

const DEFAULT_TENANT_SCHEMA =
  process.env.VITE_APP_ID?.trim() || process.env.APP_ID?.trim() || "society_connect";

/**
 * GET /api/platform/societies
 * Active societies catalog for platform admin context switching.
 */
router.get("/societies", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: societies.id,
        name: societies.name,
        city: societies.city,
        code: societies.code,
      })
      .from(societies)
      .where(eq(societies.isActive, true))
      .orderBy(asc(societies.name));

    res.json({ societies: rows });
  } catch (err) {
    console.error("[GET /api/platform/societies]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load platform societies",
    });
  }
});

/**
 * GET /api/platform/societies/:societyId/residents
 * Approved residents for impersonation picker (scoped by society).
 */
router.get("/societies/:societyId/residents", async (req, res) => {
  const societyId = String(req.params.societyId || "").trim();
  if (!societyId) {
    res.status(400).json({ error: "societyId is required" });
    return;
  }

  const tenantSchema = (
    (req.headers["x-tenant-db"] as string | undefined)?.trim() || DEFAULT_TENANT_SCHEMA
  ).replace(/[^a-zA-Z0-9_]/g, "");

  try {
    assertAllowedTable("residents");
    const table = quoteIdent("residents");

    const rows = await withTenantClient(tenantSchema, async (query) => {
      const result = await query(
        `SELECT id, user_id, full_name, resident_type, status
         FROM ${table}
         WHERE society_id = $1::uuid AND status = 'approved'
         ORDER BY full_name ASC
         LIMIT 200`,
        [societyId],
      );
      return result.rows;
    });

    res.json({ residents: rows });
  } catch (err) {
    console.error("[GET /api/platform/societies/:societyId/residents]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load society residents",
    });
  }
});

export default router;
