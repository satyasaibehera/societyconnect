/**
 * Central role taxonomy for UI and admin context switching.
 * Source of truth lives in `@/utils/roleMapping`.
 */
export type { AppRole } from "@/types/auth";
export type { AdminContextRoleOption } from "@/utils/roleMapping";
export {
  ADMIN_CONTEXT_ROLES,
  DEFAULT_ADMIN_CONTEXT_ROLE,
  SOCIETY_SCOPED_APP_ROLES,
  getAdminContextRoleOptions,
  isPlatformAdminContextRole,
  isSocietyScopedAppRole,
  mapToDisplayRole,
  mapRouterRole,
} from "@/utils/roleMapping";
