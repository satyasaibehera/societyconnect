import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, Plus, Loader2, Pencil, Trash2, AlertCircle, Ticket, Check, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUnitApprover } from "@/hooks/useUnitApprover";
import { DelegateManager } from "@/components/delegates/DelegateManager";
import { format } from "date-fns";

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  parking_slot: string | null;
  status: string;
  ownership_type: string | null;
}

interface TempPass {
  id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  visitor_name: string | null;
  visitor_phone: string | null;
  purpose: string | null;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

const emptyForm = { vehicle_number: "", vehicle_type: "", vehicle_type_other: "", parking_slot: "", ownership_type: "self" };

const MyVehicles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { myUnitId, societyId, isOwner, canApproveForUnit } = useUnitApprover();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tempPasses, setTempPasses] = useState<TempPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  const fetchMyResident = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("residents")
      .select("id, society_id")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();
    if (data) {
      setResidentId(data.id);
    }
  }, [user]);

  const fetchVehicles = useCallback(async () => {
    if (!residentId) return;
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select("id, vehicle_number, vehicle_type, parking_slot, status, ownership_type")
      .eq("resident_id", residentId);
    setVehicles(data || []);
    setLoading(false);
  }, [residentId]);

  const fetchTempPasses = useCallback(async () => {
    if (!myUnitId) return;
    const { data } = await supabase
      .from("vehicle_passes")
      .select("id, vehicle_number, vehicle_type, visitor_name, visitor_phone, purpose, status, valid_from, valid_until, created_at")
      .eq("unit_id", myUnitId)
      .eq("pass_type", "temporary")
      .order("created_at", { ascending: false });
    setTempPasses((data as any as TempPass[]) || []);
  }, [myUnitId]);

  useEffect(() => { fetchMyResident(); }, [fetchMyResident]);
  useEffect(() => { if (residentId) fetchVehicles(); }, [residentId, fetchVehicles]);
  useEffect(() => { if (myUnitId) fetchTempPasses(); }, [myUnitId, fetchTempPasses]);

  const openAdd = () => {
    setEditingVehicle(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    const knownTypes = ["car", "bike", "scooter", "bicycle", "other"];
    const isKnown = knownTypes.includes(v.vehicle_type || "");
    setForm({
      vehicle_number: v.vehicle_number,
      vehicle_type: isKnown ? (v.vehicle_type || "") : (v.vehicle_type ? "other" : ""),
      vehicle_type_other: !isKnown ? (v.vehicle_type || "") : "",
      parking_slot: v.parking_slot || "",
      ownership_type: v.ownership_type || "self",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.vehicle_number) return;
    setSaving(true);
    const vehicleType = form.vehicle_type === "other" ? (form.vehicle_type_other || "other") : (form.vehicle_type || null);

    if (editingVehicle) {
      const { error } = await supabase.from("vehicles").update({
        vehicle_number: form.vehicle_number.toUpperCase(),
        vehicle_type: vehicleType,
        parking_slot: form.parking_slot || null,
        ownership_type: form.ownership_type || "self",
      }).eq("id", editingVehicle.id);
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Vehicle updated" });
        setDialogOpen(false);
        fetchVehicles();
      }
    } else {
      if (!residentId || !societyId) { setSaving(false); return; }
      const { error } = await supabase.from("vehicles").insert({
        vehicle_number: form.vehicle_number.toUpperCase(),
        vehicle_type: vehicleType,
        parking_slot: form.parking_slot || null,
        ownership_type: form.ownership_type || "self",
        resident_id: residentId,
        society_id: societyId,
        status: "pending",
      });
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Vehicle added", description: "Pending approval." });
        setDialogOpen(false);
        setForm(emptyForm);
        fetchVehicles();
      }
    }
  };

  const handleDelete = async () => {
    if (!deletingVehicle) return;
    setSaving(true);
    const { error } = await supabase.from("vehicles").delete().eq("id", deletingVehicle.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vehicle removed", description: "The vehicle pass is now expired." });
      setDeleteDialogOpen(false);
      setDeletingVehicle(null);
      fetchVehicles();
    }
  };

  const handlePassApproval = async (passId: string, approved: boolean) => {
    setActionLoading(passId);
    const { error } = await supabase.from("vehicle_passes").update({
      status: approved ? "approved" : "rejected",
      approved_by: user?.id,
    }).eq("id", passId);
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: approved ? "Pass approved" : "Pass rejected" });
      fetchTempPasses();
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500" };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px] capitalize`}>{status}</Badge>;
  };

  const isExpired = (p: TempPass) => p.valid_until && new Date(p.valid_until) < new Date();
  const effectiveStatus = (p: TempPass) => p.status === "approved" && isExpired(p) ? "expired" : p.status;

  const pendingPassCount = tempPasses.filter((p) => p.status === "pending").length;

  return (
    <DashboardLayout title="My Vehicles">
      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">
            <Car className="mr-1.5 h-4 w-4" /> My Vehicles ({vehicles.length})
          </TabsTrigger>
          <TabsTrigger value="temp-passes">
            <Ticket className="mr-1.5 h-4 w-4" /> Temp Passes
            {pendingPassCount > 0 && (
              <Badge className="ml-1.5 bg-yellow-500 text-white text-[10px] h-5 px-1.5">{pendingPassCount}</Badge>
            )}
          </TabsTrigger>
          {isOwner && myUnitId && (
            <TabsTrigger value="delegates">Delegates</TabsTrigger>
          )}
        </TabsList>

        {/* My Vehicles Tab */}
        <TabsContent value="vehicles" className="mt-4">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Vehicles registered to your flat.</p>
              <Button onClick={openAdd} size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add Vehicle
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : vehicles.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No vehicles registered for your flat.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vehicles.map((v) => (
                  <Card key={v.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm tracking-wider">{v.vehicle_number}</p>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(v)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { setDeletingVehicle(v); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {v.vehicle_type && <p className="capitalize">Type: {v.vehicle_type}</p>}
                      {v.ownership_type && <p className="capitalize">Owner: {v.ownership_type}</p>}
                      {v.parking_slot && <p>Parking: {v.parking_slot}</p>}
                    </div>
                    <div className="pt-1">{statusBadge(v.status)}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Temp Vehicle Passes Tab */}
        <TabsContent value="temp-passes" className="mt-4">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Temporary vehicle passes requested for your flat by security or pre-approved by you.</p>
            {tempPasses.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <Ticket className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No temporary vehicle passes for your flat.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tempPasses.map((p) => {
                  const status = effectiveStatus(p);
                  return (
                    <Card key={p.id} className={`p-4 space-y-2 border-l-4 border-l-red-500 ${status === "expired" || status === "rejected" ? "opacity-60" : ""}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm tracking-wider">{p.vehicle_number}</p>
                        {statusBadge(status)}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {p.visitor_name && <p>Visitor: {p.visitor_name}</p>}
                        {p.visitor_phone && <p>Phone: {p.visitor_phone}</p>}
                        {p.vehicle_type && <p className="capitalize">Type: {p.vehicle_type}</p>}
                        {p.purpose && <p>Purpose: {p.purpose}</p>}
                        {p.valid_until && (
                          <p className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Until: {format(new Date(p.valid_until), "dd MMM yyyy, hh:mm a")}
                          </p>
                        )}
                        <p className="text-[10px]">
                          Requested: {format(new Date(p.created_at), "dd MMM yyyy, hh:mm a")}
                        </p>
                      </div>
                      {p.status === "pending" && canApproveForUnit(myUnitId) && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                            disabled={actionLoading === p.id}
                            onClick={() => handlePassApproval(p.id, true)}
                          >
                            {actionLoading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Approve</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 text-xs"
                            disabled={actionLoading === p.id}
                            onClick={() => handlePassApproval(p.id, false)}
                          >
                            <X className="h-3 w-3 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Delegates Tab */}
        {isOwner && myUnitId && (
          <TabsContent value="delegates" className="mt-4">
            <DelegateManager unitId={myUnitId} />
          </TabsContent>
        )}
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Vehicle Number *</Label><Input placeholder="e.g. MH01AB1234" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></div>
            <div>
              <Label>Vehicle Type</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v, vehicle_type_other: "" })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["car", "bike", "scooter", "bicycle", "other"].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.vehicle_type === "other" && (
                <Input className="mt-2" placeholder="Specify vehicle type" value={form.vehicle_type_other} onChange={(e) => setForm({ ...form, vehicle_type_other: e.target.value })} />
              )}
            </div>
            <div>
              <Label>Ownership</Label>
              <Select value={form.ownership_type} onValueChange={(v) => setForm({ ...form, ownership_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Parking Slot</Label><Input value={form.parking_slot} onChange={(e) => setForm({ ...form, parking_slot: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !form.vehicle_number}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingVehicle ? "Save Changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Vehicle</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-bold">{deletingVehicle?.vehicle_number}</span> from your flat? The vehicle pass will expire automatically.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>This action cannot be undone. You'll need to re-register the vehicle if added back.</AlertDescription>
          </Alert>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remove Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyVehicles;
