/**
 * Central application identity — drives schema selection, branding, and access isolation.
 */
export const APP_CONFIG = {
  appName: import.meta.env.VITE_APP_NAME || "Society Connect",
  appId: import.meta.env.VITE_APP_ID || "society_connect",
  superAdminEmail: (
    import.meta.env.VITE_SUPER_ADMIN_EMAIL || "superadmin@societyconnect.com"
  )
    .trim()
    .toLowerCase(),
} as const;

/** PostgREST / Supabase schema name (matches VITE_APP_ID by convention). */
export const APP_SCHEMA = APP_CONFIG.appId;
