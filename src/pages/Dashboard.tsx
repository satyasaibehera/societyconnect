import { DashboardLayout } from "@/components/DashboardLayout";
import { SocietyAdminDashboard } from "@/components/dashboard/SocietyAdminDashboard";
import { ResidentDashboard } from "@/components/dashboard/ResidentDashboard";
import { PlatformOverviewWidget } from "@/components/dashboard/PlatformOverviewWidget";
import { useAuth } from "@/contexts/AuthContext";
import { resolveDashboardViews } from "@/lib/dashboardRoles";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { tenantRole, roleLoading, loading } = useAuth();
  const views = resolveDashboardViews(tenantRole);

  if (loading || roleLoading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {views.showPlatformOverview && <PlatformOverviewWidget />}
        {views.showAdminDashboard && <SocietyAdminDashboard />}
        {views.showResidentDashboard && <ResidentDashboard />}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
