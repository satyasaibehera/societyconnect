/**
 * Central application identity — branding, tenant routing, and access isolation.
 */
export const APP_CONFIG = {
  appName: import.meta.env.VITE_APP_NAME || "Society Connect",
  appId: import.meta.env.VITE_APP_ID || "society_connect",
  routerBaseUrl:
    import.meta.env.VITE_TENANT_ROUTER_URL ||
    import.meta.env.VITE_ROUTER_API_URL ||
    "https://universal-tenant-router.netlify.app",
  superAdminEmail: (
    import.meta.env.VITE_SUPER_ADMIN_EMAIL || "superadmin@societyconnect.com"
  )
    .trim()
    .toLowerCase(),
} as const;

/** Realtime channel schema (matches VITE_APP_ID by convention). */
export const APP_SCHEMA = APP_CONFIG.appId;
