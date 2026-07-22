import cors from "cors";
import express, { type Express } from "express";
import buildingsRouter from "./routes/buildings";
import registerRouter from "./routes/register";
import societiesRouter from "./routes/societies";

/**
 * Mount public registration API routes:
 * - GET  /api/societies
 * - GET  /api/buildings?society_id=...
 * - POST /api/register
 */
export function createApiApp(): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/societies", societiesRouter);
  app.use("/api/buildings", buildingsRouter);
  app.use("/api/register", registerRouter);

  return app;
}

export default createApiApp;
