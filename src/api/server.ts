import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Load .env before any DB client reads process.env (works for bun/node).
loadEnv({ path: resolve(process.cwd(), ".env") });

import { createApiApp } from "./index";

const port = Number(process.env.PORT || process.env.API_PORT || 5000);
const host = process.env.API_HOST || "127.0.0.1";

const app = createApiApp();

app.listen(port, host, () => {
  console.log(`[api] Societies Connect API listening on http://${host}:${port}`);
  console.log(
    "[api] Routes: GET /api/societies, GET /api/buildings, POST /api/register, GET|POST|PATCH|DELETE /api/data/:table",
  );
});
