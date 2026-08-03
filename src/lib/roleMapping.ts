import { APP_CONFIG } from "@/config/appConfig";

export type AppRole = "super_admin" | "admin" | "office_bearer" | "resident" | "security";

const ROUTER_ROLE_MAP: Record<string, AppRole> = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SOCIETY_ADMIN: "admin",
  OFFICE_BEARER: "office_bearer",
  RESIDENT: "resident",
  SECURITY: "security",
  OWNER: "resident",
  TENANT: "resident",
  FAMILY: "resident",
};

/** Map tenant-router role string to internal AppRole values. */
export function mapRouterRole(role: string | null | undefined): AppRole[] {
  if (!role) return [];
  const mapped = ROUTER_ROLE_MAP[role.trim().toUpperCase()];
  return mapped ? [mapped] : [];
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role?.trim().toUpperCase() === "SUPER_ADMIN";
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
  const normalized = role?.trim().toUpperCase();
  if (normalized === "OWNER" || normalized === "TENANT" || normalized === "FAMILY") {
    return [normalized.toLowerCase()];
  }
  return [];
}
