import type { NextFunction, Request, Response } from "express";

export type AuthedRequest = Request & {
  accessToken?: string;
  userId?: string;
  userEmail?: string;
};

const PUBLIC_API_PREFIXES = [
  "/health",
  "/api/societies",
  "/api/buildings",
  "/api/register",
  "/api/addition-requests",
];

function isPublicApiPath(path: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Verify Supabase JWT via Auth REST API and attach user id to the request.
 */
export async function requireAuthUnlessPublic(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isPublicApiPath(req.path)) {
    next();
    return;
  }

  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    res.status(401).json({ error: "Missing Authorization bearer token" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ error: "Supabase auth is not configured on the API server" });
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        apikey: anonKey,
      },
    });

    if (!response.ok) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const user = (await response.json()) as { id?: string; email?: string };
    req.accessToken = token.trim();
    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (err) {
    console.error("[requireAuth]", err);
    res.status(401).json({ error: "Auth verification failed" });
  }
}

export function requireTenantDb(req: Request, res: Response, next: NextFunction): void {
  const tenantDb =
    (req.headers["x-tenant-db"] as string | undefined)?.trim() ||
    (req.headers["x-tenant-db-name"] as string | undefined)?.trim();

  if (!tenantDb) {
    res.status(400).json({ error: "Missing X-Tenant-Db header" });
    return;
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tenantDb)) {
    res.status(400).json({ error: "Invalid X-Tenant-Db header" });
    return;
  }

  (req as Request & { tenantDb?: string }).tenantDb = tenantDb;
  next();
}
