import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Activity,
  UserPlus,
  Shield,
  FileText,
  Loader2,
} from "lucide-react";
import { APP_CONFIG } from "@/config/appConfig";
import { tenantDb } from "@/services/tenantDb";
import { useCanLoadTenantData } from "@/hooks/useCanLoadTenantData";
import { format } from "date-fns";

interface RecentEnrollment {
  id: string;
  requested_role: string;
  status: string;
  created_at: string;
}

export function PlatformOverviewWidget() {
  const navigate = useNavigate();
  const canLoadTenantData = useCanLoadTenantData();
  const [loading, setLoading] = useState(true);
  const [activeSocieties, setActiveSocieties] = useState(0);
  const [systemUsers, setSystemUsers] = useState(0);
  const [platformStatus, setPlatformStatus] = useState<"operational" | "degraded" | "offline">(
    "offline",
  );
  const [recentEnrollments, setRecentEnrollments] = useState<RecentEnrollment[]>([]);

  useEffect(() => {
    const fetchPlatformMetrics = async () => {
      setLoading(true);

      const routerBase = APP_CONFIG.routerBaseUrl.replace(/\/$/, "");
      let status: typeof platformStatus = "offline";

      try {
        const healthRes = await fetch(`${routerBase}/health`);
        if (healthRes.ok) {
          status = "operational";
        }
      } catch {
        status = "offline";
      }

      let userCount = 0;
      let enrollments: RecentEnrollment[] = [];

      if (canLoadTenantData) {
        const [residentsResult, enrollmentsResult] = await Promise.all([
          tenantDb.from("residents").select("id", { count: "exact", head: true }).eq("status", "approved"),
          tenantDb
            .from("role_requests")
            .select("id, requested_role, status, created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        userCount = residentsResult.count || 0;
        enrollments = enrollmentsResult.data || [];
      }

      setActiveSocieties(0);
      setSystemUsers(userCount || 0);
      setPlatformStatus(status);
      setRecentEnrollments(enrollments || []);
      setLoading(false);
    };

    void fetchPlatformMetrics();
  }, [canLoadTenantData]);

  const statusLabel = {
    operational: "Operational",
    degraded: "Degraded",
    offline: "Offline",
  }[platformStatus];

  const statusVariant =
    platformStatus === "operational"
      ? "default"
      : platformStatus === "degraded"
        ? "secondary"
        : "destructive";

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Societies</p>
              <p className="text-2xl font-bold font-display mt-1">
                {canLoadTenantData ? activeSocieties : "—"}
              </p>
              {!canLoadTenantData && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Select a society-scoped role in profile menu
                </p>
              )}
            </div>
            <Building2 className="h-5 w-5 text-primary" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">System Users</p>
              <p className="text-2xl font-bold font-display mt-1">{systemUsers}</p>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Platform Status</p>
              <Badge variant={statusVariant} className="mt-2">
                {statusLabel}
              </Badge>
            </div>
            <Activity className="h-5 w-5 text-primary" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Recent Enrollments</p>
              <p className="text-2xl font-bold font-display mt-1">{recentEnrollments.length}</p>
            </div>
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display font-semibold mb-4">Recent Enrollments</h2>
          <div className="space-y-3">
            {recentEnrollments.length > 0 ? (
              recentEnrollments.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {entry.requested_role.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {entry.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent enrollment requests.</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display font-semibold mb-4">Platform Actions</h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/dashboard")}
            >
              <Shield className="h-4 w-4" />
              Manage Societies
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/access-control")}
            >
              <FileText className="h-4 w-4" />
              System Audit Logs
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
