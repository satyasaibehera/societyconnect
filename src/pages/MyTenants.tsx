import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Users, Plus, Loader2, Phone, Calendar, Pencil, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Tenant {
  id: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  status: string;
  tenancy_start_date: string | null;
  tenancy_end_date: string | null;
  has_vacated: boolean;
}

const emptyForm = { full_name: "", phone: "", date_of_birth: "", tenancy_start_date: "", tenancy_end_date: "" };

const MyTenants = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  const [form, setForm] = useState(emptyForm);

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

  const fetchTenants = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const { data } = await supabase
      .from("residents")
      .select("id, full_name, phone, date_of_birth, status, tenancy_start_date, tenancy_end_date, has_vacated")
      .eq("unit_id", unitId)
      .eq("resident_type", "tenant");
    setTenants(data || []);
    setLoading(false);
  }, [unitId]);

  useEffect(() => { fetchMyUnit(); }, [fetchMyUnit]);
  useEffect(() => { if (unitId) fetchTenants(); }, [unitId, fetchTenants]);

  const openAdd = () => {
    setEditingTenant(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setEditingTenant(t);
    setForm({
      full_name: t.full_name,
      phone: t.phone || "",
      date_of_birth: t.date_of_birth || "",
      tenancy_start_date: t.tenancy_start_date || "",
      tenancy_end_date: t.tenancy_end_date || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name) return;
    setSaving(true);

    if (editingTenant) {
      // Update existing tenant
      const { error } = await supabase.from("residents").update({
        full_name: form.full_name,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        tenancy_start_date: form.tenancy_start_date || null,
        tenancy_end_date: form.tenancy_end_date || null,
      }).eq("id", editingTenant.id);
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Tenant updated" });
        setDialogOpen(false);
        fetchTenants();
      }
    } else {
      // Insert new tenant
      if (!unitId || !societyId) { setSaving(false); return; }
      const { error } = await supabase.from("residents").insert({
        full_name: form.full_name,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        tenancy_start_date: form.tenancy_start_date || null,
        tenancy_end_date: form.tenancy_end_date || null,
        resident_type: "tenant",
        unit_id: unitId,
        society_id: societyId,
        user_id: user?.id,
        status: "pending",
      });
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Tenant added", description: "Pending approval." });
        setDialogOpen(false);
        setForm(emptyForm);
        fetchTenants();
      }
    }
  };

  const statusBadge = (status: string, vacated: boolean) => {
    if (vacated) return <Badge className="bg-destructive text-white text-[10px]">Vacated</Badge>;
    const map: Record<string, string> = { approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500" };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px]`}>{status}</Badge>;
  };

  const handleVacate = async (tenantId: string, currentlyVacated: boolean) => {
    const { error } = await supabase.from("residents").update({ has_vacated: !currentlyVacated }).eq("id", tenantId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentlyVacated ? "Tenant restored" : "Tenant marked as vacated" });
      fetchTenants();
    }
  };

  return (
    <DashboardLayout title="My Tenants">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Tenants renting in your flat.</p>
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Tenant
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tenants.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tenants in your flat.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tenants.map((t) => (
              <Card key={t.id} className={`p-4 space-y-2 ${t.has_vacated ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className={`font-medium text-sm truncate ${t.has_vacated ? "line-through" : ""}`}>{t.full_name}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEdit(t)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {t.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{t.phone}</p>}
                  {t.date_of_birth && <p className="flex items-center gap-1"><Calendar className="h-3 w-3" />DOB: {t.date_of_birth}</p>}
                  {t.tenancy_start_date && <p className="flex items-center gap-1"><Calendar className="h-3 w-3" />Start: {t.tenancy_start_date}</p>}
                  {t.tenancy_end_date && <p className="flex items-center gap-1"><Calendar className="h-3 w-3" />End: {t.tenancy_end_date}</p>}
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Badge className="bg-id-tenant text-white text-[10px]">Tenant</Badge>
                  {statusBadge(t.status, t.has_vacated)}
                </div>
                <Button
                  variant={t.has_vacated ? "outline" : "destructive"}
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleVacate(t.id, t.has_vacated)}
                >
                  {t.has_vacated ? "Restore Tenant" : "Mark as Vacated"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingTenant ? "Edit Tenant" : "Add Tenant"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div><Label>Tenancy Start Date</Label><Input type="date" value={form.tenancy_start_date} onChange={(e) => setForm({ ...form, tenancy_start_date: e.target.value })} /></div>
            <div><Label>Tenancy End Date</Label><Input type="date" value={form.tenancy_end_date} onChange={(e) => setForm({ ...form, tenancy_end_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !form.full_name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingTenant ? "Save Changes" : "Add Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyTenants;
