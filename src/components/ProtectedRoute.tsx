import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PendingApproval from "@/pages/PendingApproval";

type ApprovalStatus = "loading" | "approved" | "pending" | "none";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("loading");

  useEffect(() => {
    if (loading) return;
    if (!session?.user) {
      setApprovalStatus("none");
      return;
    }
    checkApproval(session.user.id);
  }, [session, loading]);

  const checkApproval = async (userId: string) => {
    try {
      // 1. Check if user has any role (admin, super_admin, etc.) → approved
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (roles && roles.length > 0) {
        setApprovalStatus("approved");
        return;
      }

      // 2. Check if user has an approved resident record → approved
      const { data: approvedResident } = await supabase
        .from("residents")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .limit(1);

      if (approvedResident && approvedResident.length > 0) {
        setApprovalStatus("approved");
        return;
      }

      // 3. Check if user has any pending registration (resident or role_request)
      const { data: pendingResident } = await supabase
        .from("residents")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .limit(1);

      const { data: pendingRole } = await supabase
        .from("role_requests")
        .select("id")
        .eq("requester_id", userId)
        .eq("status", "pending")
        .limit(1);

      if ((pendingResident && pendingResident.length > 0) || (pendingRole && pendingRole.length > 0)) {
        setApprovalStatus("pending");
        return;
      }

      // 4. No registration found at all — could be legacy user
      setApprovalStatus("approved");
    } catch (err) {
      // Fail closed: if we cannot verify approval, treat the user as pending
      // rather than silently granting access.
      console.error("Approval check failed", err);
      setApprovalStatus("pending");
    }
  };

  if (loading || (session && approvalStatus === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (approvalStatus === "pending") {
    return <PendingApproval />;
  }

  return <>{children}</>;
}
