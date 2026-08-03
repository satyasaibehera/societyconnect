import { APP_CONFIG } from "@/config/appConfig";

export type TenantUserRole = {
  role: string;
  status: string;
  tenantDbName: string | null;
};

export type ResolveUserRoleResult =
  | { ok: true; data: TenantUserRole }
  | { ok: false; status: number; error: string };

function routerHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "X-App-Id": APP_CONFIG.appId,
  };
}

/**
 * Resolve the authenticated user's role, approval status, and tenant DB via the universal tenant router.
 */
export async function resolveUserRole(accessToken: string): Promise<ResolveUserRoleResult> {
  const url = `${APP_CONFIG.routerBaseUrl.replace(/\/$/, "")}/api/v1/tenant/resolve-user-role`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: routerHeaders(accessToken),
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { error: await response.text() };

    if (response.status === 403) {
      return {
        ok: false,
        status: 403,
        error: payload.error || payload.message || "Access denied",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload.error || payload.message || `Request failed (${response.status})`,
      };
    }

    return {
      ok: true,
      data: {
        role: String(payload.role ?? ""),
        status: String(payload.status ?? ""),
        tenantDbName: payload.tenantDbName ?? payload.tenant_db_name ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Failed to reach tenant router",
    };
  }
}
