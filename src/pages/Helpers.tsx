import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Wrench, UserPlus, Search, MoreHorizontal, Pencil, Check, X, Loader2,
} from "lucide-react";
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { HelperFormDialog, HelperFormData } from "@/components/helpers/HelperFormDialog";

interface Helper {
  id: string;
  name: string;
  phone: string | null;
  service_type: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  unit_ids: string[];
  unit_labels: string[];
}

interface UnitOption {
  id: string;
  unit_number: string;
  building_name: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const Helpers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{ id: string; form: HelperFormData } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    const { data: buildings } = await tenantDb.from("buildings").select("id, name");
    const { data: unitsData } = await tenantDb.from("units").select("id, unit_number, building_id");
    if (!buildings || !unitsData) return;
    const bMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
    setUnits(unitsData.map((u) => ({ id: u.id, unit_number: u.unit_number, building_name: bMap[u.building_id] || "Unknown" })));
  }, []);

  const fetchHelpers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await tenantDb.from("helpers").select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch all assignments
    const helperIds = (data || []).map((h) => h.id);
    const { data: assignments } = helperIds.length > 0
      ? await tenantDb.from("helper_assignments").select("helper_id, unit_id").in("helper_id", helperIds)
      : { data: [] };

    const enriched: Helper[] = (data || []).map((h) => {
      const hAssignments = (assignments || []).filter((a) => a.helper_id === h.id);
      const unitIds = hAssignments.map((a) => a.unit_id);
      const unitLabels = unitIds.map((uid) => {
        const u = units.find((x) => x.id === uid);
        return u ? `${u.building_name}-${u.unit_number}` : uid;
      });
      return {
        ...h,
        status: h.status as Helper["status"],
        unit_ids: unitIds,
        unit_labels: unitLabels,
      };
    });

    setHelpers(enriched);
    setLoading(false);
  }, [units, toast]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);
  useEffect(() => { if (units.length >= 0) fetchHelpers(); }, [units, fetchHelpers]);

  const handleAdd = async (form: HelperFormData) => {
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", description: "Please complete onboarding first.", variant: "destructive" }); return; }

    const { data, error } = await tenantDb.from("helpers").insert({
      name: form.name,
      phone: form.phone || null,
      service_type: form.service_type || null,
      society_id: societyId,
      created_by: user?.id,
      status: "pending" as any,
    }).select("id").single();

    if (error) throw error;

    // Insert assignments
    if (form.unit_ids.length > 0 && data) {
      await tenantDb.from("helper_assignments").insert(
        form.unit_ids.map((uid) => ({ helper_id: data.id, unit_id: uid }))
      );
    }

    toast({ title: "Helper added", description: `${form.name} is pending approval.` });
    fetchHelpers();
  };

  const handleEdit = async (form: HelperFormData) => {
    if (!editData) return;

    const { error } = await tenantDb.from("helpers").update({
      name: form.name,
      phone: form.phone || null,
      service_type: form.service_type || null,
    }).eq("id", editData.id);

    if (error) throw error;

    // Sync assignments: delete old, insert new
    await tenantDb.from("helper_assignments").delete().eq("helper_id", editData.id);
    if (form.unit_ids.length > 0) {
      await tenantDb.from("helper_assignments").insert(
        form.unit_ids.map((uid) => ({ helper_id: editData.id, unit_id: uid }))
      );
    }

    toast({ title: "Helper updated" });
    setEditData(null);
    fetchHelpers();
  };

  const handleStatusChange = async (id: string, newStatus: "approved" | "rejected") => {
    setActionLoading(id);
    try {
      const { error } = await tenantDb.from("helpers").update({ status: newStatus as any, approved_by: user?.id }).eq("id", id);
      if (error) throw error;
      toast({ title: newStatus === "approved" ? "Approved ✓" : "Rejected" });
      fetchHelpers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const filtered = helpers.filter((h) => {
    const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
      (h.phone?.includes(search) ?? false) ||
      (h.service_type?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || h.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: helpers.length,
    pending: helpers.filter((h) => h.status === "pending").length,
    approved: helpers.filter((h) => h.status === "approved").length,
    rejected: helpers.filter((h) => h.status === "rejected").length,
  };

  return (
    <DashboardLayout title="Domestic Helpers">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, cls: "text-foreground" },
            { label: "Pending", value: stats.pending, cls: "text-warning" },
            { label: "Approved", value: stats.approved, cls: "text-success" },
            { label: "Rejected", value: stats.rejected, cls: "text-destructive" },
          ].map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <p className={`text-2xl font-bold font-display ${s.cls}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, phone, or type..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setEditData(null); setDialogOpen(true); }} className="gradient-primary text-primary-foreground">
            <UserPlus className="mr-2 h-4 w-4" /> Add Helper
          </Button>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search || statusFilter !== "all" ? "No helpers match your filters." : "No helpers yet."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="hidden md:table-cell">Units</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{h.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{h.service_type || "General"}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {h.unit_labels.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {h.unit_labels.map((l, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{l}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${statusStyles[h.status]}`}>{h.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {h.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:text-success" onClick={() => handleStatusChange(h.id, "approved")} disabled={actionLoading === h.id}>
                              {actionLoading === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleStatusChange(h.id, "rejected")} disabled={actionLoading === h.id}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditData({
                                id: h.id,
                                form: { name: h.name, phone: h.phone || "", service_type: h.service_type || "", unit_ids: h.unit_ids },
                              });
                              setDialogOpen(true);
                            }}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {h.status !== "approved" && <DropdownMenuItem onClick={() => handleStatusChange(h.id, "approved")}><Check className="mr-2 h-4 w-4" /> Approve</DropdownMenuItem>}
                            {h.status !== "rejected" && <DropdownMenuItem onClick={() => handleStatusChange(h.id, "rejected")} className="text-destructive focus:text-destructive"><X className="mr-2 h-4 w-4" /> Reject</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <HelperFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditData(null); }}
        onSubmit={editData ? handleEdit : handleAdd}
        units={units}
        initialData={editData?.form ?? null}
        mode={editData ? "edit" : "add"}
      />
    </DashboardLayout>
  );
};

export default Helpers;
