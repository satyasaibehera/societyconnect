import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { APP_ROLE, type AppRole } from "@/types/auth";
import {
  mapRouterRole,
  residentSubRoles,
  staffSubRoles,
} from "@/config/roleMapping";

export type { AppRole };

export function useUserRole() {
  const { tenantRole, roleLoading, loading } = useAuth();

  const roles = useMemo(() => {
    if (!tenantRole?.role) return [] as AppRole[];
    return mapRouterRole(tenantRole.role);
  }, [tenantRole?.role]);

  const hasRole = (...check: AppRole[]) => check.some((r) => roles.includes(r));
  const isManagement = hasRole(APP_ROLE.SUPER_ADMIN, APP_ROLE.ADMIN);
  const isSecurity = hasRole(APP_ROLE.SECURITY);
  const isStaff = hasRole(APP_ROLE.STAFF);

  return {
    roles,
    loading: loading || roleLoading,
    hasRole,
    isManagement,
    isSecurity,
    isStaff,
    tenantRole,
  };
}

/** Effective roles for access-control matrix (includes resident sub-types). */
export function useEffectiveRoles(): { roles: string[]; loading: boolean } {
  const { tenantRole, roleLoading, loading } = useAuth();

  const roles = useMemo(() => {
    const effective = mapRouterRole(tenantRole?.role);
    const subRoles = [
      ...residentSubRoles(tenantRole?.role),
      ...staffSubRoles(tenantRole?.role),
    ];
    return [...new Set([...effective, ...subRoles])];
  }, [tenantRole?.role]);

  return { roles, loading: loading || roleLoading };
}
