import { DashboardLayout } from "@/components/DashboardLayout";
import { SocietyAdminDashboard } from "@/components/dashboard/SocietyAdminDashboard";
import { ResidentDashboard } from "@/components/dashboard/ResidentDashboard";
import { PlatformOverviewWidget } from "@/components/dashboard/PlatformOverviewWidget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { resolveDashboardViews } from "@/lib/dashboardRoles";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useCanLoadTenantData,
  useEffectiveDashboardRole,
} from "@/hooks/useCanLoadTenantData";
import { Building2, Info, Loader2 } from "lucide-react";

const Dashboard = () => {
  const { tenantRole, roleLoading, loading } = useAuth();
  const { hasRole } = useUserRole();
  const views = resolveDashboardViews(tenantRole);
  const canLoadTenantData = useCanLoadTenantData();
  const effectiveRole = useEffectiveDashboardRole();
  const isSuperAdmin = hasRole("super_admin");

  if (loading || roleLoading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const showPlatformOverview = isSuperAdmin || views.showPlatformOverview;
  const showTenantPrompt = isSuperAdmin && !canLoadTenantData;

  const showResidentDashboard = canLoadTenantData && (
    isSuperAdmin
      ? effectiveRole === "resident"
      : views.showResidentDashboard
  );

  const showAdminDashboard = canLoadTenantData && (
    isSuperAdmin
      ? effectiveRole !== "resident"
      : views.showAdminDashboard
  );

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {showTenantPrompt && (
          <Alert className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4" />
            <AlertTitle>Platform admin view</AlertTitle>
            <AlertDescription className="flex items-start gap-2">
              <Building2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span>
                Select a society from your profile menu to view resident and operational
                data. Platform metrics below reflect global system status only.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {showPlatformOverview && <PlatformOverviewWidget />}
        {showAdminDashboard && <SocietyAdminDashboard />}
        {showResidentDashboard && <ResidentDashboard />}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
