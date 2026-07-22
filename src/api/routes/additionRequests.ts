import { Router } from "express";
import { getDb } from "@/db/client";
import { additionRequests } from "@/db/schema";

const router = Router();

/**
 * POST /api/addition-requests
 * Lightweight "can't find building/flat" request for society admin review.
 */
router.post("/", async (req, res) => {
  try {
    const body = (req.body || {}) as {
      society_id?: string;
      requester_name?: string;
      requester_phone?: string;
      requester_email?: string;
      building_name?: string;
      flat_number?: string;
      notes?: string;
    };

    const societyId = String(body.society_id || "").trim();
    const requesterName = String(body.requester_name || "").trim();
    const buildingName = String(body.building_name || "").trim();
    const flatNumber = String(body.flat_number || "").trim();

    if (!societyId || !requesterName || !buildingName || !flatNumber) {
      res.status(400).json({
        error: "Missing required fields: society_id, requester_name, building_name, flat_number",
      });
      return;
    }

    const db = getDb();
    const [created] = await db
      .insert(additionRequests)
      .values({
        societyId,
        requesterName,
        requesterPhone: body.requester_phone?.trim() || null,
        requesterEmail: body.requester_email?.trim() || null,
        buildingName,
        flatNumber,
        notes: body.notes?.trim() || null,
        status: "pending",
      })
      .returning({
        id: additionRequests.id,
        status: additionRequests.status,
        created_at: additionRequests.createdAt,
      });

    res.status(201).json({ success: true, request: created });
  } catch (err) {
    console.error("[POST /api/addition-requests]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to submit addition request",
    });
  }
});

export default router;
