import type { TenantUserRole } from "@/services/tenantRouterService";
import { APP_ROLE } from "@/types/auth";
import { mapRouterRole, ROUTER_ROLE } from "@/utils/roleMapping";

function normalizeRole(role: string | null | undefined): string {
  return role?.trim().toUpperCase() ?? "";
}

const SOCIETY_ADMIN_DASHBOARD_ROUTER_ROLES = new Set<string>([
  ROUTER_ROLE.SUPER_ADMIN,
  ROUTER_ROLE.SOCIETY_ADMIN,
  ROUTER_ROLE.ADMIN,
  ROUTER_ROLE.OFFICE_BEARER,
  ROUTER_ROLE.SECURITY,
]);

const RESIDENT_DASHBOARD_ROUTER_ROLES = new Set<string>([
  ROUTER_ROLE.RESIDENT,
  ROUTER_ROLE.TENANT,
  ROUTER_ROLE.OWNER,
  ROUTER_ROLE.FAMILY,
]);

export function isPlatformOverviewRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROUTER_ROLE.PLATFORM_SUPER_ADMIN;
}

export function isSocietyAdminDashboardRole(role: string | null | undefined): boolean {
  return SOCIETY_ADMIN_DASHBOARD_ROUTER_ROLES.has(normalizeRole(role));
}

export function isResidentDashboardRole(role: string | null | undefined): boolean {
  return RESIDENT_DASHBOARD_ROUTER_ROLES.has(normalizeRole(role));
}

export function resolveDashboardViews(tenantRole: TenantUserRole | null): {
  showPlatformOverview: boolean;
  showAdminDashboard: boolean;
  showResidentDashboard: boolean;
} {
  const role = tenantRole?.role;

  if (isPlatformOverviewRole(role)) {
    return {
      showPlatformOverview: true,
      showAdminDashboard: true,
      showResidentDashboard: false,
    };
  }

  if (isSocietyAdminDashboardRole(role)) {
    return {
      showPlatformOverview: false,
      showAdminDashboard: true,
      showResidentDashboard: false,
    };
  }

  if (isResidentDashboardRole(role)) {
    return {
      showPlatformOverview: false,
      showAdminDashboard: false,
      showResidentDashboard: true,
    };
  }

  const appRoles = mapRouterRole(role);
  if (appRoles.includes(APP_ROLE.RESIDENT)) {
    return {
      showPlatformOverview: false,
      showAdminDashboard: false,
      showResidentDashboard: true,
    };
  }

  return {
    showPlatformOverview: false,
    showAdminDashboard: true,
    showResidentDashboard: false,
  };
}
