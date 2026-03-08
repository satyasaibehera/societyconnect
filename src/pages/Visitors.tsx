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
  UserCheck, UserPlus, Search, MoreHorizontal, Pencil, Check, X, Loader2, LogIn, LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { VisitorFormDialog, VisitorFormData } from "@/components/visitors/VisitorFormDialog";

interface Visitor {
  id: string;
  name: string;
  phone: string | null;
  purpose: string | null;
  visiting_unit_label: string | null;
  visiting_unit_id: string | null;
  status: "pending" | "approved" | "rejected";
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
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

const Visitors = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{ id: string; form: VisitorFormData } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    const { data: buildings } = await supabase.from("buildings").select("id, name");
    const { data: unitsData } = await supabase.from("units").select("id, unit_number, building_id");
    if (!buildings || !unitsData) return;
    const bMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
    setUnits(unitsData.map((u) => ({ id: u.id, unit_number: u.unit_number, building_name: bMap[u.building_id] || "Unknown" })));
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("visitors").select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setVisitors((data || []).map((v) => ({ ...v, status: v.status as Visitor["status"] })));
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);
  useEffect(() => { fetchVisitors(); }, [fetchVisitors]);



  const handleAdd = async (form: VisitorFormData) => {
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); return; }
    const { error } = await supabase.from("visitors").insert({
      name: form.name, phone: form.phone || null, purpose: form.purpose || null,
      visiting_unit_id: form.visiting_unit_id || null, visiting_unit_label: form.visiting_unit_label || null,
      society_id: societyId, created_by: user?.id, status: "pending" as any,
    });
    if (error) throw error;
    toast({ title: "Visitor added", description: `${form.name} is pending approval.` });
    fetchVisitors();
  };

  const handleEdit = async (form: VisitorFormData) => {
    if (!editData) return;
    const { error } = await supabase.from("visitors").update({
      name: form.name, phone: form.phone || null, purpose: form.purpose || null,
      visiting_unit_id: form.visiting_unit_id || null, visiting_unit_label: form.visiting_unit_label || null,
    }).eq("id", editData.id);
    if (error) throw error;
    toast({ title: "Visitor updated" });
    setEditData(null);
    fetchVisitors();
  };

  const handleStatusChange = async (id: string, newStatus: "approved" | "rejected") => {
    setActionLoading(id);
    try {
      const { error } = await supabase.from("visitors").update({ status: newStatus as any, approved_by: user?.id }).eq("id", id);
      if (error) throw error;
      toast({ title: newStatus === "approved" ? "Approved ✓" : "Rejected" });
      fetchVisitors();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleEntry = async (id: string) => {
    setActionLoading(id);
    const { error } = await supabase.from("visitors").update({ entry_time: new Date().toISOString() }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Entry recorded" }); fetchVisitors(); }
    setActionLoading(null);
  };

  const handleExit = async (id: string) => {
    setActionLoading(id);
    const { error } = await supabase.from("visitors").update({ exit_time: new Date().toISOString() }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Exit recorded" }); fetchVisitors(); }
    setActionLoading(null);
  };

  const filtered = visitors.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) || (v.phone?.includes(search) ?? false);
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: visitors.length,
    pending: visitors.filter((v) => v.status === "pending").length,
    approved: visitors.filter((v) => v.status === "approved").length,
    inside: visitors.filter((v) => v.status === "approved" && v.entry_time && !v.exit_time).length,
  };

  const formatTime = (t: string | null) => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <DashboardLayout title="Visitor Management">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, cls: "text-foreground" },
            { label: "Pending", value: stats.pending, cls: "text-warning" },
            { label: "Approved", value: stats.approved, cls: "text-success" },
            { label: "Inside Now", value: stats.inside, cls: "text-primary" },
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
              <Input placeholder="Search by name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <UserPlus className="mr-2 h-4 w-4" /> Add Visitor
          </Button>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search || statusFilter !== "all" ? "No visitors match your filters." : "No visitors yet."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="hidden md:table-cell">Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Entry/Exit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{v.phone || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.visiting_unit_label || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{v.purpose || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${statusStyles[v.status]}`}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {v.entry_time && <span className="text-success">In: {formatTime(v.entry_time)}</span>}
                      {v.entry_time && v.exit_time && <span className="mx-1">·</span>}
                      {v.exit_time && <span className="text-destructive">Out: {formatTime(v.exit_time)}</span>}
                      {!v.entry_time && !v.exit_time && "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {v.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:text-success" onClick={() => handleStatusChange(v.id, "approved")} disabled={actionLoading === v.id}>
                              {actionLoading === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleStatusChange(v.id, "rejected")} disabled={actionLoading === v.id}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {v.status === "approved" && !v.entry_time && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleEntry(v.id)} disabled={actionLoading === v.id}>
                            <LogIn className="mr-1 h-3 w-3" /> Entry
                          </Button>
                        )}
                        {v.status === "approved" && v.entry_time && !v.exit_time && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleExit(v.id)} disabled={actionLoading === v.id}>
                            <LogOut className="mr-1 h-3 w-3" /> Exit
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditData({ id: v.id, form: { name: v.name, phone: v.phone || "", purpose: v.purpose || "", visiting_unit_id: v.visiting_unit_id || "", visiting_unit_label: v.visiting_unit_label || "" } }); setDialogOpen(true); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {v.status !== "approved" && <DropdownMenuItem onClick={() => handleStatusChange(v.id, "approved")}><Check className="mr-2 h-4 w-4" /> Approve</DropdownMenuItem>}
                            {v.status !== "rejected" && <DropdownMenuItem onClick={() => handleStatusChange(v.id, "rejected")} className="text-destructive focus:text-destructive"><X className="mr-2 h-4 w-4" /> Reject</DropdownMenuItem>}
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

      <VisitorFormDialog
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

export default Visitors;
