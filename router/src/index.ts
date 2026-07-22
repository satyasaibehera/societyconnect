import cors from "cors";
import express from "express";
import { requireAuthUnlessPublic } from "./middleware/auth.js";
import { listActiveSocieties } from "./routes/societies.js";
import { listBuildingsForSociety } from "./routes/buildings.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  // Public health probe (also listed in PUBLIC_ROUTES).
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Auth gate — GET /api/societies and GET /api/buildings are public.
  app.use(requireAuthUnlessPublic);

  /**
   * Public registration catalog:
   * - No JWT required
   * - Only is_active = true
   * - Safe field projection only
   */
  app.get("/api/societies", async (_req, res) => {
    try {
      const societies = await listActiveSocieties();
      res.json({ societies });
    } catch (err) {
      console.error("[GET /api/societies]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to load societies",
      });
    }
  });

  /**
   * Public buildings + flats for a society (registration flat picker).
   * Query: ?society_id=<uuid>
   */
  app.get("/api/buildings", async (req, res) => {
    try {
      const societyId = String(req.query.society_id || "").trim();
      if (!societyId) {
        res.status(400).json({ error: "society_id query parameter is required" });
        return;
      }

      const buildings = await listBuildingsForSociety(societyId);
      res.json({ buildings });
    } catch (err) {
      console.error("[GET /api/buildings]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to load buildings",
      });
    }
  });

  // Placeholder stubs so public auth routes don't 404 while other handlers are wired.
  app.post("/api/auth/login", (_req, res) => {
    res.status(501).json({ error: "Auth login handler not wired in this package snapshot" });
  });
  app.post("/api/auth/register", (_req, res) => {
    res.status(501).json({ error: "Auth register handler not wired in this package snapshot" });
  });

  app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
  });

  return app;
}

export default createApp;

// Local dev entry only (avoid listening when imported by Netlify function)
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  /[\\/](src[\\/])?index\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun && process.env.NETLIFY !== "true") {
  const port = Number(process.env.PORT || 8787);
  const app = createApp();
  app.listen(port, () => {
    console.log(`[universal-tenant-router] listening on :${port}`);
  });
}
