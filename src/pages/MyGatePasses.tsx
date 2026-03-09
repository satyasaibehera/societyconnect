import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  UserCheck, Car, Plus, Loader2, Phone, Clock, Check, X, Ticket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUnitApprover } from "@/hooks/useUnitApprover";
import { format } from "date-fns";

/* ─── Types ─────────────────────────────────────────────────── */
interface VisitorPass {
  id: string;
  name: string;
  phone: string | null;
  purpose: string | null;
  status: string;
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
  created_by: string | null;
  visiting_unit_id: string | null;
}

interface VehiclePass {
  id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  pass_type: string;
  status: string;
  visitor_name: string | null;
  visitor_phone: string | null;
  purpose: string | null;
  unit_id: string | null;
  unit_label: string | null;
  valid_until: string | null;
  created_at: string;
  requested_by: string | null;
}

/* ─── Status badge helper ────────────────────────────────────── */
const statusColor: Record<string, string> = {
  approved: "bg-success text-success-foreground",
  pending: "bg-warning text-warning-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  expired: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`text-[10px] capitalize ${statusColor[status] ?? "bg-muted"}`}>
      {status}
    </Badge>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
const MyGatePasses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { myUnitId, societyId, unitLabel, canApproveForUnit, loading: roleLoading } =
    useUnitApprover();

  const [visitorPasses, setVisitorPasses] = useState<VisitorPass[]>([]);
  const [vehiclePasses, setVehiclePasses] = useState<VehiclePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tempPassHours, setTempPassHours] = useState(24);

  /* Dialog state */
  const [visitorDialogOpen, setVisitorDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [visitorForm, setVisitorForm] = useState({
    name: "", phone: "", purpose: "",
  });
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_number: "", vehicle_type: "", visitor_name: "", visitor_phone: "", purpose: "",
  });

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchPasses = useCallback(async () => {
    if (!myUnitId) return;
    setLoading(true);

    const [{ data: vData }, { data: vpData }, { data: society }] = await Promise.all([
      supabase
        .from("visitors")
        .select("id,name,phone,purpose,status,entry_time,exit_time,created_at,created_by,visiting_unit_id")
        .eq("visiting_unit_id", myUnitId)
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicle_passes")
        .select("id,vehicle_number,vehicle_type,pass_type,status,visitor_name,visitor_phone,purpose,unit_id,unit_label,valid_until,created_at,requested_by")
        .eq("unit_id", myUnitId)
        .eq("pass_type", "temporary")
        .order("created_at", { ascending: false }),
      societyId
        ? supabase.from("societies").select("temp_pass_validity_hours").eq("id", societyId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setVisitorPasses(vData || []);
    setVehiclePasses(vpData as VehiclePass[] || []);
    if (society) setTempPassHours((society as any)?.temp_pass_validity_hours ?? 24);
    setLoading(false);
  }, [myUnitId, societyId]);

  useEffect(() => { if (myUnitId) fetchPasses(); }, [myUnitId, fetchPasses]);

  /* ── Create visitor gate pass ─────────────────────────────── */
  const handleAddVisitor = async () => {
    if (!visitorForm.name.trim() || !myUnitId || !societyId) return;
    setSaving(true);
    const { error } = await supabase.from("visitors").insert({
      name: visitorForm.name.trim(),
      phone: visitorForm.phone || null,
      purpose: visitorForm.purpose || null,
      visiting_unit_id: myUnitId,
      visiting_unit_label: unitLabel,
      society_id: societyId,
      created_by: user?.id,
      status: "pending",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Visitor pass requested", description: "Pending owner approval." });
      setVisitorDialogOpen(false);
      setVisitorForm({ name: "", phone: "", purpose: "" });
      fetchPasses();
    }
  };

  /* ── Create vehicle gate pass ─────────────────────────────── */
  const handleAddVehicle = async () => {
    if (!vehicleForm.vehicle_number.trim() || !myUnitId || !societyId) return;
    setSaving(true);
    const validUntil = new Date(Date.now() + tempPassHours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("vehicle_passes").insert({
      vehicle_number: vehicleForm.vehicle_number.trim().toUpperCase(),
      vehicle_type: vehicleForm.vehicle_type || null,
      visitor_name: vehicleForm.visitor_name || null,
      visitor_phone: vehicleForm.visitor_phone || null,
      purpose: vehicleForm.purpose || null,
      pass_type: "temporary",
      unit_id: myUnitId,
      unit_label: unitLabel,
      society_id: societyId,
      requested_by: user?.id,
      status: "pending",
      valid_until: validUntil,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vehicle pass requested", description: "Pending owner approval." });
      setVehicleDialogOpen(false);
      setVehicleForm({ vehicle_number: "", vehicle_type: "", visitor_name: "", visitor_phone: "", purpose: "" });
      fetchPasses();
    }
  };

  /* ── Approve / Reject ─────────────────────────────────────── */
  const handleVisitorAction = async (id: string, approve: boolean) => {
    setActionLoading(id);
    const { error } = await supabase.from("visitors").update({
      status: approve ? "approved" : "rejected",
      approved_by: user?.id,
    }).eq("id", id);
    setActionLoading(null);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: approve ? "Visitor approved" : "Visitor rejected" }); fetchPasses(); }
  };

  const handleVehicleAction = async (id: string, approve: boolean) => {
    setActionLoading(id);
    const { error } = await supabase.from("vehicle_passes").update({
      status: approve ? "approved" : "rejected",
      approved_by: user?.id,
    }).eq("id", id);
    setActionLoading(null);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: approve ? "Vehicle pass approved" : "Vehicle pass rejected" }); fetchPasses(); }
  };

  const isExpiredVehicle = (p: VehiclePass) =>
    p.valid_until && new Date(p.valid_until) < new Date();

  const effectiveVehicleStatus = (p: VehiclePass) =>
    p.status === "approved" && isExpiredVehicle(p) ? "expired" : p.status;

  const pendingVisitors = visitorPasses.filter((v) => v.status === "pending").length;
  const pendingVehicles = vehiclePasses.filter((v) => v.status === "pending").length;

  /* ─── Render ──────────────────────────────────────────────── */
  if (roleLoading) {
    return (
      <DashboardLayout title="My Gate Passes">
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!myUnitId) {
    return (
      <DashboardLayout title="My Gate Passes">
        <Card className="p-12 text-center text-muted-foreground">
          <Ticket className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">You need to be linked to a flat to use gate passes.</p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Gate Passes">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Visitor Requests", value: visitorPasses.length, cls: "text-foreground" },
            { label: "Pending Visitors", value: pendingVisitors, cls: "text-warning" },
            { label: "Vehicle Requests", value: vehiclePasses.length, cls: "text-foreground" },
            { label: "Pending Vehicles", value: pendingVehicles, cls: "text-warning" },
          ].map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <p className={`text-2xl font-bold font-display ${s.cls}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="visitors">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="visitors" className="gap-1.5">
                <UserCheck className="h-4 w-4" />
                Visitor Passes {pendingVisitors > 0 && (
                  <Badge className="bg-warning text-warning-foreground text-[9px] h-4 px-1">{pendingVisitors}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="gap-1.5">
                <Car className="h-4 w-4" />
                Vehicle Passes {pendingVehicles > 0 && (
                  <Badge className="bg-warning text-warning-foreground text-[9px] h-4 px-1">{pendingVehicles}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setVisitorDialogOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Request Visitor Pass
              </Button>
              <Button size="sm" variant="outline" onClick={() => setVehicleDialogOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Request Vehicle Pass
              </Button>
            </div>
          </div>

          {/* ── Visitor Passes Tab ──────────────────────────── */}
          <TabsContent value="visitors" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visitorPasses.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No visitor pass requests yet.</p>
                <Button size="sm" className="mt-4" onClick={() => setVisitorDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Request First Visitor Pass
                </Button>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visitorPasses.map((v) => (
                  <Card key={v.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{v.name}</p>
                        {v.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" /> {v.phone}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                    {v.purpose && <p className="text-xs text-muted-foreground">Purpose: {v.purpose}</p>}
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(v.created_at), "dd MMM yyyy, hh:mm a")}
                    </div>
                    {v.entry_time && (
                      <p className="text-xs text-success">Entry: {format(new Date(v.entry_time), "hh:mm a")}</p>
                    )}
                    {v.exit_time && (
                      <p className="text-xs text-destructive">Exit: {format(new Date(v.exit_time), "hh:mm a")}</p>
                    )}

                    {/* Approval actions — shown to owner/delegate */}
                    {v.status === "pending" && canApproveForUnit(myUnitId) && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs bg-success text-success-foreground hover:bg-success/90"
                          disabled={actionLoading === v.id}
                          onClick={() => handleVisitorAction(v.id, true)}
                        >
                          {actionLoading === v.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><Check className="h-3 w-3 mr-1" /> Approve</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 h-8 text-xs"
                          disabled={actionLoading === v.id}
                          onClick={() => handleVisitorAction(v.id, false)}
                        >
                          <X className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Vehicle Passes Tab ──────────────────────────── */}
          <TabsContent value="vehicles" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : vehiclePasses.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No vehicle pass requests yet.</p>
                <Button size="sm" className="mt-4" onClick={() => setVehicleDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Request First Vehicle Pass
                </Button>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vehiclePasses.map((p) => {
                  const status = effectiveVehicleStatus(p);
                  return (
                    <Card key={p.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm tracking-wider">{p.vehicle_number}</p>
                          {p.vehicle_type && (
                            <p className="text-xs text-muted-foreground capitalize">{p.vehicle_type}</p>
                          )}
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {p.visitor_name && <p>Visitor: {p.visitor_name}</p>}
                        {p.visitor_phone && (
                          <p className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.visitor_phone}
                          </p>
                        )}
                        {p.purpose && <p>Purpose: {p.purpose}</p>}
                        {p.valid_until && (
                          <p className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Valid until: {format(new Date(p.valid_until), "dd MMM yyyy, hh:mm a")}
                          </p>
                        )}
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Requested: {format(new Date(p.created_at), "dd MMM yyyy, hh:mm a")}
                        </p>
                      </div>

                      {/* Approval actions — shown to owner/delegate */}
                      {p.status === "pending" && canApproveForUnit(myUnitId) && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs bg-success text-success-foreground hover:bg-success/90"
                            disabled={actionLoading === p.id}
                            onClick={() => handleVehicleAction(p.id, true)}
                          >
                            {actionLoading === p.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><Check className="h-3 w-3 mr-1" /> Approve</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 h-8 text-xs"
                            disabled={actionLoading === p.id}
                            onClick={() => handleVehicleAction(p.id, false)}
                          >
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Visitor Pass Dialog ────────────────────────────────── */}
      <Dialog open={visitorDialogOpen} onOpenChange={setVisitorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserCheck className="h-5 w-5" /> Request Visitor Gate Pass
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>Visitor Name *</Label>
              <Input
                placeholder="Enter visitor name"
                value={visitorForm.name}
                onChange={(e) => setVisitorForm({ ...visitorForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 9876543210"
                  value={visitorForm.phone}
                  onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Input
                  placeholder="e.g. Guest, Delivery"
                  value={visitorForm.purpose}
                  onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded-md p-3">
              Your request will be sent to the flat owner for approval. Once approved, the visitor will be allowed entry by security.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitorDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleAddVisitor}
              disabled={saving || !visitorForm.name.trim()}
              className="gradient-primary text-primary-foreground"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Vehicle Pass Dialog ────────────────────────────────── */}
      <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Car className="h-5 w-5" /> Request Vehicle Gate Pass
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehicle Number *</Label>
                <Input
                  placeholder="e.g. MH 01 AB 1234"
                  value={vehicleForm.vehicle_number}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select
                  value={vehicleForm.vehicle_type}
                  onValueChange={(v) => setVehicleForm({ ...vehicleForm, vehicle_type: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="bike">Bike / Scooter</SelectItem>
                    <SelectItem value="truck">Truck / Van</SelectItem>
                    <SelectItem value="auto">Auto / Cab</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Visitor Name</Label>
                <Input
                  placeholder="Driver / visitor name"
                  value={vehicleForm.visitor_name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, visitor_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Visitor Phone</Label>
                <Input
                  placeholder="+91 9876543210"
                  value={vehicleForm.visitor_phone}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, visitor_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Input
                placeholder="e.g. Furniture delivery, Guest visit"
                value={vehicleForm.purpose}
                onChange={(e) => setVehicleForm({ ...vehicleForm, purpose: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded-md p-3">
              A temporary pass valid for <strong>{tempPassHours} hours</strong> will be issued upon owner approval. Security will verify at the gate.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleAddVehicle}
              disabled={saving || !vehicleForm.vehicle_number.trim()}
              className="gradient-primary text-primary-foreground"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyGatePasses;
