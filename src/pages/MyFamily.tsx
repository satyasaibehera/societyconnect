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
import { Users, Plus, Loader2, UserPlus, Phone, Calendar, ArrowRightLeft, Crown, AlertCircle, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tenantDb } from "@/services/tenantDb";
import { apiFetch } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/camera/CameraCapture";

interface FamilyMember {
  id: string;
  full_name: string;
  phone: string | null;
  resident_type: string;
  relationship: string | null;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  status: string;
  photo_url?: string | null;
}

const emptyForm = {
  full_name: "", phone: "", relationship: "", relationship_other: "",
  date_of_birth: "", age: "", gender: "", resident_type: "family",
  photo_url: "",
};

const MyFamily = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [myResidentId, setMyResidentId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; name: string } | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoBlob) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const filePath = `${user.id}/${fileName}`;
    const { error } = await supabase.storage.from("resident-photos").upload(filePath, photoBlob, { contentType: "image/jpeg" });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("resident-photos").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const fetchMyUnit = useCallback(async () => {
    if (!user) return;
    const { data } = await tenantDb.from("residents")
      .select("id, unit_id, society_id, resident_type")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();
    if (data) {
      setUnitId(data.unit_id);
      setSocietyId(data.society_id);
      setMyResidentId(data.id);
      setIsOwner(data.resident_type === "owner");
    }
  }, [user]);

  const fetchMembers = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const { data } = await tenantDb.from("residents")
      .select("id, full_name, phone, resident_type, relationship, date_of_birth, age, gender, status, photo_url")
      .eq("unit_id", unitId)
      .neq("resident_type", "tenant");
    // Sort: owner first, then others
    const sorted = (data || []).sort((a, b) => {
      if (a.resident_type === "owner" && b.resident_type !== "owner") return -1;
      if (a.resident_type !== "owner" && b.resident_type === "owner") return 1;
      return 0;
    });
    setMembers(sorted);
    setLoading(false);
  }, [unitId]);

  useEffect(() => { fetchMyUnit(); }, [fetchMyUnit]);
  useEffect(() => { if (unitId) fetchMembers(); }, [unitId, fetchMembers]);

  const openAdd = () => {
    setEditingMember(null);
    setForm(emptyForm);
    setCapturedImage(null);
    setPhotoBlob(null);
    setDialogOpen(true);
  };

  const openEdit = (m: FamilyMember) => {
    setEditingMember(m);
    setCapturedImage(m.photo_url || null);
    setPhotoBlob(null);
    const rel = ["spouse", "child", "parent", "sibling", "other"].includes(m.relationship || "") ? m.relationship! : (m.relationship ? "other" : "");
    const relOther = rel === "other" ? (m.relationship || "") : "";
    setForm({
      full_name: m.full_name,
      phone: m.phone || "",
      relationship: rel,
      relationship_other: relOther,
      date_of_birth: m.date_of_birth || "",
      age: m.age?.toString() || "",
      gender: m.gender || "",
      resident_type: m.resident_type,
      photo_url: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name) return;
    // Photo required for new members (non-edit)
    if (!editingMember && !capturedImage) {
      toast({ title: "Photo required", description: "Please capture a live photo.", variant: "destructive" });
      return;
    }
    setSaving(true);

    let photoUrl: string | null = null;
    try {
      photoUrl = await uploadPhoto();
    } catch (err: any) {
      toast({ title: "Photo upload failed", description: err.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const calculatedAge = form.date_of_birth
      ? Math.floor((Date.now() - new Date(form.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const payload: Record<string, any> = {
      full_name: form.full_name,
      phone: form.phone || null,
      relationship: form.relationship === "other" ? (form.relationship_other || "other") : (form.relationship || null),
      date_of_birth: form.date_of_birth || null,
      age: calculatedAge,
      gender: form.gender || null,
    };
    if (photoUrl) payload.photo_url = photoUrl;

    if (editingMember) {
      const updateData: Record<string, any> = {
        full_name: form.full_name,
        phone: form.phone || null,
        relationship: form.relationship === "other" ? (form.relationship_other || "other") : (form.relationship || null),
        date_of_birth: form.date_of_birth || null,
        age: calculatedAge,
        gender: form.gender || null,
      };
      if (photoUrl) updateData.photo_url = photoUrl;
      const { error } = await tenantDb.from("residents").update(updateData as any).eq("id", editingMember.id);
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Member updated" });
        setDialogOpen(false);
        fetchMembers();
      }
    } else {
      if (!unitId || !societyId) { setSaving(false); return; }
      const { error } = await tenantDb.from("residents").insert({
        full_name: form.full_name,
        phone: form.phone || null,
        relationship: form.relationship === "other" ? (form.relationship_other || "other") : (form.relationship || null),
        date_of_birth: form.date_of_birth || null,
        age: calculatedAge,
        gender: form.gender || null,
        photo_url: photoUrl,
        resident_type: "family",
        unit_id: unitId,
        society_id: societyId,
        user_id: user?.id,
        status: "pending" as const,
      });
      setSaving(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Family member added", description: "Pending approval." });
        setDialogOpen(false);
        setForm(emptyForm);
        fetchMembers();
      }
    }
  };

  const handleTransfer = async () => {
    if (!transferTargetId || !myResidentId || !user) return;
    setSaving(true);
    const result = await apiFetch("/api/residents/transfer-ownership", {
      method: "POST",
      body: JSON.stringify({
        current_owner_id: myResidentId,
        new_owner_id: transferTargetId,
        invoker_user_id: user.id,
      }),
    });
    setSaving(false);
    if (result.error) {
      toast({ title: "Transfer failed", description: result.error.message, variant: "destructive" });
    } else {
      toast({ title: "Ownership transferred!", description: "You are now a regular resident." });
      setTransferDialogOpen(false);
      setTransferTargetId(null);
      setIsOwner(false);
      fetchMembers();
      fetchMyUnit();
    }
  };

  const typeBadge = (type: string) => {
    const map: Record<string, string> = { owner: "bg-primary", tenant: "bg-id-tenant", family: "bg-id-resident" };
    return <Badge className={`${map[type] || "bg-muted"} text-white text-[10px] capitalize`}>{type}</Badge>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500" };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px] capitalize`}>{status}</Badge>;
  };

  return (
    <DashboardLayout title="My Family">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage family members linked to your flat.</p>
          <Button onClick={openAdd} size="sm">
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
              <Card key={m.id} className={`p-4 flex flex-col ${m.resident_type === "owner" ? "border-primary/40" : ""}`}>
                {/* Top row: Name + Edit */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {m.resident_type === "owner" && <Crown className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <p className="font-medium text-sm truncate">{m.full_name}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEdit(m)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {/* Content row: Details left, Photo right */}
                <div className="flex gap-3 flex-1">
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="text-xs text-muted-foreground space-y-1 flex-1">
                      <p className="capitalize">Relationship: {m.resident_type === "owner" ? "Self" : (m.relationship || "—")}</p>
                      {m.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</p>}
                      {m.gender && <p className="capitalize">Gender: {m.gender}</p>}
                      <p>Age: {m.age ?? (m.date_of_birth ? Math.floor((Date.now() - new Date(m.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "—")}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-auto pt-2">
                      {typeBadge(m.resident_type)} {statusBadge(m.status)}
                    </div>
                  </div>
                  {/* Photo: 3-line height (~54px) */}
                  <div className="shrink-0 self-start">
                    {m.photo_url ? (
                      <img
                        src={m.photo_url}
                        alt={m.full_name}
                        className="w-14 h-14 rounded-md object-cover border-2 border-border shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPhotoPreview({ url: m.photo_url!, name: m.full_name })}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center border-2 border-border">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
                {isOwner && m.resident_type !== "owner" && m.status === "approved" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs mt-2"
                    onClick={() => { setTransferTargetId(m.id); setTransferDialogOpen(true); }}
                  >
                    <ArrowRightLeft className="mr-1.5 h-3 w-3" /> Transfer Ownership
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingMember ? "Edit Member" : "Add Family Member"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <CameraCapture
              onCapture={(blob) => { setPhotoBlob(blob); setCapturedImage(URL.createObjectURL(blob)); }}
              capturedImage={capturedImage}
              onClear={() => { setCapturedImage(null); setPhotoBlob(null); }}
              required={!editingMember}
            />
            {!editingMember && !capturedImage && (
              <p className="text-xs text-destructive">A live photo is required for registration.</p>
            )}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Age</Label>
                <Input
                  type="number"
                  placeholder="Auto-calculated"
                  value={form.date_of_birth ? (Math.floor((Date.now() - new Date(form.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))).toString() : ""}
                  readOnly
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["male", "female", "other"].map((g) => (
                      <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !form.full_name || (!editingMember && !capturedImage)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingMember ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
            <DialogDescription>
              This action will transfer flat ownership to the selected member. You will become a regular resident and lose owner privileges (including voting rights).
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone by you. Only the new owner or an admin can reverse this.
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleTransfer} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Preview Modal */}
      <Dialog open={!!photoPreview} onOpenChange={() => setPhotoPreview(null)}>
        <DialogContent className="sm:max-w-lg p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>{photoPreview?.name}</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            <img
              src={photoPreview.url}
              alt={photoPreview.name}
              className="w-full h-auto max-h-[80vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyFamily;
