/** @deprecated Import from `@/utils/roleMapping` and `@/types/auth` instead. */
export type { AppRole } from "@/types/auth";
export {
  mapRouterRole,
  mapToDisplayRole,
  isSuperAdminRole,
  isPendingApprovalStatus,
  isApprovedStatus,
  residentSubRoles,
  staffSubRoles,
  ROUTER_ROLE_MAP,
} from "@/utils/roleMapping";
