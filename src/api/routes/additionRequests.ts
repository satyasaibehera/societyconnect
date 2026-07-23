import { Router } from "express";
import { getDb } from "@/db/client";
import { additionRequests } from "@/db/schema";

const router = Router();

type AdditionBody = {
  society_id?: string;
  requested_type?: "building" | "flat" | string;
  requested_name?: string;
  notes?: string;
};

/**
 * POST /api/addition-requests
 * Lightweight "can't find building/flat" request for society admin review.
 *
 * Body: { society_id, requested_type: 'building' | 'flat', requested_name, notes? }
 */
router.post("/", async (req, res) => {
  try {
    const body = (req.body || {}) as AdditionBody;

    const societyId = String(body.society_id || "").trim();
    const requestedTypeRaw = String(body.requested_type || "").trim().toLowerCase();
    const requestedName = String(body.requested_name || "").trim();
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!societyId || !requestedName || (requestedTypeRaw !== "building" && requestedTypeRaw !== "flat")) {
      res.status(400).json({
        error:
          "Missing or invalid fields: society_id, requested_type ('building' | 'flat'), requested_name",
      });
      return;
    }

    const requestedType = requestedTypeRaw as "building" | "flat";
    const db = getDb();
    const [created] = await db
      .insert(additionRequests)
      .values({
        societyId,
        requestedType,
        requestedName,
        notes,
        status: "pending",
      })
      .returning({
        id: additionRequests.id,
        society_id: additionRequests.societyId,
        requested_type: additionRequests.requestedType,
        requested_name: additionRequests.requestedName,
        notes: additionRequests.notes,
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
