import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  mapRouterRole,
  residentSubRoles,
  staffSubRoles,
} from "@/utils/roleMapping";
import type { AppRole } from "@/types/auth";

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
  const isStaff = hasRole("staff");

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
