import { Router } from "express";
import type { AuthedRequest } from "../middleware/requireAuth";
import {
  syncUserApproved,
  syncUserRemoved,
  syncUserSuspended,
} from "@/services/userLifecycleService";

const router = Router();

function userIdParam(req: AuthedRequest): string {
  return String(req.params.userId || "").trim();
}

/**
 * POST /api/users/:userId/activate
 * Approval — Neon status active + enable Supabase Auth user.
 */
router.post("/:userId/activate", async (req: AuthedRequest, res) => {
  try {
    const userId = userIdParam(req);
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }

    await syncUserApproved(userId);
    res.json({ success: true, userId, status: "active" });
  } catch (err) {
    console.error("[POST /api/users/:userId/activate]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "User activation sync failed",
    });
  }
});

/**
 * POST /api/users/:userId/suspend
 * Revocation — Neon status suspended + ban Supabase Auth user.
 */
router.post("/:userId/suspend", async (req: AuthedRequest, res) => {
  try {
    const userId = userIdParam(req);
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }

    await syncUserSuspended(userId);
    res.json({ success: true, userId, status: "suspended" });
  } catch (err) {
    console.error("[POST /api/users/:userId/suspend]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "User suspension sync failed",
    });
  }
});

/**
 * DELETE /api/users/:userId
 * Removal — delete Neon profile/roles then Supabase Auth user.
 */
router.delete("/:userId", async (req: AuthedRequest, res) => {
  try {
    const userId = userIdParam(req);
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }

    if (req.userId === userId) {
      res.status(400).json({ error: "Cannot remove your own account via this endpoint" });
      return;
    }

    await syncUserRemoved(userId);
    res.json({ success: true, userId });
  } catch (err) {
    console.error("[DELETE /api/users/:userId]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "User removal sync failed",
    });
  }
});

export default router;
