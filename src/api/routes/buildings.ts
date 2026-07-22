import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "@/db/client";
import { buildings, flats } from "@/db/schema";

const router = Router();

/**
 * GET /api/buildings?society_id=...
 * Returns buildings for a society with nested flats arrays
 * (join via buildings.id = flats.building_id).
 */
router.get("/", async (req, res) => {
  try {
    const societyId = String(req.query.society_id || "").trim();
    if (!societyId) {
      res.status(400).json({ error: "society_id query parameter is required" });
      return;
    }

    const db = getDb();

    const buildingRows = await db
      .select({
        id: buildings.id,
        society_id: buildings.societyId,
        name: buildings.name,
      })
      .from(buildings)
      .where(eq(buildings.societyId, societyId))
      .orderBy(asc(buildings.name));

    const flatRows = await db
      .select({
        id: flats.id,
        building_id: flats.buildingId,
        flat_number: flats.flatNumber,
        is_occupied: flats.isOccupied,
      })
      .from(flats)
      .innerJoin(buildings, eq(flats.buildingId, buildings.id))
      .where(eq(buildings.societyId, societyId))
      .orderBy(asc(flats.flatNumber));

    const flatsByBuilding = new Map<
      string,
      Array<{
        id: string;
        building_id: string;
        flat_number: string;
        is_occupied: boolean;
      }>
    >();

    for (const flat of flatRows) {
      const list = flatsByBuilding.get(flat.building_id) ?? [];
      list.push(flat);
      flatsByBuilding.set(flat.building_id, list);
    }

    const result = buildingRows.map((building) => ({
      ...building,
      flats: flatsByBuilding.get(building.id) ?? [],
    }));

    res.json({ buildings: result });
  } catch (err) {
    console.error("[GET /api/buildings]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load buildings",
    });
  }
});

export default router;
