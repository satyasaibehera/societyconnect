/**
 * Auth middleware for the tenant router.
 *
 * GET /api/societies is public so registration can list active societies
 * before the user has a JWT.
 */

import type { NextFunction, Request, Response } from "express";

export type PublicRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
  /** Exact path or prefix ending with `*` (e.g. `/api/auth/*`). */
  path: string;
};

/** Routes that skip bearer-token enforcement. */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { method: "GET", path: "/health" },
  { method: "GET", path: "/api/societies" },
  { method: "GET", path: "/api/buildings" },
  { method: "POST", path: "/api/auth/login" },
  { method: "POST", path: "/api/auth/register" },
  { method: "POST", path: "/api/auth/send-otp" },
  { method: "POST", path: "/api/auth/verify-otp" },
];

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const withoutQuery = pathname.split("?")[0] || "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function isPublicRoute(method: string, pathname: string): boolean {
  const verb = method.toUpperCase();
  const path = normalizePath(pathname);

  return PUBLIC_ROUTES.some((route) => {
    const methodOk = route.method === "*" || route.method === verb;
    if (!methodOk) return false;

    if (route.path.endsWith("/*")) {
      const prefix = route.path.slice(0, -1); // keep trailing slash, e.g. "/api/auth/"
      const base = route.path.slice(0, -2); // "/api/auth"
      return path === base || path.startsWith(prefix);
    }

    if (route.path.endsWith("*")) {
      const prefix = route.path.slice(0, -1);
      return path.startsWith(prefix);
    }

    return path === route.path;
  });
}

/**
 * Require `Authorization: Bearer <jwt>` for non-public routes.
 * Public routes (including GET /api/societies) pass through without a token.
 */
export function requireAuthUnlessPublic(req: Request, res: Response, next: NextFunction): void {
  if (isPublicRoute(req.method, req.path)) {
    next();
    return;
  }

  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    res.status(401).json({ error: "Missing Authorization bearer token" });
    return;
  }

  // Attach raw token for downstream handlers; full JWT verify lives in auth service.
  (req as Request & { accessToken?: string }).accessToken = token.trim();
  next();
}
