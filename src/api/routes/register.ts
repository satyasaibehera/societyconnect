import { and, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { getDb, getPool } from "@/db/client";
import { ensureRegistrationTables, randomUUID } from "@/db/ensure";
import {
  FLAT_REQUEST_STATUS,
  REGISTRATION_STATUS,
} from "@/db/registrationStatuses";
import {
  additionRequests,
  buildings,
  flats,
  registrationRequests,
} from "@/db/schema";

const router = Router();

type RegisterBody = {
  society_id?: string;
  building_id?: string;
  flat_id?: string;
  full_name?: string;
  phone_number?: string;
  phone?: string;
  email?: string;
  resident_type?: string;
  is_ownership_transfer?: boolean;
  supporting_document_url?: string | null;
  supporting_document_base64?: string | null;
  supporting_document_content_type?: string | null;
  /** When true, create FlatRequest + registration WAITING_FOR_FLAT */
  request_new_flat?: boolean;
  building_name?: string;
  flat_number?: string;
  notes?: string;
};

function supportingDocUrl(body: RegisterBody): string | null {
  if (body.supporting_document_url) return String(body.supporting_document_url).trim();
  if (body.supporting_document_base64) {
    const contentType = body.supporting_document_content_type || "application/octet-stream";
    return `data:${contentType};base64,${body.supporting_document_base64}`;
  }
  return null;
}

/**
 * POST /api/register
 * - Existing flat: UserRegistration with READY_FOR_REVIEW
 * - Missing flat: FlatRequest (PENDING) + UserRegistration (WAITING_FOR_FLAT)
 */
router.post("/", async (req, res) => {
  try {
    const body = (req.body || {}) as RegisterBody;
    const societyId = String(body.society_id || "").trim();
    const fullName = String(body.full_name || "").trim();
    const phoneNumber = String(body.phone_number || body.phone || "").trim();
    const email = body.email ? String(body.email).trim() : null;
    const residentType = body.resident_type ? String(body.resident_type).trim() : null;
    const isOwnershipTransfer = Boolean(body.is_ownership_transfer);
    const requestNewFlat = Boolean(body.request_new_flat);
    const supportingDocumentUrl = supportingDocUrl(body);

    if (!societyId || !fullName || !phoneNumber) {
      res.status(400).json({
        error: "Missing required fields: society_id, full_name, phone_number",
      });
      return;
    }

    await ensureRegistrationTables(getPool());
    const db = getDb();

    if (requestNewFlat) {
      const buildingName = String(body.building_name || "").trim();
      const flatNumber = String(body.flat_number || "").trim();
      const notes = body.notes ? String(body.notes).trim() : null;

      if (!buildingName || !flatNumber) {
        res.status(400).json({
          error: "building_name and flat_number are required when requesting a new flat",
        });
        return;
      }

      // Ownership transfer cannot target a non-existent flat
      if (isOwnershipTransfer) {
        res.status(400).json({
          error: "Ownership transfer requires an existing occupied flat",
        });
        return;
      }

      const flatRequestId = randomUUID();
      const registrationId = randomUUID();
      const displayName = `${buildingName} / ${flatNumber}`;

      const [flatRequest] = await db
        .insert(additionRequests)
        .values({
          id: flatRequestId,
          societyId,
          requestedType: "flat",
          requestedName: displayName,
          buildingName,
          flatNumber,
          notes,
          status: FLAT_REQUEST_STATUS.PENDING,
        })
        .returning();

      const [registration] = await db
        .insert(registrationRequests)
        .values({
          id: registrationId,
          societyId,
          buildingId: null,
          flatId: null,
          flatRequestId,
          fullName,
          phoneNumber,
          email,
          residentType,
          isOwnershipTransfer: false,
          supportingDocumentUrl: null,
          status: REGISTRATION_STATUS.WAITING_FOR_FLAT,
        })
        .returning();

      res.status(201).json({
        success: true,
        flat_request: flatRequest,
        registration,
      });
      return;
    }

    const buildingId = String(body.building_id || "").trim();
    const flatId = String(body.flat_id || "").trim();

    if (!buildingId || !flatId) {
      res.status(400).json({
        error: "Missing required fields: building_id, flat_id (or set request_new_flat)",
      });
      return;
    }

    if (isOwnershipTransfer && !supportingDocumentUrl) {
      res.status(400).json({
        error: "Proof of Ownership document is required for ownership transfer claims",
      });
      return;
    }

    const [building] = await db
      .select({ id: buildings.id, societyId: buildings.societyId })
      .from(buildings)
      .where(and(eq(buildings.id, buildingId), eq(buildings.societyId, societyId)))
      .limit(1);

    if (!building) {
      res.status(400).json({ error: "building_id does not belong to society_id" });
      return;
    }

    const [flat] = await db
      .select({
        id: flats.id,
        buildingId: flats.buildingId,
        isOccupied: flats.isOccupied,
      })
      .from(flats)
      .where(and(eq(flats.id, flatId), eq(flats.buildingId, buildingId)))
      .limit(1);

    if (!flat) {
      res.status(400).json({ error: "flat_id does not belong to building_id" });
      return;
    }

    if (isOwnershipTransfer && !flat.isOccupied) {
      res.status(400).json({
        error: "is_ownership_transfer requires an occupied flat",
      });
      return;
    }

    const [created] = await db
      .insert(registrationRequests)
      .values({
        id: randomUUID(),
        societyId,
        buildingId,
        flatId,
        flatRequestId: null,
        fullName,
        phoneNumber,
        email,
        residentType,
        isOwnershipTransfer,
        supportingDocumentUrl,
        status: REGISTRATION_STATUS.READY_FOR_REVIEW,
      })
      .returning();

    res.status(201).json({
      success: true,
      registration: created,
    });
  } catch (err) {
    console.error("[POST /api/register]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Registration failed",
    });
  }
});

