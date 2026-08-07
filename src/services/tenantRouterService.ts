import { APP_CONFIG } from "@/config/appConfig";
import { getTenantRouterUrl } from "@/lib/api/tenantRouterUrl";

export const TENANT_MAPPING_NOT_FOUND = "TENANT_MAPPING_NOT_FOUND";
export const INVALID_AUTH_TOKEN = "INVALID_AUTH_TOKEN";

export const LOGIN_BANNER_INVALID_CREDENTIALS =
  "Invalid email or password. Please try again.";
export const LOGIN_BANNER_TENANT_MAPPING =
  "Login successful, but application-specific authorization failed. Your account has not been assigned to a society yet.";

export type TenantUserRole = {
  role: string;
  status: string;
  tenantDbName: string | null;
};

export type TenantRouterErrorData = {
  error?: string;
  message?: string;
  code?: string;
  authProvider?: string;
  [key: string]: unknown;
};

export class TenantRouterError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly errorData: TenantRouterErrorData;

  constructor(status: number, errorData: TenantRouterErrorData) {
    const code = resolveErrorCodeFromData(errorData);
    const message =
      (typeof errorData.message === "string" && errorData.message) ||
      (typeof errorData.error === "string" && errorData.error) ||
      `Tenant router request failed (${status})`;

    super(message);
    this.name = "TenantRouterError";
    this.status = status;
    this.code = code;
    this.errorData = errorData;
  }
}

function routerHeaders(accessToken: string): HeadersInit {
  const token = accessToken.trim();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-App-Id": APP_CONFIG.appId,
  };
}

function parseJsonPayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  if (typeof payload === "string" && payload.trim()) {
    return { error: payload };
  }
  return { error: "Unknown error" };
}

function toErrorData(payload: unknown): TenantRouterErrorData {
  const parsed = parseJsonPayload(payload);
  return {
    ...parsed,
    error: typeof parsed.error === "string" ? parsed.error : undefined,
    message: typeof parsed.message === "string" ? parsed.message : undefined,
    code: typeof parsed.code === "string" ? parsed.code : undefined,
    authProvider: typeof parsed.authProvider === "string" ? parsed.authProvider : undefined,
  };
}

function resolveErrorCodeFromData(errorData: TenantRouterErrorData): string | undefined {
  if (errorData.code === TENANT_MAPPING_NOT_FOUND) return TENANT_MAPPING_NOT_FOUND;
  if (errorData.error === TENANT_MAPPING_NOT_FOUND) return TENANT_MAPPING_NOT_FOUND;
  if (errorData.code === INVALID_AUTH_TOKEN) return INVALID_AUTH_TOKEN;
  if (errorData.error === INVALID_AUTH_TOKEN) return INVALID_AUTH_TOKEN;
  return errorData.code ?? (typeof errorData.error === "string" ? errorData.error : undefined);
}

function resolveErrorCode(errorData: TenantRouterErrorData): string | undefined {
  return resolveErrorCodeFromData(errorData);
}

function authProviderLabel(errorData: TenantRouterErrorData): string {
  return typeof errorData.authProvider === "string" && errorData.authProvider.trim()
    ? errorData.authProvider
    : "Identity Provider";
}

function throwForErrorResponse(status: number, errorData: TenantRouterErrorData): never {
  const code = resolveErrorCode(errorData);

  if (status === 403 && code === TENANT_MAPPING_NOT_FOUND) {
    console.info(
      `[AuthContext] ✅ Primary Authentication Successful via ${authProviderLabel(errorData)}!`,
    );
    console.error(
      "[TenantRouterService] ❌ Application-Specific Authorization Failed: User lacks a tenant role mapping in NeonDB.",
    );
    throw new TenantRouterError(status, {
      ...errorData,
      code: TENANT_MAPPING_NOT_FOUND,
    });
  }

  if (status === 401) {
    throw new TenantRouterError(status, {
      ...errorData,
      code: code === INVALID_AUTH_TOKEN ? INVALID_AUTH_TOKEN : code ?? INVALID_AUTH_TOKEN,
    });
  }

  if (status === 500) {
    console.error(
      "[TenantRouterService] Server error (500):",
      errorData.message || errorData.error || errorData,
    );
    throw new TenantRouterError(status, errorData);
  }

  if (status === 403) {
    console.error(
      "[TenantRouterService] Access denied (403):",
      errorData.message || errorData.error || errorData,
    );
    throw new TenantRouterError(status, errorData);
  }

  console.error(
    `[TenantRouterService] Request failed (${status}):`,
    errorData.message || errorData.error || errorData,
  );
  throw new TenantRouterError(status, errorData);
}

/**
 * Resolve the authenticated user's role, approval status, and tenant DB via the universal tenant router.
 * Throws {@link TenantRouterError} when the router returns a non-200 response.
 */
export async function resolveUserRole(accessToken: string): Promise<TenantUserRole> {
  const token = accessToken?.trim();
  if (!token) {
    throw new TenantRouterError(401, {
      code: INVALID_AUTH_TOKEN,
      message: "Missing access token for role resolution.",
      error: INVALID_AUTH_TOKEN,
    });
  }

  const url = `${getTenantRouterUrl()}/api/v1/tenant/resolve-user-role`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: routerHeaders(token),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach tenant router";
    console.error("[TenantRouterService] Network error:", message);
    throw new TenantRouterError(0, { message, error: message });
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    throwForErrorResponse(response.status, toErrorData(payload));
  }

  const success = parseJsonPayload(payload);

  return {
    role: String(success.role ?? ""),
    status: String(success.status ?? ""),
    tenantDbName:
      (success.tenantDbName as string | null | undefined) ??
      (success.tenant_db_name as string | null | undefined) ??
      null,
  };
}
