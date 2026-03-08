import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ResidentFormDialog, ResidentFormData } from "@/components/residents/ResidentFormDialog";

interface Resident {
  id: string;
  full_name: string;
  phone: string | null;
  resident_type: string;
  date_of_birth: string | null;
  status: "pending" | "approved" | "rejected";
  unit_id: string | null;
  unit_number?: string;
  building_name?: string;
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

const Residents = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{ id: string; form: ResidentFormData } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    const { data: buildingsData } = await supabase.from("buildings").select("id, name");
    const { data: unitsData } = await supabase.from("units").select("id, unit_number, building_id");
    if (!buildingsData || !unitsData) return;

    const buildingMap = Object.fromEntries(buildingsData.map((b) => [b.id, b.name]));
    setUnits(
      unitsData.map((u) => ({
        id: u.id,
        unit_number: u.unit_number,
        building_name: buildingMap[u.building_id] || "Unknown",
      }))
    );
  }, []);

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("residents").select("*").order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error fetching residents", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Enrich with unit info
    const enriched: Resident[] = (data || []).map((r) => {
      const unit = units.find((u) => u.id === r.unit_id);
      return {
        ...r,
        status: r.status as "pending" | "approved" | "rejected",
        unit_number: unit?.unit_number,
        building_name: unit?.building_name,
      };
    });

    setResidents(enriched);
    setLoading(false);
  }, [units, toast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    if (units.length >= 0) fetchResidents();
  }, [units, fetchResidents]);


  const handleAdd = async (form: ResidentFormData) => {
    const societyId = await getSocietyId();
    if (!societyId) {
      toast({ title: "No society found", description: "Please complete onboarding first.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("residents").insert({
      full_name: form.full_name,
      phone: form.phone || null,
      resident_type: form.resident_type,
      date_of_birth: form.date_of_birth || null,
      unit_id: form.unit_id || null,
      society_id: societyId,
      user_id: user?.id,
      status: "pending" as any,
    });

    if (error) throw error;
    toast({ title: "Resident added", description: `${form.full_name} added and pending approval.` });
    fetchResidents();
  };

  const handleEdit = async (form: ResidentFormData) => {
    if (!editData) return;
    const { error } = await supabase
      .from("residents")
      .update({
        full_name: form.full_name,
        phone: form.phone || null,
        resident_type: form.resident_type,
        date_of_birth: form.date_of_birth || null,
        unit_id: form.unit_id || null,
      })
      .eq("id", editData.id);

    if (error) throw error;
    toast({ title: "Resident updated", description: `${form.full_name} has been updated.` });
    setEditData(null);
    fetchResidents();
  };

  const handleStatusChange = async (id: string, newStatus: "approved" | "rejected") => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("residents")
        .update({ status: newStatus as any, approved_by: user?.id })
        .eq("id", id);
      if (error) throw error;
      toast({ title: newStatus === "approved" ? "Approved ✓" : "Rejected", description: `Resident has been ${newStatus}.` });
      fetchResidents();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = residents.filter((r) => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone?.includes(search) ?? false);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: residents.length,
    approved: residents.filter((r) => r.status === "approved").length,
    pending: residents.filter((r) => r.status === "pending").length,
    rejected: residents.filter((r) => r.status === "rejected").length,
  };

  return (
    <DashboardLayout title="Residents">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, cls: "text-foreground" },
            { label: "Approved", value: stats.approved, cls: "text-success" },
            { label: "Pending", value: stats.pending, cls: "text-warning" },
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
              <Input
                placeholder="Search by name or phone..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setEditData(null); setDialogOpen(true); }} className="gradient-primary text-primary-foreground">
            <UserPlus className="mr-2 h-4 w-4" /> Add Resident
          </Button>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {search || statusFilter !== "all" ? "No residents match your filters." : "No residents yet. Add your first resident."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{r.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {r.resident_type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {r.building_name && r.unit_number
                        ? `${r.building_name} - ${r.unit_number}`
                        : "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${statusStyles[r.status]}`}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === "pending" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-success hover:text-success"
                              onClick={() => handleStatusChange(r.id, "approved")}
                              disabled={actionLoading === r.id}
                            >
                              {actionLoading === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleStatusChange(r.id, "rejected")}
                              disabled={actionLoading === r.id}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditData({
                                  id: r.id,
                                  form: {
                                    full_name: r.full_name,
                                    phone: r.phone || "",
                                    email: (r as any).email || "",
                                    resident_type: r.resident_type,
                                    date_of_birth: r.date_of_birth || "",
                                    unit_id: r.unit_id || "",
                                  },
                                });
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {r.status !== "approved" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(r.id, "approved")}>
                                <Check className="mr-2 h-4 w-4" /> Approve
                              </DropdownMenuItem>
                            )}
                            {r.status !== "rejected" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(r.id, "rejected")} className="text-destructive focus:text-destructive">
                                <X className="mr-2 h-4 w-4" /> Reject
                              </DropdownMenuItem>
                            )}
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

      {/* Add / Edit Dialog */}
      <ResidentFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditData(null);
        }}
        onSubmit={editData ? handleEdit : handleAdd}
        units={units}
        initialData={editData?.form ?? null}
        mode={editData ? "edit" : "add"}
      />
    </DashboardLayout>
  );
};

export default Residents;
