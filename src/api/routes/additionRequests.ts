import { and, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { getDb, getPool } from "@/db/client";
import { ensureRegistrationTables, randomUUID } from "@/db/ensure";
import {
  FLAT_REQUEST_STATUS,
  REGISTRATION_STATUS,
} from "@/db/registrationStatuses";
import { additionRequests, buildings, flats, registrationRequests } from "@/db/schema";

const router = Router();

type AdditionBody = {
  society_id?: string;
  requested_type?: "building" | "flat" | string;
  requested_name?: string;
  building_name?: string;
  flat_number?: string;
  notes?: string;
};

/**
 * GET /api/addition-requests
 * Lists FlatRequests (defaults to PENDING).
 */
router.get("/", async (req, res) => {
  try {
    await ensureRegistrationTables(getPool());
    const db = getDb();
    const societyId = String(req.query.society_id || "").trim();
    const status = String(req.query.status || FLAT_REQUEST_STATUS.PENDING).trim();

    const rows = await db
      .select({
        id: additionRequests.id,
        society_id: additionRequests.societyId,
        requested_type: additionRequests.requestedType,
        requested_name: additionRequests.requestedName,
        building_name: additionRequests.buildingName,
        flat_number: additionRequests.flatNumber,
        notes: additionRequests.notes,
        status: additionRequests.status,
        resolved_building_id: additionRequests.resolvedBuildingId,
        resolved_flat_id: additionRequests.resolvedFlatId,
        created_at: additionRequests.createdAt,
      })
      .from(additionRequests)
      .where(
        and(
          societyId ? eq(additionRequests.societyId, societyId) : sql`true`,
          or(
            eq(additionRequests.status, status),
            // accept legacy lowercase pending
            status === FLAT_REQUEST_STATUS.PENDING
              ? eq(additionRequests.status, "pending")
              : sql`false`,
          ),
        ),
      )
      .orderBy(additionRequests.createdAt);

    res.json({ requests: rows });
  } catch (err) {
    console.error("[GET /api/addition-requests]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to list flat requests",
    });
  }
});

/**
 * POST /api/addition-requests
 * Standalone FlatRequest (without linked registration) — kept for compat.
 */
router.post("/", async (req, res) => {
  try {
    const body = (req.body || {}) as AdditionBody;

    const societyId = String(body.society_id || "").trim();
    const buildingName = String(body.building_name || "").trim();
    const flatNumber = String(body.flat_number || "").trim();
    const notes = body.notes ? String(body.notes).trim() : null;
    const requestedTypeRaw = String(body.requested_type || "flat").trim().toLowerCase();
    const requestedName =
      String(body.requested_name || "").trim() ||
      [buildingName, flatNumber].filter(Boolean).join(" / ");

    if (!societyId || !requestedName) {
      res.status(400).json({
        error: "Missing required fields: society_id and building/flat details",
      });
      return;
    }

    const requestedType =
      requestedTypeRaw === "building" || requestedTypeRaw === "flat"
        ? requestedTypeRaw
        : "flat";

    await ensureRegistrationTables(getPool());
    const db = getDb();

    const [created] = await db
      .insert(additionRequests)
      .values({
        id: randomUUID(),
        societyId,
        requestedType,
        requestedName,
        buildingName: buildingName || null,
        flatNumber: flatNumber || null,
        notes,
        status: FLAT_REQUEST_STATUS.PENDING,
      })
      .returning();

    res.status(201).json({ success: true, request: created });
  } catch (err) {
    console.error("[POST /api/addition-requests]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to submit addition request",
    });
  }
});

/**
 * POST /api/addition-requests/:id/approve
 * Creates building/flat in master tables, then promotes linked registrations
 * from WAITING_FOR_FLAT → READY_FOR_REVIEW.
 */
