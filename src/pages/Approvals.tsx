import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, UserCheck, Users, Wrench, Car, Shield, Loader2, PackageOpen, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ApprovalDetailDialog } from "@/components/approvals/ApprovalDetailDialog";

type ApprovalCategory = "visitors" | "residents" | "helpers" | "vehicles" | "role_requests" | "move_passes";

interface PendingItem {
  id: string;
  category: ApprovalCategory;
  title: string;
  subtitle: string;
  detail: string;
  created_at: string;
}

const categoryConfig: Record<ApprovalCategory, { label: string; icon: typeof UserCheck; color: string }> = {
  visitors: { label: "Visitors", icon: UserCheck, color: "text-primary" },
  residents: { label: "Residents", icon: Users, color: "text-accent" },
  helpers: { label: "Helpers", icon: Wrench, color: "text-warning" },
  vehicles: { label: "Vehicles", icon: Car, color: "text-success" },
  role_requests: { label: "Role Requests", icon: Shield, color: "text-destructive" },
  move_passes: { label: "Move Passes", icon: PackageOpen, color: "text-primary" },
};

const Approvals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<{ id: string; category: string } | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    const pending: PendingItem[] = [];

    // Fetch pending visitors
    const { data: visitors } = await supabase
      .from("visitors")
      .select("id, name, phone, visiting_unit_label, purpose, created_at")
      .eq("status", "pending");
    visitors?.forEach((v) =>
      pending.push({
        id: v.id,
        category: "visitors",
        title: v.name,
        subtitle: v.visiting_unit_label || "Unknown unit",
        detail: v.purpose || "Visit",
        created_at: v.created_at,
      })
    );

    // Fetch pending residents
    const { data: residents } = await supabase
      .from("residents")
      .select("id, full_name, phone, resident_type, created_at")
      .eq("status", "pending");
    residents?.forEach((r) =>
      pending.push({
        id: r.id,
        category: "residents",
        title: r.full_name,
        subtitle: r.resident_type,
        detail: r.phone || "",
        created_at: r.created_at,
      })
    );

    // Fetch pending helpers
    const { data: helpers } = await supabase
      .from("helpers")
      .select("id, name, phone, service_type, created_at")
      .eq("status", "pending");
    helpers?.forEach((h) =>
      pending.push({
        id: h.id,
        category: "helpers",
        title: h.name,
        subtitle: h.service_type || "General",
        detail: h.phone || "",
        created_at: h.created_at,
      })
    );

    // Fetch pending vehicles
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("id, vehicle_number, vehicle_type, parking_slot, created_at")
      .eq("status", "pending");
    vehicles?.forEach((v) =>
      pending.push({
        id: v.id,
        category: "vehicles",
        title: v.vehicle_number,
        subtitle: v.vehicle_type || "Vehicle",
        detail: v.parking_slot || "No slot",
        created_at: v.created_at,
      })
    );

    // Fetch pending role requests
    const { data: roleReqs } = await supabase
      .from("role_requests")
      .select("id, requested_role, reason, created_at")
      .eq("status", "pending");
    roleReqs?.forEach((r) =>
      pending.push({
        id: r.id,
        category: "role_requests",
        title: `${r.requested_role} request`,
        subtitle: r.requested_role,
        detail: r.reason || "No reason provided",
        created_at: r.created_at,
      })
    );

    // Fetch pending move passes (pending_owner and pending_admin)
    const { data: movePasses } = await supabase
      .from("move_passes")
      .select("id, pass_type, status, scheduled_date, notes, created_at")
      .in("status", ["pending_owner", "pending_admin"]);
    (movePasses as any[])?.forEach((m) =>
      pending.push({
        id: m.id,
        category: "move_passes",
        title: m.pass_type === "move_in" ? "Move In Request" : "Move Out Request",
        subtitle: m.status === "pending_owner" ? "Awaiting Owner" : "Awaiting Admin",
        detail: m.notes || (m.scheduled_date ? `Scheduled: ${m.scheduled_date}` : "No details"),
        created_at: m.created_at,
      })
    );

    // Sort by newest first
    pending.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setItems(pending);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (item: PendingItem, action: "approved" | "rejected") => {
    setActionLoading(item.id);
    try {
      // Move passes have their own multi-step logic
      if (item.category === "move_passes") {
        const { data: mp } = await supabase
          .from("move_passes")
          .select("status")
          .eq("id", item.id)
          .single();
        if (!mp) throw new Error("Move pass not found");
        const updates: any =
          mp.status === "pending_owner"
            ? action === "approved"
              ? { status: "pending_admin", owner_approved_by: user?.id, owner_approved_at: new Date().toISOString() }
              : { status: "rejected", owner_rejection_reason: "Rejected by owner", owner_approved_by: user?.id, owner_approved_at: new Date().toISOString() }
            : action === "approved"
              ? { status: "approved", admin_approved_by: user?.id, admin_approved_at: new Date().toISOString() }
              : { status: "rejected", admin_rejection_reason: "Rejected by admin", admin_approved_by: user?.id, admin_approved_at: new Date().toISOString() };
        const { error } = await supabase.from("move_passes").update(updates).eq("id", item.id);
        if (error) throw error;
        toast({ title: action === "approved" ? "Approved ✓" : "Rejected", description: `${item.title} updated.` });
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        return;
      }

      const table = item.category === "role_requests" ? "role_requests" : item.category;
      const updateData: any = { status: action };

      if (item.category === "role_requests") {
        updateData.reviewed_by = user?.id;
      } else {
        updateData.approved_by = user?.id;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", item.id);

      if (error) throw error;

      // If approving a role request, also insert the role
      if (action === "approved" && item.category === "role_requests") {
        const { data: req } = await supabase
          .from("role_requests")
          .select("requester_id, requested_role")
          .eq("id", item.id)
          .single();

        if (req) {
          await supabase.from("user_roles").insert({
            user_id: req.requester_id,
            role: req.requested_role as any,
          });
        }
      }

      toast({
        title: action === "approved" ? "Approved ✓" : "Rejected",
        description: `${item.title} has been ${action}.`,
      });

      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const categories = Object.keys(categoryConfig) as ApprovalCategory[];
  const getCategoryCount = (cat: ApprovalCategory) => items.filter((i) => i.category === cat).length;

  const renderItems = (filtered: PendingItem[]) => {
    if (filtered.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Check className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">All caught up! No pending approvals.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filtered.map((item) => {
          const config = categoryConfig[item.category];
          const Icon = config.icon;
          return (
            <Card key={item.id} className="p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${config.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{config.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.subtitle} · {item.detail}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleAction(item, "approved")}
                  disabled={actionLoading === item.id}
                  className="gradient-primary text-primary-foreground h-8 px-3"
                >
                  {actionLoading === item.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <><Check className="h-3 w-3 mr-1" /> Approve</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(item, "rejected")}
                  disabled={actionLoading === item.id}
                  className="h-8 px-3 text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3 mr-1" /> Reject
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout title="Approvals">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => {
            const config = categoryConfig[cat];
            const Icon = config.icon;
            const count = getCategoryCount(cat);
            return (
              <Card key={cat} className="p-4 text-center">
                <Icon className={`h-5 w-5 mx-auto mb-1 ${config.color}`} />
                <p className="text-2xl font-bold font-display">{count}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{config.label}</p>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">
                All ({items.length})
              </TabsTrigger>
              {categories.map((cat) => {
                const count = getCategoryCount(cat);
                if (count === 0) return null;
                return (
                  <TabsTrigger key={cat} value={cat}>
                    {categoryConfig[cat].label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {renderItems(items)}
            </TabsContent>
            {categories.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-4">
                {renderItems(items.filter((i) => i.category === cat))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
