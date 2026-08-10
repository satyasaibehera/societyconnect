import { APP_CONFIG } from "@/config/appConfig";
import { supabase } from "@/integrations/supabase/client";
import {
  getSessionAccessToken,
  getTenantDbName,
  setSessionAccessToken,
} from "@/services/tenantContext";
import { getAdminContextHeaders } from "@/services/adminContextStore";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export type ApiError = { message: string; status?: number };

export type ApiResult<T> = {
  data: T | null;
  error: ApiError | null;
  count?: number | null;
};

async function getAccessToken(): Promise<string | null> {
  const cached = getSessionAccessToken();
  if (cached) return cached;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim() ?? null;
  if (token) {
    setSessionAccessToken(token);
  }
  return token;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) {
    return { data: null, error: { message: "Not authenticated", status: 401 } };
  }

  const tenantDb = getTenantDbName() || APP_CONFIG.appId;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Tenant-Db", tenantDb);

  const adminContext = getAdminContextHeaders();
  if (adminContext.tenantId) {
    headers.set("X-Tenant-ID", adminContext.tenantId);
  }
  if (adminContext.impersonateRole) {
    headers.set("X-Impersonate-Role", adminContext.impersonateRole);
  }
  if (adminContext.userId) {
    headers.set("X-Impersonate-User-Id", adminContext.userId);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const response = await fetch(url, { ...init, headers });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { error: await response.text() };

    if (!response.ok) {
      return {
        data: null,
        error: {
          message:
            (payload as { error?: string }).error ||
            (payload as { message?: string }).message ||
            `Request failed (${response.status})`,
          status: response.status,
        },
      };
    }

    if (payload && typeof payload === "object" && "count" in payload && payload.data === null) {
      return {
        data: null,
        count: Number((payload as { count: number }).count),
        error: null,
      };
    }

    return {
      data: ((payload as { data?: T }).data ?? payload) as T,
      error: null,
      count: (payload as { count?: number }).count ?? null,
    };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : "Network error" },
    };
  }
}
