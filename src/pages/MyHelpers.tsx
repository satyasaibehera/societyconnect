import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Plus, Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Helper {
  id: string;
  name: string;
  phone: string | null;
  service_type: string | null;
  status: string;
}

const MyHelpers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", service_type: "" });

  const fetchMyUnit = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("residents")
      .select("unit_id, society_id")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();
    if (data) {
      setUnitId(data.unit_id);
      setSocietyId(data.society_id);
    }
  }, [user]);

  const fetchHelpers = useCallback(async () => {
    if (!unitId || !societyId) return;
    setLoading(true);
    // Get helpers assigned to my unit
    const { data: assignments } = await supabase
      .from("helper_assignments")
      .select("helper_id")
      .eq("unit_id", unitId);
    const helperIds = assignments?.map((a) => a.helper_id) || [];
    if (helperIds.length === 0) {
      setHelpers([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("helpers")
      .select("id, name, phone, service_type, status")
      .in("id", helperIds);
    setHelpers(data || []);
    setLoading(false);
  }, [unitId, societyId]);

  useEffect(() => { fetchMyUnit(); }, [fetchMyUnit]);
  useEffect(() => { if (unitId) fetchHelpers(); }, [unitId, fetchHelpers]);

  const handleAdd = async () => {
    if (!form.name || !societyId) return;
    setSaving(true);
    // Create helper then assign to unit
    const { data: newHelper, error } = await supabase.from("helpers").insert({
      name: form.name,
      phone: form.phone || null,
      service_type: form.service_type || null,
      society_id: societyId,
      created_by: user?.id,
      status: "pending",
    }).select("id").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    if (newHelper && unitId) {
      await supabase.from("helper_assignments").insert({
        helper_id: newHelper.id,
        unit_id: unitId,
      });
    }

    setSaving(false);
    toast({ title: "Helper added", description: "Pending approval." });
    setDialogOpen(false);
    setForm({ name: "", phone: "", service_type: "" });
    fetchHelpers();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500" };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px]`}>{status}</Badge>;
  };

  return (
    <DashboardLayout title="My Helpers">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Domestic helpers assigned to your flat.</p>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Helper
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : helpers.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No helpers assigned to your flat.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {helpers.map((h) => (
              <Card key={h.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{h.name}</p>
                  {statusBadge(h.status)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {h.service_type && <p className="capitalize">Service: {h.service_type}</p>}
                  {h.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{h.phone}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Domestic Helper</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <Label>Service Type</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {["maid", "cook", "driver", "gardener", "nanny", "other"].map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Helper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyHelpers;
