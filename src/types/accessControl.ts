import type { AppRole } from "@/types/auth";
import { APP_ROLE } from "@/types/auth";
import { mapToDisplayRole } from "@/utils/roleMapping";

/** Resident sub-roles stored in access_controls.role_key (not AppRole.resident). */
export const RESIDENT_SUB_ROLE = {
  OWNER: "owner",
  TENANT: "tenant",
  FAMILY: "family",
} as const;

export type ResidentSubRole =
  (typeof RESIDENT_SUB_ROLE)[keyof typeof RESIDENT_SUB_ROLE];

/** Role keys used by the access_controls matrix (DB + UI). */
export const ACCESS_CONTROL_ROLE = {
  SUPER_ADMIN: APP_ROLE.SUPER_ADMIN,
  ADMIN: APP_ROLE.ADMIN,
  OFFICE_BEARER: APP_ROLE.OFFICE_BEARER,
  OWNER: RESIDENT_SUB_ROLE.OWNER,
  TENANT: RESIDENT_SUB_ROLE.TENANT,
  FAMILY: RESIDENT_SUB_ROLE.FAMILY,
  SECURITY: APP_ROLE.SECURITY,
} as const;

export type AccessControlRoleKey =
  (typeof ACCESS_CONTROL_ROLE)[keyof typeof ACCESS_CONTROL_ROLE];

const RESIDENT_SUB_ROLE_LABELS: Record<ResidentSubRole, string> = {
  [RESIDENT_SUB_ROLE.OWNER]: "House Owner",
  [RESIDENT_SUB_ROLE.TENANT]: "Tenant",
  [RESIDENT_SUB_ROLE.FAMILY]: "Family Member",
};

export function getAccessControlRoleLabel(roleKey: AccessControlRoleKey): string {
  if (roleKey in RESIDENT_SUB_ROLE_LABELS) {
    return RESIDENT_SUB_ROLE_LABELS[roleKey as ResidentSubRole];
  }
  return mapToDisplayRole(roleKey as AppRole);
}

export const ACCESS_CONTROL_ROLE_COLUMNS: ReadonlyArray<{
  key: AccessControlRoleKey;
  label: string;
}> = [
  {
    key: ACCESS_CONTROL_ROLE.SUPER_ADMIN,
    label: getAccessControlRoleLabel(ACCESS_CONTROL_ROLE.SUPER_ADMIN),
  },
  {
    key: ACCESS_CONTROL_ROLE.ADMIN,
    label: getAccessControlRoleLabel(ACCESS_CONTROL_ROLE.ADMIN),
  },
  {
    key: ACCESS_CONTROL_ROLE.OFFICE_BEARER,
    label: getAccessControlRoleLabel(ACCESS_CONTROL_ROLE.OFFICE_BEARER),
  },
  {
    key: ACCESS_CONTROL_ROLE.OWNER,
    label: getAccessControlRoleLabel(ACCESS_CONTROL_ROLE.OWNER),
  },
  {
    key: ACCESS_CONTROL_ROLE.TENANT,
    label: getAccessControlRoleLabel(ACCESS_CONTROL_ROLE.TENANT),
  },
  {
    key: ACCESS_CONTROL_ROLE.FAMILY,
    label: getAccessControlRoleLabel(ACCESS_CONTROL_ROLE.FAMILY),
  },
  {
    key: ACCESS_CONTROL_ROLE.SECURITY,
    label: getAccessControlRoleLabel(ACCESS_CONTROL_ROLE.SECURITY),
  },
];
