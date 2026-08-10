/**
 * Public role taxonomy barrel for UI, guards, and admin context switching.
 * Implementation source of truth: `@/utils/roleMapping`.
 */
export { APP_ROLE, type AppRole } from "@/types/auth";
export type { AdminContextRoleOption } from "@/utils/roleMapping";
export {
  ADMIN_CONTEXT_ROLES,
  DEFAULT_ADMIN_CONTEXT_ROLE,
  ROUTER_ROLE,
  ROUTER_ROLE_MAP,
  SOCIETY_SCOPED_APP_ROLES,
  getAdminContextRoleOptions,
  isApprovedStatus,
  isPendingApprovalStatus,
  isPlatformAdminContextRole,
  isSocietyScopedAppRole,
  isSuperAdminRole,
  mapRouterRole,
  mapToDisplayRole,
  residentSubRoles,
  staffSubRoles,
} from "@/utils/roleMapping";
