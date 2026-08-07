/**
 * Universal Tenant Router base URL.
 * Supports Next-style (NEXT_PUBLIC_*) and Vite (VITE_*) env names.
 */
export function getTenantRouterUrl(): string {
  const explicit =
    import.meta.env.NEXT_PUBLIC_TENANT_ROUTER_URL ||
    import.meta.env.VITE_TENANT_ROUTER_URL ||
    import.meta.env.VITE_ROUTER_API_URL;

  if (explicit?.trim()) {
    return explicit.trim().replace(/\/$/, "");
  }

  const supabaseFallback =
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;

  if (supabaseFallback?.trim()) {
    return supabaseFallback.trim().replace(/\/$/, "");
  }

  return "https://universal-tenant-router.netlify.app";
}
