import { useUserRole } from "@/hooks/useUserRole";
import { canLoadTenantDataForSuperAdmin } from "@/services/adminContextStore";
import { useAdminContextOptional } from "@/contexts/AdminContext";
import type { AppRole } from "@/types/auth";

/** Whether tenant data-plane queries (/api/data/*) should run for the current session. */
export function useCanLoadTenantData(): boolean {
  const { hasRole } = useUserRole();
  const isSuperAdmin = hasRole("super_admin");

  if (!isSuperAdmin) return true;

  // Prefer live React state; fall back to module snapshot for non-React callers.
  const adminContext = useAdminContextOptional();
  if (adminContext) {
    return Boolean(adminContext.selectedTenantId);
  }

  return canLoadTenantDataForSuperAdmin(true);
}

/** Effective impersonated or native role for dashboard widget selection. */
export function useEffectiveDashboardRole(): AppRole | null {
  const { roles, hasRole } = useUserRole();
  const adminContext = useAdminContextOptional();

  if (hasRole("super_admin") && adminContext?.impersonatedRole) {
    return adminContext.impersonatedRole;
  }

  return roles[0] ?? null;
}
