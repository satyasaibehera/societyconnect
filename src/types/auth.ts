/** Normalized application roles derived from tenant-router role strings. */
export const APP_ROLE = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  OFFICE_BEARER: "office_bearer",
  RESIDENT: "resident",
  SECURITY: "security",
  STAFF: "staff",
} as const;

export type AppRole = (typeof APP_ROLE)[keyof typeof APP_ROLE];
