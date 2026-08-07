/**
 * Central application identity — branding, tenant routing, and access isolation.
 */
import { getTenantRouterUrl } from "@/lib/api/tenantRouterUrl";

export const APP_CONFIG = {
  appName: import.meta.env.VITE_APP_NAME || "Society Connect",
  appId: import.meta.env.VITE_APP_ID || "society_connect",
  routerBaseUrl: getTenantRouterUrl(),
  superAdminEmail: (
    import.meta.env.VITE_SUPER_ADMIN_EMAIL || "superadmin@societyconnect.com"
  )
    .trim()
    .toLowerCase(),
} as const;

/** Realtime channel schema (matches VITE_APP_ID by convention). */
export const APP_SCHEMA = APP_CONFIG.appId;
