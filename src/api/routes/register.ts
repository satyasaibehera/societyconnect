import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "@/db/client";
import { buildings, flats, registrationRequests } from "@/db/schema";

const router = Router();

type RegisterBody = {
  society_id?: string;
  building_id?: string;
  flat_id?: string;
  full_name?: string;
  phone_number?: string;
  phone?: string;
  is_ownership_transfer?: boolean;
  supporting_document_url?: string | null;
  supporting_document_base64?: string | null;
  supporting_document_content_type?: string | null;
  status?: string;
};

/**
 * POST /api/register
 * Creates a registration request (including ownership-transfer claims).
 */
router.post("/", async (req, res) => {
  try {
    const body = (req.body || {}) as RegisterBody;

    const societyId = String(body.society_id || "").trim();
    const buildingId = String(body.building_id || "").trim();
    const flatId = String(body.flat_id || "").trim();
    const fullName = String(body.full_name || "").trim();
    const phoneNumber = String(body.phone_number || body.phone || "").trim();
    const isOwnershipTransfer = Boolean(body.is_ownership_transfer);

    let supportingDocumentUrl = body.supporting_document_url
      ? String(body.supporting_document_url).trim()
      : null;

    if (!supportingDocumentUrl && body.supporting_document_base64) {
      const contentType = body.supporting_document_content_type || "application/octet-stream";
      supportingDocumentUrl = `data:${contentType};base64,${body.supporting_document_base64}`;
    }

    if (!societyId || !buildingId || !flatId || !fullName || !phoneNumber) {
      res.status(400).json({
        error:
          "Missing required fields: society_id, building_id, flat_id, full_name, phone_number",
      });
      return;
    }

    if (isOwnershipTransfer && !supportingDocumentUrl) {
      res.status(400).json({
        error: "Proof of Ownership document is required for ownership transfer claims",
      });
      return;
    }

    const db = getDb();

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
        societyId,
        buildingId,
        flatId,
        fullName,
        phoneNumber,
        isOwnershipTransfer,
        supportingDocumentUrl,
        status: body.status?.trim() || "pending",
      })
      .returning({
        id: registrationRequests.id,
        society_id: registrationRequests.societyId,
        building_id: registrationRequests.buildingId,
        flat_id: registrationRequests.flatId,
        full_name: registrationRequests.fullName,
        phone_number: registrationRequests.phoneNumber,
        is_ownership_transfer: registrationRequests.isOwnershipTransfer,
        supporting_document_url: registrationRequests.supportingDocumentUrl,
        status: registrationRequests.status,
        created_at: registrationRequests.createdAt,
      });

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

export default router;
