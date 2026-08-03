import { Router } from "express";
import type { AuthedRequest } from "../middleware/requireAuth";
import { withTenantClient } from "../lib/tenantSql";

const router = Router();

type TransferBody = {
  current_owner_id?: string;
  new_owner_id?: string;
  invoker_user_id?: string;
};

/** POST /api/residents/transfer-ownership — calls Neon transfer_ownership() */
router.post("/transfer-ownership", async (req, res) => {
  try {
    const tenantDb = (req as AuthedRequest & { tenantDb?: string }).tenantDb || "public";
    const body = (req.body || {}) as TransferBody;
    const currentOwnerId = String(body.current_owner_id || "").trim();
    const newOwnerId = String(body.new_owner_id || "").trim();
    const invokerUserId = String(body.invoker_user_id || req.userId || "").trim();

    if (!currentOwnerId || !newOwnerId || !invokerUserId) {
      res.status(400).json({
        error: "current_owner_id, new_owner_id, and invoker_user_id are required",
      });
      return;
    }

    await withTenantClient(tenantDb, async (query) => {
      await query(
        "SELECT transfer_ownership($1::uuid, $2::uuid, $3::uuid)",
        [currentOwnerId, newOwnerId, invokerUserId],
      );
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[POST /api/residents/transfer-ownership]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Ownership transfer failed",
    });
  }
});

export default router;
