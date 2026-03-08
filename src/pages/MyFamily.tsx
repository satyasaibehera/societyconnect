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
import { Users, Plus, Loader2, UserPlus, Phone, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface FamilyMember {
  id: string;
  full_name: string;
  phone: string | null;
  resident_type: string;
  relationship: string | null;
  date_of_birth: string | null;
  status: string;
}

const MyFamily = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    relationship: "",
    relationship_other: "",
    date_of_birth: "",
    resident_type: "family",
  });

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

  const fetchMembers = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const { data } = await supabase
      .from("residents")
      .select("id, full_name, phone, resident_type, relationship, date_of_birth, status")
      .eq("unit_id", unitId);
    setMembers(data || []);
    setLoading(false);
  }, [unitId]);

  useEffect(() => { fetchMyUnit(); }, [fetchMyUnit]);
  useEffect(() => { if (unitId) fetchMembers(); }, [unitId, fetchMembers]);

  const handleAdd = async () => {
    if (!form.full_name || !unitId || !societyId) return;
    setSaving(true);
    const { error } = await supabase.from("residents").insert({
      full_name: form.full_name,
      phone: form.phone || null,
      relationship: form.relationship === "other" ? (form.relationship_other || "other") : (form.relationship || null),
      date_of_birth: form.date_of_birth || null,
      resident_type: form.resident_type,
      unit_id: unitId,
      society_id: societyId,
      user_id: user?.id,
      status: "pending",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Family member added", description: "Pending approval." });
      setDialogOpen(false);
      setForm({ full_name: "", phone: "", relationship: "", relationship_other: "", date_of_birth: "", resident_type: "family" });
      fetchMembers();
    }
  };

  const typeBadge = (type: string) => {
    const map: Record<string, string> = { owner: "bg-primary", tenant: "bg-id-tenant", family: "bg-id-resident" };
    return <Badge className={`${map[type] || "bg-muted"} text-white text-[10px]`}>{type}</Badge>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500" };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px]`}>{status}</Badge>;
  };

  return (
    <DashboardLayout title="My Family">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage family members linked to your flat.</p>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Member
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No family members found for your flat.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <Card key={m.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{m.full_name}</p>
                  <div className="flex gap-1">{typeBadge(m.resident_type)} {statusBadge(m.status)}</div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {m.relationship && <p className="capitalize">Relationship: {m.relationship}</p>}
                  {m.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</p>}
                  {m.date_of_birth && <p className="flex items-center gap-1"><Calendar className="h-3 w-3" />{m.date_of_birth}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Family Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <Label>Relationship</Label>
              <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v, relationship_other: "" })}>
                <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                <SelectContent>
                  {["spouse", "child", "parent", "sibling", "other"].map((r) => (
                    <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.relationship === "other" && (
                <Input className="mt-2" placeholder="Specify relationship" value={form.relationship_other} onChange={(e) => setForm({ ...form, relationship_other: e.target.value })} />
              )}
            </div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.resident_type} onValueChange={(v) => setForm({ ...form, resident_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="family">Family Member</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.full_name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyFamily;