router.post("/:id/approve", async (req, res) => {
  try {
    await ensureRegistrationTables(getPool());
    const db = getDb();
    const id = String(req.params.id || "").trim();

    const [request] = await db
      .select()
      .from(additionRequests)
      .where(eq(additionRequests.id, id))
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "Flat request not found" });
      return;
    }

    if (
      request.status !== FLAT_REQUEST_STATUS.PENDING &&
      request.status !== "pending"
    ) {
      res.status(409).json({ error: `Flat request already ${request.status}` });
      return;
    }

    const buildingName =
      (request.buildingName || "").trim() ||
      (request.requestedType === "building" ? request.requestedName.trim() : "");
    const flatNumber =
      (request.flatNumber || "").trim() ||
      (request.requestedType === "flat" && !request.buildingName
        ? request.requestedName.trim()
        : "");

    // Parse "Building / Flat" display name if structured fields missing
    let resolvedBuildingName = buildingName;
    let resolvedFlatNumber = flatNumber;
    if ((!resolvedBuildingName || !resolvedFlatNumber) && request.requestedName.includes("/")) {
      const [b, f] = request.requestedName.split("/").map((s) => s.trim());
      resolvedBuildingName = resolvedBuildingName || b || "Unknown Building";
      resolvedFlatNumber = resolvedFlatNumber || f || request.requestedName;
    }
    if (!resolvedBuildingName) resolvedBuildingName = "Unknown Building";
    if (!resolvedFlatNumber) resolvedFlatNumber = request.requestedName;

    // Find or create building
    const existingBuildings = await db
      .select()
      .from(buildings)
      .where(
        and(
          eq(buildings.societyId, request.societyId),
          ilike(buildings.name, resolvedBuildingName),
        ),
      )
      .limit(1);

    let buildingId = existingBuildings[0]?.id;
    if (!buildingId) {
      buildingId = randomUUID();
      await db.insert(buildings).values({
        id: buildingId,
        societyId: request.societyId,
        name: resolvedBuildingName,
      });
    }

    // Find or create flat
    const existingFlats = await db
      .select()
      .from(flats)
      .where(
        and(eq(flats.buildingId, buildingId), ilike(flats.flatNumber, resolvedFlatNumber)),
      )
      .limit(1);

    let flatId = existingFlats[0]?.id;
    if (!flatId) {
      flatId = randomUUID();
      await db.insert(flats).values({
        id: flatId,
        buildingId,
        flatNumber: resolvedFlatNumber,
        isOccupied: false,
      });
    }

    const [updatedRequest] = await db
      .update(additionRequests)
      .set({
        status: FLAT_REQUEST_STATUS.APPROVED,
        resolvedBuildingId: buildingId,
        resolvedFlatId: flatId,
        buildingName: resolvedBuildingName,
        flatNumber: resolvedFlatNumber,
        updatedAt: new Date(),
      })
      .where(eq(additionRequests.id, id))
      .returning();

    // Promote linked UserRegistrations
    const promoted = await db
      .update(registrationRequests)
      .set({
        buildingId,
        flatId,
        status: REGISTRATION_STATUS.READY_FOR_REVIEW,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(registrationRequests.flatRequestId, id),
          eq(registrationRequests.status, REGISTRATION_STATUS.WAITING_FOR_FLAT),
        ),
      )
      .returning({
        id: registrationRequests.id,
        status: registrationRequests.status,
      });

    res.json({
      success: true,
      request: updatedRequest,
      building_id: buildingId,
      flat_id: flatId,
      promoted_registrations: promoted,
    });
  } catch (err) {
    console.error("[POST /api/addition-requests/:id/approve]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to approve flat request",
    });
  }
});

/**
 * POST /api/addition-requests/:id/reject
 */
router.post("/:id/reject", async (req, res) => {
  try {
    await ensureRegistrationTables(getPool());
    const db = getDb();
    const id = String(req.params.id || "").trim();

    const [request] = await db
      .select()
      .from(additionRequests)
      .where(eq(additionRequests.id, id))
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "Flat request not found" });
      return;
    }

    const [updatedRequest] = await db
      .update(additionRequests)
      .set({
        status: FLAT_REQUEST_STATUS.REJECTED,
        updatedAt: new Date(),
      })
      .where(eq(additionRequests.id, id))
      .returning();

    await db
      .update(registrationRequests)
      .set({
        status: REGISTRATION_STATUS.REJECTED,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(registrationRequests.flatRequestId, id),
          eq(registrationRequests.status, REGISTRATION_STATUS.WAITING_FOR_FLAT),
        ),
      );

    res.json({ success: true, request: updatedRequest });
  } catch (err) {
    console.error("[POST /api/addition-requests/:id/reject]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to reject flat request",
    });
  }
});

export default router;
