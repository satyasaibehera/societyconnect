import type { AppRole } from "@/types/auth";

const ROUTER_ROLE_MAP: Record<string, AppRole> = {
  SUPER_ADMIN: "super_admin",
  PLATFORM_SUPER_ADMIN: "super_admin",
  SOCIETY_ADMIN: "admin",
  ADMIN: "admin",
  OFFICE_BEARER: "office_bearer",
  RESIDENT: "resident",
  OWNER: "resident",
  TENANT: "resident",
  FAMILY: "resident",
  SECURITY: "security",
  STAFF: "staff",
  HELPER: "staff",
  MAID: "staff",
  DRIVER: "staff",
  VENDOR: "staff",
  MAINTENANCE: "staff",
};

const DISPLAY_ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Platform Super Admin",
  admin: "Society Admin",
  office_bearer: "Office Bearer",
  resident: "Resident",
  security: "Security Guard",
  staff: "Staff",
};

/** Default platform admin context role on mount. */
export const DEFAULT_ADMIN_CONTEXT_ROLE: AppRole = "super_admin";

/** Ordered roles shown in the platform admin context role selector. */
export const ADMIN_CONTEXT_ROLES: readonly AppRole[] = [
  "super_admin",
  "admin",
  "office_bearer",
  "resident",
  "security",
] as const;

/** Society-scoped roles that require a target society selection. */
export const SOCIETY_SCOPED_APP_ROLES: readonly AppRole[] = [
  "admin",
  "office_bearer",
  "resident",
  "security",
] as const;

export type AdminContextRoleOption = {
  value: AppRole;
  label: string;
};

/** Build primary role dropdown options from the central AppRole taxonomy. */
export function getAdminContextRoleOptions(): AdminContextRoleOption[] {
  return ADMIN_CONTEXT_ROLES.map((role) => ({
    value: role,
    label: mapToDisplayRole(role),
  }));
}

export function isPlatformAdminContextRole(role: AppRole): boolean {
  return role === DEFAULT_ADMIN_CONTEXT_ROLE;
}

export function isSocietyScopedAppRole(role: AppRole): boolean {
  return (SOCIETY_SCOPED_APP_ROLES as readonly string[]).includes(role);
}


const RESIDENT_SUB_ROLE_KEYS = new Set(["OWNER", "TENANT", "FAMILY"]);
const STAFF_SUB_ROLE_KEYS = new Set([
  "STAFF",
  "HELPER",
  "MAID",
  "DRIVER",
  "VENDOR",
  "MAINTENANCE",
]);

function normalizeRouterRole(role: string | null | undefined): string {
  return role?.trim().toUpperCase() ?? "";
}

/** Map tenant-router role string to internal AppRole values. */
export function mapRouterRole(role: string | null | undefined): AppRole[] {
  if (!role) return [];
  const mapped = ROUTER_ROLE_MAP[normalizeRouterRole(role)];
  return mapped ? [mapped] : [];
}

/** Human-readable label for a normalized AppRole. */
export function mapToDisplayRole(role: AppRole): string {
  return DISPLAY_ROLE_LABELS[role];
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeRouterRole(role);
  return normalized === "SUPER_ADMIN" || normalized === "PLATFORM_SUPER_ADMIN";
}

export function isPendingApprovalStatus(status: string | null | undefined): boolean {
  return status?.trim().toUpperCase() === "PENDING_APPROVAL";
}

export function isApprovedStatus(status: string | null | undefined): boolean {
  const normalized = status?.trim().toUpperCase();
  return normalized === "APPROVED" || normalized === "ACTIVE";
}

/** Resident sub-types returned as router roles (owner / tenant / family). */
export function residentSubRoles(role: string | null | undefined): string[] {
  const normalized = normalizeRouterRole(role);
  if (RESIDENT_SUB_ROLE_KEYS.has(normalized)) {
    return [normalized.toLowerCase()];
  }
  return [];
}

/** Staff sub-types returned as router roles (helper / maid / driver / etc.). */
export function staffSubRoles(role: string | null | undefined): string[] {
  const normalized = normalizeRouterRole(role);
  if (STAFF_SUB_ROLE_KEYS.has(normalized)) {
    return [normalized.toLowerCase()];
  }
  return [];
}

export { ROUTER_ROLE_MAP };
