import type { TenantUserRole } from "@/services/tenantRouterService";
import { mapRouterRole } from "@/lib/roleMapping";

function normalizeRole(role: string | null | undefined): string {
  return role?.trim().toUpperCase() ?? "";
}

export function isPlatformOverviewRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "PLATFORM_SUPER_ADMIN";
}

export function isSocietyAdminDashboardRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return [
    "SUPER_ADMIN",
    "SOCIETY_ADMIN",
    "ADMIN",
    "OFFICE_BEARER",
    "SECURITY",
  ].includes(normalized);
}

export function isResidentDashboardRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return ["RESIDENT", "TENANT", "OWNER", "FAMILY"].includes(normalized);
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
  if (appRoles.includes("resident")) {
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
