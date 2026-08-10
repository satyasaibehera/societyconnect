import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  Car,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  ClipboardCheck,
  Wrench,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { tenantDb } from "@/services/tenantDb";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useUserRole } from "@/hooks/useUserRole";
import { useCanLoadTenantData } from "@/hooks/useCanLoadTenantData";

const stats = [
  { label: "Total Residents", value: "—", trend: "up" as const, icon: Users },
  { label: "Active Visitors", value: "—", trend: "up" as const, icon: UserCheck },
  { label: "Registered Vehicles", value: "—", trend: "up" as const, icon: Car },
  { label: "Open Complaints", value: "—", trend: "down" as const, icon: MessageSquare },
];

type QuickAction = {
  label: string;
  icon: LucideIcon;
  url: string;
  moduleKey?: string;
  managementOnly?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Review Approvals", icon: ClipboardCheck, url: "/approvals", moduleKey: "approvals" },
  { label: "Add Visitor Pass", icon: UserCheck, url: "/visitors", moduleKey: "visitors" },
  { label: "Register Vehicle", icon: Car, url: "/vehicles", moduleKey: "vehicles" },
  { label: "Send Notice", icon: MessageSquare, url: "/notices", moduleKey: "notices" },
  { label: "Setup Wizard", icon: TrendingUp, url: "/onboarding", managementOnly: true },
  { label: "Emergency Alert", icon: AlertTriangle, url: "/emergency", moduleKey: "emergency" },
];

export function SocietyAdminDashboard() {
  const navigate = useNavigate();
  const { hasAccess } = useAccessControl();
  const { hasRole } = useUserRole();
  const canLoadTenantData = useCanLoadTenantData();
  const [pendingCounts, setPendingCounts] = useState({
    visitors: 0,
    residents: 0,
    helpers: 0,
    vehicles: 0,
    role_requests: 0,
  });
  const [liveStats, setLiveStats] = useState(stats);

  useEffect(() => {
    if (!canLoadTenantData) return;

    const fetchCounts = async () => {
      const [visitors, residents, helpers, vehicles, roleReqs] = await Promise.all([
        tenantDb.from("visitors").select("id", { count: "exact", head: true }).eq("status", "pending"),
        tenantDb.from("residents").select("id", { count: "exact", head: true }).eq("status", "pending"),
        tenantDb.from("helpers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        tenantDb.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        tenantDb.from("role_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setPendingCounts({
        visitors: visitors.count || 0,
        residents: residents.count || 0,
        helpers: helpers.count || 0,
        vehicles: vehicles.count || 0,
        role_requests: roleReqs.count || 0,
      });

      const [totalResidents, totalVisitors, totalVehicles, openComplaints] = await Promise.all([
        tenantDb.from("residents").select("id", { count: "exact", head: true }).eq("status", "approved"),
        tenantDb.from("visitors").select("id", { count: "exact", head: true }).eq("status", "approved"),
        tenantDb.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "approved"),
        tenantDb.from("complaints").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);

      setLiveStats([
        { label: "Total Residents", value: String(totalResidents.count || 0), trend: "up", icon: Users },
        { label: "Active Visitors", value: String(totalVisitors.count || 0), trend: "up", icon: UserCheck },
        { label: "Registered Vehicles", value: String(totalVehicles.count || 0), trend: "up", icon: Car },
        { label: "Open Complaints", value: String(openComplaints.count || 0), trend: "down", icon: MessageSquare },
      ]);
    };

    void fetchCounts();
  }, [canLoadTenantData]);

  if (!canLoadTenantData) {
    return null;
  }

  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0);

  const approvalItems = [
    { label: "Visitor Requests", count: pendingCounts.visitors, icon: UserCheck, color: "text-primary" },
    { label: "Resident Registrations", count: pendingCounts.residents, icon: Users, color: "text-accent" },
    { label: "Helper Registrations", count: pendingCounts.helpers, icon: Wrench, color: "text-warning" },
    { label: "Vehicle Registrations", count: pendingCounts.vehicles, icon: Car, color: "text-success" },
    { label: "Role Requests", count: pendingCounts.role_requests, icon: Shield, color: "text-destructive" },
  ];

  const visibleQuickActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) => {
        if (action.managementOnly) {
          return hasRole("super_admin", "admin");
        }
        if (action.moduleKey) {
          return hasAccess(action.moduleKey);
        }
        return true;
      }),
    [hasAccess, hasRole],
  );

  return (
    <div className="space-y-6">
      {totalPending > 0 && (
        <Card className="p-4 border-primary/20 bg-primary/5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display font-semibold">
                  {totalPending} Pending Approval{totalPending > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {approvalItems
                    .filter((a) => a.count > 0)
                    .map((a) => `${a.count} ${a.label.toLowerCase()}`)
                    .join(", ")}
                </p>
              </div>
            </div>
            {hasAccess("approvals") && (
              <Button
                onClick={() => navigate("/approvals")}
                className="gradient-primary text-primary-foreground"
                size="sm"
              >
                Review All
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {liveStats.map((stat) => (
          <Card key={stat.label} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold font-display mt-1">{stat.value}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Pending Approvals</h2>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {approvalItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className={`text-sm font-bold ${item.count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
          {totalPending > 0 && hasAccess("approvals") && (
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/approvals")}>
              View All Approvals
            </Button>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display font-semibold mb-4">Quick Actions</h2>
          {visibleQuickActions.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {visibleQuickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.url)}
                  className="flex items-center gap-3 rounded-lg p-3 text-sm text-left hover:bg-secondary transition-colors"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <action.icon className="h-4 w-4 text-primary" />
                  </div>
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No quick actions available for your role.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
