import cors from "cors";
import express, { type Express } from "express";
import platformRouter from "./routes/platform";
import additionRequestsRouter from "./routes/additionRequests";
import buildingsRouter from "./routes/buildings";
import registerRouter from "./routes/register";
import residentsRouter from "./routes/residents";
import societiesRouter from "./routes/societies";
import tenantDataRouter from "./routes/tenantData";
import usersRouter from "./routes/users";
import { requireAuthUnlessPublic, requireTenantDb } from "./middleware/requireAuth";

/**
 * Society Connect application API:
 * - Public registration catalog: societies, buildings, register, addition-requests
 * - Authenticated tenant CRUD: /api/data/:table (Neon tenant schema via X-Tenant-Db)
 */
export function createApiApp(): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(requireAuthUnlessPublic);

  app.use("/api/societies", societiesRouter);
  app.use("/api/platform", platformRouter);
  app.use("/api/buildings", buildingsRouter);
  app.use("/api/register", registerRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/residents", requireTenantDb, residentsRouter);
  app.use("/api/addition-requests", additionRequestsRouter);
  app.use("/api/data", requireTenantDb, tenantDataRouter);

  return app;
}

export default createApiApp;
