import { APP_ROLE, type AppRole } from "@/types/auth";

/** Uppercase tenant-router role keys (canonical router vocabulary). */
export const ROUTER_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  PLATFORM_SUPER_ADMIN: "PLATFORM_SUPER_ADMIN",
  SOCIETY_ADMIN: "SOCIETY_ADMIN",
  ADMIN: "ADMIN",
  OFFICE_BEARER: "OFFICE_BEARER",
  RESIDENT: "RESIDENT",
  OWNER: "OWNER",
  TENANT: "TENANT",
  FAMILY: "FAMILY",
  SECURITY: "SECURITY",
  STAFF: "STAFF",
  HELPER: "HELPER",
  MAID: "MAID",
  DRIVER: "DRIVER",
  VENDOR: "VENDOR",
  MAINTENANCE: "MAINTENANCE",
} as const;

const ROUTER_ROLE_MAP: Record<string, AppRole> = {
  [ROUTER_ROLE.SUPER_ADMIN]: APP_ROLE.SUPER_ADMIN,
  [ROUTER_ROLE.PLATFORM_SUPER_ADMIN]: APP_ROLE.SUPER_ADMIN,
  [ROUTER_ROLE.SOCIETY_ADMIN]: APP_ROLE.ADMIN,
  [ROUTER_ROLE.ADMIN]: APP_ROLE.ADMIN,
  [ROUTER_ROLE.OFFICE_BEARER]: APP_ROLE.OFFICE_BEARER,
  [ROUTER_ROLE.RESIDENT]: APP_ROLE.RESIDENT,
  [ROUTER_ROLE.OWNER]: APP_ROLE.RESIDENT,
  [ROUTER_ROLE.TENANT]: APP_ROLE.RESIDENT,
  [ROUTER_ROLE.FAMILY]: APP_ROLE.RESIDENT,
  [ROUTER_ROLE.SECURITY]: APP_ROLE.SECURITY,
  [ROUTER_ROLE.STAFF]: APP_ROLE.STAFF,
  [ROUTER_ROLE.HELPER]: APP_ROLE.STAFF,
  [ROUTER_ROLE.MAID]: APP_ROLE.STAFF,
  [ROUTER_ROLE.DRIVER]: APP_ROLE.STAFF,
  [ROUTER_ROLE.VENDOR]: APP_ROLE.STAFF,
  [ROUTER_ROLE.MAINTENANCE]: APP_ROLE.STAFF,
};

const DISPLAY_ROLE_LABELS: Record<AppRole, string> = {
  [APP_ROLE.SUPER_ADMIN]: "Platform Super Admin",
  [APP_ROLE.ADMIN]: "Society Admin",
  [APP_ROLE.OFFICE_BEARER]: "Office Bearer",
  [APP_ROLE.RESIDENT]: "Resident",
  [APP_ROLE.SECURITY]: "Security Guard",
  [APP_ROLE.STAFF]: "Staff",
};

/** Default platform admin context role on mount. */
export const DEFAULT_ADMIN_CONTEXT_ROLE: AppRole = APP_ROLE.SUPER_ADMIN;

/** Ordered roles shown in the platform admin context role selector. */
export const ADMIN_CONTEXT_ROLES: readonly AppRole[] = [
  APP_ROLE.SUPER_ADMIN,
  APP_ROLE.ADMIN,
  APP_ROLE.OFFICE_BEARER,
  APP_ROLE.RESIDENT,
  APP_ROLE.SECURITY,
] as const;

/** Society-scoped roles that require a target society selection. */
export const SOCIETY_SCOPED_APP_ROLES: readonly AppRole[] = [
  APP_ROLE.ADMIN,
  APP_ROLE.OFFICE_BEARER,
  APP_ROLE.RESIDENT,
  APP_ROLE.SECURITY,
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

const RESIDENT_SUB_ROLE_KEYS = new Set<string>([
  ROUTER_ROLE.OWNER,
  ROUTER_ROLE.TENANT,
  ROUTER_ROLE.FAMILY,
]);

const STAFF_SUB_ROLE_KEYS = new Set<string>([
  ROUTER_ROLE.STAFF,
  ROUTER_ROLE.HELPER,
  ROUTER_ROLE.MAID,
  ROUTER_ROLE.DRIVER,
  ROUTER_ROLE.VENDOR,
  ROUTER_ROLE.MAINTENANCE,
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
  return (
    normalized === ROUTER_ROLE.SUPER_ADMIN ||
    normalized === ROUTER_ROLE.PLATFORM_SUPER_ADMIN
  );
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
