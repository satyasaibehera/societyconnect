import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserCheck, Plus, Loader2, Phone, Clock, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUnitApprover } from "@/hooks/useUnitApprover";
import { DelegateManager } from "@/components/delegates/DelegateManager";
import { format } from "date-fns";

interface Visitor {
  id: string;
  name: string;
  phone: string | null;
  purpose: string | null;
  status: string;
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
}

const emptyForm = { name: "", phone: "", purpose: "" };

const MyVisitors = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { myUnitId, societyId, unitLabel, isOwner, canApproveForUnit } = useUnitApprover();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  const fetchMyUnit = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("residents")
      .select("unit_id, society_id, units!residents_unit_id_fkey(unit_number)")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();
    if (data) {
      setUnitId(data.unit_id);
      setSocietyId(data.society_id);
      setUnitLabel((data.units as any)?.unit_number ?? null);
    }
  }, [user]);

  const fetchVisitors = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const { data } = await supabase
      .from("visitors")
      .select("id, name, phone, purpose, status, entry_time, exit_time, created_at")
      .eq("visiting_unit_id", unitId)
      .order("created_at", { ascending: false });
    setVisitors(data || []);
    setLoading(false);
  }, [unitId]);

  useEffect(() => { fetchMyUnit(); }, [fetchMyUnit]);
  useEffect(() => { if (unitId) fetchVisitors(); }, [unitId, fetchVisitors]);

  const openAdd = () => {
    setEditingVisitor(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Visitor) => {
    setEditingVisitor(v);
    setForm({ name: v.name, phone: v.phone || "", purpose: v.purpose || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);

    if (editingVisitor) {
      const { error } = await supabase.from("visitors").update({
        name: form.name,
        phone: form.phone || null,
        purpose: form.purpose || null,
      }).eq("id", editingVisitor.id);
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Visitor updated" });
        setDialogOpen(false);
        fetchVisitors();
      }
    } else {
      if (!unitId || !societyId) { setSaving(false); return; }
      const { error } = await supabase.from("visitors").insert({
        name: form.name,
        phone: form.phone || null,
        purpose: form.purpose || null,
        visiting_unit_id: unitId,
        visiting_unit_label: unitLabel,
        society_id: societyId,
        created_by: user?.id,
        status: "pending",
      });
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Visitor pre-approved", description: "Pending security verification." });
        setDialogOpen(false);
        setForm(emptyForm);
        fetchVisitors();
      }
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500" };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px]`}>{status}</Badge>;
  };

  return (
    <DashboardLayout title="My Visitors">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage visitors coming to your flat.</p>
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Pre-approve Visitor
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : visitors.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No visitors recorded for your flat.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visitors.map((v) => (
              <Card key={v.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{v.name}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEdit(v)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {v.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</p>}
                  {v.purpose && <p>Purpose: {v.purpose}</p>}
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(v.created_at), "dd MMM yyyy, hh:mm a")}
                  </p>
                  {v.entry_time && <p className="text-green-600">Entry: {format(new Date(v.entry_time), "hh:mm a")}</p>}
                  {v.exit_time && <p className="text-red-600">Exit: {format(new Date(v.exit_time), "hh:mm a")}</p>}
                </div>
                <div className="pt-1">{statusBadge(v.status)}</div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingVisitor ? "Edit Visitor" : "Pre-approve Visitor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Visitor Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Purpose</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingVisitor ? "Save Changes" : "Add Visitor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyVisitors;
