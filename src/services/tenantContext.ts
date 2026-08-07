/** Resolved tenant Neon schema/database name from AuthContext (set after login). */
let tenantDbName: string | null = null;

/** Cached Supabase access token for authenticated API calls. */
let sessionAccessToken: string | null = null;

export function setTenantDbName(name: string | null): void {
  tenantDbName = name?.trim() || null;
}

export function getTenantDbName(): string | null {
  return tenantDbName;
}

export function setSessionAccessToken(token: string | null): void {
  sessionAccessToken = token?.trim() || null;
}

export function getSessionAccessToken(): string | null {
  return sessionAccessToken;
}

/** True when a non-empty bearer token is available for protected tenant APIs. */
export function hasAuthenticatedSession(): boolean {
  return Boolean(sessionAccessToken?.trim());
}

export function clearTenantContext(): void {
  tenantDbName = null;
  sessionAccessToken = null;
}
