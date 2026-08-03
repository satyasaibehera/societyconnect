import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mapRouterRole, residentSubRoles, type AppRole } from "@/lib/roleMapping";

export type { AppRole };

export function useUserRole() {
  const { tenantRole, roleLoading, loading } = useAuth();

  const roles = useMemo(() => {
    if (!tenantRole?.role) return [] as AppRole[];
    return mapRouterRole(tenantRole.role);
  }, [tenantRole?.role]);

  const hasRole = (...check: AppRole[]) => check.some((r) => roles.includes(r));
  const isManagement = hasRole("super_admin", "admin");
  const isSecurity = hasRole("security");

  return {
    roles,
    loading: loading || roleLoading,
    hasRole,
    isManagement,
    isSecurity,
    tenantRole,
  };
}

/** Effective roles for access-control matrix (includes resident sub-types). */
export function useEffectiveRoles(): { roles: string[]; loading: boolean } {
  const { tenantRole, roleLoading, loading } = useAuth();

  const roles = useMemo(() => {
    const effective = mapRouterRole(tenantRole?.role);
    const subRoles = residentSubRoles(tenantRole?.role);
    return [...new Set([...effective, ...subRoles])];
  }, [tenantRole?.role]);

  return { roles, loading: loading || roleLoading };
}
