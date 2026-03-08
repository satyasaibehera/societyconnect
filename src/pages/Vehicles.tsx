import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Car, Plus, Search, MoreHorizontal, Pencil, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { VehicleFormDialog, VehicleFormData } from "@/components/vehicles/VehicleFormDialog";

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  parking_slot: string | null;
  resident_id: string | null;
  resident_name?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface Resident { id: string; full_name: string; }

const statusStyles: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const Vehicles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{ id: string; form: VehicleFormData } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchResidents = useCallback(async () => {
    const { data } = await supabase.from("residents").select("id, full_name").eq("status", "approved");
    setResidents(data || []);
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
    const enriched: Vehicle[] = (data || []).map((v) => {
      const r = residents.find((x) => x.id === v.resident_id);
      return { ...v, status: v.status as Vehicle["status"], resident_name: r?.full_name };
    });
    setVehicles(enriched);
    setLoading(false);
  }, [residents, toast]);

  useEffect(() => { fetchResidents(); }, [fetchResidents]);
  useEffect(() => { if (residents) fetchVehicles(); }, [residents, fetchVehicles]);

  const handleAdd = async (form: VehicleFormData) => {
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); return; }
    const { error } = await supabase.from("vehicles").insert({
      vehicle_number: form.vehicle_number, vehicle_type: form.vehicle_type || null,
      parking_slot: form.parking_slot || null, resident_id: form.resident_id || null,
      society_id: societyId, status: "pending" as any,
    });
    if (error) throw error;
    toast({ title: "Vehicle registered", description: `${form.vehicle_number} is pending approval.` });
    fetchVehicles();
  };

  const handleEdit = async (form: VehicleFormData) => {
    if (!editData) return;
    const { error } = await supabase.from("vehicles").update({
      vehicle_number: form.vehicle_number, vehicle_type: form.vehicle_type || null,
      parking_slot: form.parking_slot || null, resident_id: form.resident_id || null,
    }).eq("id", editData.id);
    if (error) throw error;
    toast({ title: "Vehicle updated" });
    setEditData(null);
    fetchVehicles();
  };

  const handleStatusChange = async (id: string, newStatus: "approved" | "rejected") => {
    setActionLoading(id);
    try {
      const { error } = await supabase.from("vehicles").update({ status: newStatus as any, approved_by: user?.id }).eq("id", id);
      if (error) throw error;
      toast({ title: newStatus === "approved" ? "Approved ✓" : "Rejected" });
      fetchVehicles();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const filtered = vehicles.filter((v) => {
    const matchesSearch = v.vehicle_number.toLowerCase().includes(search.toLowerCase()) ||
      (v.parking_slot?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (v.resident_name?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = { total: vehicles.length, pending: vehicles.filter((v) => v.status === "pending").length, approved: vehicles.filter((v) => v.status === "approved").length };

  return (
    <DashboardLayout title="Vehicle Registry">
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[{ label: "Total", value: stats.total, cls: "text-foreground" }, { label: "Pending", value: stats.pending, cls: "text-warning" }, { label: "Approved", value: stats.approved, cls: "text-success" }].map((s) => (
            <Card key={s.label} className="p-4 text-center"><p className={`text-2xl font-bold font-display ${s.cls}`}>{s.value}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p></Card>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
          </div>
          <Button onClick={() => { setEditData(null); setDialogOpen(true); }} className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Register Vehicle</Button>
        </div>
        <Card>
          {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><Car className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No vehicles found.</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Vehicle #</TableHead><TableHead>Type</TableHead><TableHead className="hidden sm:table-cell">Parking</TableHead><TableHead className="hidden md:table-cell">Owner</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono font-medium">{v.vehicle_number}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{v.vehicle_type || "—"}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{v.parking_slot || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{v.resident_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs capitalize ${statusStyles[v.status]}`}>{v.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {v.status === "pending" && (<><Button size="icon" variant="ghost" className="h-8 w-8 text-success" onClick={() => handleStatusChange(v.id, "approved")} disabled={actionLoading === v.id}>{actionLoading === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleStatusChange(v.id, "rejected")} disabled={actionLoading === v.id}><X className="h-4 w-4" /></Button></>)}
                        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setEditData({ id: v.id, form: { vehicle_number: v.vehicle_number, vehicle_type: v.vehicle_type || "Car", parking_slot: v.parking_slot || "", resident_id: v.resident_id || "" } }); setDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>{v.status !== "approved" && <DropdownMenuItem onClick={() => handleStatusChange(v.id, "approved")}><Check className="mr-2 h-4 w-4" /> Approve</DropdownMenuItem>}{v.status !== "rejected" && <DropdownMenuItem onClick={() => handleStatusChange(v.id, "rejected")} className="text-destructive"><X className="mr-2 h-4 w-4" /> Reject</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
      <VehicleFormDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditData(null); }} onSubmit={editData ? handleEdit : handleAdd} residents={residents} initialData={editData?.form ?? null} mode={editData ? "edit" : "add"} />
    </DashboardLayout>
  );
};

export default Vehicles;
