import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  isApprovedStatus,
  isPendingApprovalStatus,
  isSuperAdminRole,
} from "@/lib/roleMapping";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/reset-password"]);

/**
 * Enforces post-auth navigation based on tenant-router role resolution.
 * - SUPER_ADMIN → /platform-admin
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
    if (PUBLIC_PATHS.has(pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/login" replace state={{ from: pathname }} />;
  }

  if (!tenantRole) {
    if (PUBLIC_PATHS.has(pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/login" replace state={{ from: pathname }} />;
  }

  const { role, status } = tenantRole;

  if (isSuperAdminRole(role)) {
    if (pathname !== "/platform-admin") {
      return <Navigate to="/platform-admin" replace />;
    }
    return <>{children}</>;
  }

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