/**
 * GET /api/register?status=...
 * Lists registration requests (defaults to pending/waiting).
 */
router.get("/", async (req, res) => {
  try {
    await ensureRegistrationTables(getPool());
    const db = getDb();
    const societyId = String(req.query.society_id || "").trim();
    const statusFilter = String(req.query.status || "").trim();

    const rows = await db
      .select({
        id: registrationRequests.id,
        society_id: registrationRequests.societyId,
        building_id: registrationRequests.buildingId,
        flat_id: registrationRequests.flatId,
        flat_request_id: registrationRequests.flatRequestId,
        full_name: registrationRequests.fullName,
        phone_number: registrationRequests.phoneNumber,
        email: registrationRequests.email,
        resident_type: registrationRequests.residentType,
        is_ownership_transfer: registrationRequests.isOwnershipTransfer,
        status: registrationRequests.status,
        created_at: registrationRequests.createdAt,
        flat_request_building_name: additionRequests.buildingName,
        flat_request_flat_number: additionRequests.flatNumber,
        flat_request_status: additionRequests.status,
      })
      .from(registrationRequests)
      .leftJoin(additionRequests, eq(registrationRequests.flatRequestId, additionRequests.id))
      .where(
        societyId
          ? eq(registrationRequests.societyId, societyId)
          : sql`true`,
      )
      .orderBy(registrationRequests.createdAt);

    const filtered = statusFilter
      ? rows.filter((r) => r.status === statusFilter)
      : rows.filter(
          (r) =>
            r.status === REGISTRATION_STATUS.WAITING_FOR_FLAT ||
            r.status === REGISTRATION_STATUS.READY_FOR_REVIEW ||
            r.status === REGISTRATION_STATUS.PENDING_USER_APPROVAL ||
            r.status === REGISTRATION_STATUS.PENDING,
        );

    res.json({ registrations: filtered });
  } catch (err) {
    console.error("[GET /api/register]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to list registrations",
    });
  }
});

/**
 * POST /api/register/:id/approve
 * Only allowed when status is READY_FOR_REVIEW (not WAITING_FOR_FLAT).
 */
router.post("/:id/approve", async (req, res) => {
  try {
    await ensureRegistrationTables(getPool());
    const db = getDb();
    const id = String(req.params.id || "").trim();

    const [row] = await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }

    if (row.status === REGISTRATION_STATUS.WAITING_FOR_FLAT) {
      res.status(409).json({
        error: "Cannot approve user until the requested flat is created and approved by Society Admin.",
        code: "WAITING_FOR_FLAT",
      });
      return;
    }

    if (
      row.status !== REGISTRATION_STATUS.READY_FOR_REVIEW &&
      row.status !== REGISTRATION_STATUS.PENDING_USER_APPROVAL &&
      row.status !== REGISTRATION_STATUS.PENDING
    ) {
      res.status(409).json({ error: `Cannot approve registration in status ${row.status}` });
      return;
    }

    const [updated] = await db
      .update(registrationRequests)
      .set({
        status: REGISTRATION_STATUS.APPROVED,
        updatedAt: new Date(),
      })
      .where(eq(registrationRequests.id, id))
      .returning();

    res.json({ success: true, registration: updated });
  } catch (err) {
    console.error("[POST /api/register/:id/approve]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Approve failed",
    });
  }
});

/**
 * POST /api/register/:id/reject
 */
router.post("/:id/reject", async (req, res) => {
  try {
    await ensureRegistrationTables(getPool());
    const db = getDb();
    const id = String(req.params.id || "").trim();

    const [row] = await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }

    if (row.status === REGISTRATION_STATUS.WAITING_FOR_FLAT) {
      res.status(409).json({
        error: "Cannot approve user until the requested flat is created and approved by Society Admin.",
        code: "WAITING_FOR_FLAT",
      });
      return;
    }

    const [updated] = await db
      .update(registrationRequests)
      .set({
        status: REGISTRATION_STATUS.REJECTED,
        updatedAt: new Date(),
      })
      .where(eq(registrationRequests.id, id))
      .returning();

    res.json({ success: true, registration: updated });
  } catch (err) {
    console.error("[POST /api/register/:id/reject]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Reject failed",
    });
  }
});

export default router;
