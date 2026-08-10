import { useUserRole } from "@/hooks/useUserRole";
import { useAdminContextOptional } from "@/contexts/AdminContext";
import type { AppRole } from "@/types/auth";

/** Whether tenant data-plane queries (/api/data/*) should run for the current session. */
export function useCanLoadTenantData(): boolean {
  const { hasRole } = useUserRole();
  const isSuperAdmin = hasRole("super_admin");
  const adminContext = useAdminContextOptional();

  if (!isSuperAdmin) return true;

  return Boolean(adminContext?.selectedTenantId);
}

/** Effective impersonated or native role for dashboard widget selection. */
export function useEffectiveDashboardRole(): AppRole | null {
  const { roles, hasRole } = useUserRole();
  const adminContext = useAdminContextOptional();

  if (hasRole("super_admin") && adminContext) {
    if (adminContext.contextRole !== "super_admin") {
      return adminContext.contextRole;
    }
    return "super_admin";
  }

  return roles[0] ?? null;
}
