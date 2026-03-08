import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  parking_slot: string | null;
  status: string;
  ownership_type: string | null;
}

const MyVehicles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);

  const [form, setForm] = useState({ vehicle_number: "", vehicle_type: "", vehicle_type_other: "", parking_slot: "", ownership_type: "self" });

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
      setSocietyId(data.society_id);
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

  useEffect(() => { fetchMyResident(); }, [fetchMyResident]);
  useEffect(() => { if (residentId) fetchVehicles(); }, [residentId, fetchVehicles]);

  const handleAdd = async () => {
    if (!form.vehicle_number || !residentId || !societyId) return;
    setSaving(true);
    const { error } = await supabase.from("vehicles").insert({
      vehicle_number: form.vehicle_number.toUpperCase(),
      vehicle_type: form.vehicle_type || null,
      parking_slot: form.parking_slot || null,
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
      setForm({ vehicle_number: "", vehicle_type: "", parking_slot: "" });
      fetchVehicles();
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500" };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px]`}>{status}</Badge>;
  };

  return (
    <DashboardLayout title="My Vehicles">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Vehicles registered to your flat.</p>
          <Button onClick={() => setDialogOpen(true)} size="sm">
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
                  {statusBadge(v.status)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {v.vehicle_type && <p className="capitalize">Type: {v.vehicle_type}</p>}
                  {v.parking_slot && <p>Parking: {v.parking_slot}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Vehicle Number *</Label><Input placeholder="e.g. MH01AB1234" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></div>
            <div>
              <Label>Vehicle Type</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["car", "bike", "scooter", "bicycle", "other"].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Parking Slot</Label><Input value={form.parking_slot} onChange={(e) => setForm({ ...form, parking_slot: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.vehicle_number}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyVehicles;
