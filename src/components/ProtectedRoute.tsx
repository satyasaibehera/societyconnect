import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  isApprovedStatus,
  isPendingApprovalStatus,
} from "@/config/roleMapping";
import { verifyAppAccess } from "@/services/appAccessService";
import { AppAccessDenied } from "@/components/AppAccessDenied";

/**
 * Requires an authenticated session with an approved tenant role.
 * Role/status routing is enforced globally by AuthRouteGuard.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, roleLoading, tenantRole, isAuthenticated, authErrorCode } = useAuth();

  if (loading || (isAuthenticated && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const access = verifyAppAccess(user);
  if (!access.allowed) {
    return <AppAccessDenied reason={access.reason} />;
  }

  if (authErrorCode) {
    return null;
  }

  if (!tenantRole) {
    return <Navigate to="/login" replace />;
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
 * Requires a session but allows any resolved role (pending or approved).
 */
export function SessionRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, roleLoading, isAuthenticated, authErrorCode } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const access = verifyAppAccess(user);
  if (!access.allowed) {
    return <AppAccessDenied reason={access.reason} />;
  }

  if (authErrorCode) {
    return null;
  }

  return <>{children}</>;
}
