import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "@/db/client";
import { societies } from "@/db/schema";

const router = Router();

/**
 * GET /api/societies
 * Returns active societies (id, name, code).
 */
router.get("/", async (_req, res) => {
  try {
    const db = getDb();
    // Select only columns present on live society DBs (code is optional / may be missing).
    const rows = await db
      .select({
        id: societies.id,
        name: societies.name,
        city: societies.city,
      })
      .from(societies)
      .where(eq(societies.isActive, true))
      .orderBy(asc(societies.name));

    res.json({
      societies: rows.map((row) => ({
        ...row,
        code: null as string | null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/societies]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load societies",
    });
  }
});

export default router;
