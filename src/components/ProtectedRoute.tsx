import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  isApprovedStatus,
  isPendingApprovalStatus,
  isSuperAdminRole,
} from "@/lib/roleMapping";

/**
 * Requires an authenticated session with an approved tenant role.
 * Role/status routing is enforced globally by AuthRouteGuard.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, roleLoading, tenantRole } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!tenantRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isSuperAdminRole(tenantRole.role)) {
    return <Navigate to="/platform-admin" replace />;
  }

  if (isPendingApprovalStatus(tenantRole.status)) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (!isApprovedStatus(tenantRole.status)) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  return <>{children}</>;
}

/**
 * Requires a session but allows any resolved role (pending, super admin, approved).
 */
export function SessionRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, roleLoading } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
