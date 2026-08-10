import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isPublicAuthPath } from "@/lib/authRoutes";
import {
  isApprovedStatus,
  isPendingApprovalStatus,
} from "@/config/roleMapping";

/**
 * Enforces post-auth navigation based on tenant-router role resolution.
 * - PENDING_APPROVAL → /awaiting-approval
 * - Approved roles → main application (dashboard)
 */
export function AuthRouteGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, roleLoading, tenantRole, authErrorCode, isAuthenticated } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  if (loading || (isAuthenticated && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (authErrorCode === "ROLE_RESOLUTION_FAILED") {
    return null;
  }

  if (!isAuthenticated) {
    if (isPublicAuthPath(pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/login" replace state={{ from: pathname }} />;
  }

  if (!tenantRole) {
    if (isPublicAuthPath(pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/login" replace state={{ from: pathname }} />;
  }

  const { status } = tenantRole;

  if (isPendingApprovalStatus(status)) {
    if (pathname !== "/awaiting-approval") {
      return <Navigate to="/awaiting-approval" replace />;
    }
    return <>{children}</>;
  }

  if (isApprovedStatus(status)) {
    if (
      pathname === "/login" ||
      pathname === "/awaiting-approval" ||
      pathname === "/platform-admin"
    ) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
