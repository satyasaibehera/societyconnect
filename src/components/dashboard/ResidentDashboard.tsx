import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Users,
  UserCheck,
  MessageSquare,
  Car,
  AlertTriangle,
  ClipboardList,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminContextOptional } from "@/contexts/AdminContext";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useCanLoadTenantData } from "@/hooks/useCanLoadTenantData";

type QuickAction = {
  label: string;
  icon: LucideIcon;
  url: string;
  moduleKey: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Request Visitor Pass", icon: UserCheck, url: "/my-visitors", moduleKey: "my-visitors" },
  { label: "Raise Complaint", icon: MessageSquare, url: "/complaints", moduleKey: "complaints" },
  { label: "View Vehicles", icon: Car, url: "/my-vehicles", moduleKey: "my-vehicles" },
  { label: "Emergency Alert", icon: AlertTriangle, url: "/emergency", moduleKey: "emergency" },
];

interface FamilyMember {
  id: string;
  full_name: string;
  resident_type: string;
  relationship: string | null;
  status: string;
}

interface Notice {
  id: string;
  title: string;
  notice_type: string;
  created_at: string;
}

interface ActiveVisitor {
  id: string;
  name: string;
  purpose: string | null;
  entry_time: string | null;
  status: string;
}

export function ResidentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const adminContext = useAdminContextOptional();
  const { hasAccess } = useAccessControl();
  const canLoadTenantData = useCanLoadTenantData();
  const effectiveUserId = adminContext?.selectedUserId ?? user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [unitLabel, setUnitLabel] = useState<string | null>(null);
  const [residentType, setResidentType] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [activeVisitors, setActiveVisitors] = useState<ActiveVisitor[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!effectiveUserId || !canLoadTenantData) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let residentQuery = tenantDb
      .from("residents")
      .select("id, unit_id, resident_type, society_id")
      .eq("user_id", effectiveUserId)
      .eq("status", "approved");

    if (adminContext?.selectedTenantId) {
      residentQuery = residentQuery.eq("society_id", adminContext.selectedTenantId);
    }

    const { data: resident } = await residentQuery.limit(1).maybeSingle();

    if (!resident?.unit_id) {
      setLoading(false);
      return;
    }

    setResidentType(resident.resident_type);

    const [{ data: unit }, { data: members }, { data: noticeRows }, { data: visitorRows }] =
      await Promise.all([
        tenantDb.from("units").select("unit_number").eq("id", resident.unit_id).maybeSingle(),
        tenantDb
          .from("residents")
          .select("id, full_name, resident_type, relationship, status")
          .eq("unit_id", resident.unit_id)
          .order("created_at", { ascending: true }),
        tenantDb
          .from("notices")
          .select("id, title, notice_type, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        tenantDb
          .from("visitors")
          .select("id, name, purpose, entry_time, exit_time, status")
          .eq("visiting_unit_id", resident.unit_id)
          .eq("status", "approved")
          .not("entry_time", "is", null)
          .is("exit_time", null)
          .order("entry_time", { ascending: false })
          .limit(5),
      ]);

    setUnitLabel(unit?.unit_number ?? null);
    setFamilyMembers(members || []);
    setNotices(noticeRows || []);
    setActiveVisitors(visitorRows || []);
    setLoading(false);
  }, [adminContext?.selectedTenantId, canLoadTenantData, effectiveUserId]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const visibleQuickActions = useMemo(
    () => QUICK_ACTIONS.filter((action) => hasAccess(action.moduleKey)),
    [hasAccess],
  );

  if (!canLoadTenantData) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Home className="h-4 w-4" />
              <span className="text-sm">My Flat & Family</span>
            </div>
            <h2 className="font-display text-xl font-bold">
              {unitLabel ? `Flat ${unitLabel}` : "Your Unit"}
            </h2>
            {residentType && (
              <Badge variant="secondary" className="mt-2 capitalize">
                {residentType.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          {hasAccess("my-family") && (
            <button
              onClick={() => navigate("/my-family")}
              className="text-sm text-primary hover:underline"
            >
              Manage Family
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {familyMembers.length > 0 ? (
            familyMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg border p-3 bg-secondary/30"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {member.relationship || member.resident_type.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground col-span-full">
              No family members registered for your unit yet.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Recent Notices</h2>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {notices.length > 0 ? (
              notices.map((notice) => (
                <button
                  key={notice.id}
                  onClick={() => navigate("/notices")}
                  className="w-full text-left rounded-lg p-3 hover:bg-secondary transition-colors"
                >
                  <p className="text-sm font-medium">{notice.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {notice.notice_type.replace(/_/g, " ")} ·{" "}
                    {format(new Date(notice.created_at), "MMM d, yyyy")}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No notices published yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Active Visitors</h2>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {activeVisitors.length > 0 ? (
              activeVisitors.map((visitor) => (
                <div key={visitor.id} className="flex items-center justify-between rounded-lg p-3 bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium">{visitor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {visitor.purpose || "Visit"} · {visitor.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  {visitor.entry_time && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(visitor.entry_time), "h:mm a")}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No active visitors for your unit.</p>
            )}
          </div>
          {hasAccess("my-visitors") && (
            <button
              onClick={() => navigate("/my-visitors")}
              className="mt-4 text-sm text-primary hover:underline"
            >
              View all visitors
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
