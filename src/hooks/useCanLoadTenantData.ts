import { useUserRole } from "@/hooks/useUserRole";
import { useAdminContextOptional } from "@/contexts/AdminContext";
import { APP_ROLE } from "@/types/auth";
import type { AppRole } from "@/types/auth";

/** Whether tenant data-plane queries (/api/data/*) should run for the current session. */
export function useCanLoadTenantData(): boolean {
  const { hasRole } = useUserRole();
  const isSuperAdmin = hasRole(APP_ROLE.SUPER_ADMIN);
  const adminContext = useAdminContextOptional();

  if (!isSuperAdmin) return true;

  return Boolean(adminContext?.selectedTenantId);
}

/** Effective impersonated or native role for dashboard widget selection. */
export function useEffectiveDashboardRole(): AppRole | null {
  const { roles, hasRole } = useUserRole();
  const adminContext = useAdminContextOptional();

  if (hasRole(APP_ROLE.SUPER_ADMIN) && adminContext) {
    if (adminContext.contextRole !== APP_ROLE.SUPER_ADMIN) {
      return adminContext.contextRole;
    }
    return APP_ROLE.SUPER_ADMIN;
  }

  return roles[0] ?? null;
}
