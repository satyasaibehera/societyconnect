import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Home, Users, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/camera/CameraCapture";

interface UnitOption {
  id: string;
  unit_number: string;
  building_name: string;
  has_owner: boolean;
}

const RegisterResident = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    date_of_birth: "",
    unit_id: "",
    resident_type: "owner",
  });

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

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      // Check if user already has a resident record
      const { data: existing } = await tenantDb.from("residents")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setAlreadyRegistered(true);
        setLoading(false);
        return;
      }

      const { data: allUnits } = await tenantDb.from("units")
        .select("id, unit_number, building_id");

      if (!allUnits || allUnits.length === 0) {
        setUnits([]);
        setLoading(false);
        return;
      }

      const buildingIds = [...new Set(allUnits.map((u) => u.building_id).filter(Boolean) as string[])];
      const { data: buildingsData } = buildingIds.length
        ? await tenantDb.from("buildings").select("id, name").in("id", buildingIds)
        : { data: [] as { id: string; name: string }[] };
      const buildingMap = new Map(buildingsData?.map((b) => [b.id, b.name]) ?? []);

      const { data: ownedUnits } = await tenantDb.from("residents")
        .select("unit_id")
        .eq("resident_type", "owner")
        .eq("status", "approved");

      const ownedUnitIds = new Set(ownedUnits?.map((r) => r.unit_id) || []);

      const unitOptions: UnitOption[] = allUnits.map((u) => ({
        id: u.id,
        unit_number: u.unit_number,
        building_name: u.building_id ? buildingMap.get(u.building_id) || "" : "",
        has_owner: ownedUnitIds.has(u.id),
      }));

      // Sort: buildings first, then unit number
      unitOptions.sort((a, b) =>
        a.building_name.localeCompare(b.building_name) || a.unit_number.localeCompare(b.unit_number)
      );

      setUnits(unitOptions);

      // Pre-fill name from profile
      const { data: profile } = await tenantDb.from("profiles")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setForm((f) => ({
          ...f,
          full_name: profile.full_name || "",
          phone: profile.phone || "",
        }));
      }

      setLoading(false);
    };

    init();
  }, [user]);

  const selectedUnit = units.find((u) => u.id === form.unit_id);
  const isOwnerRegistration = form.resident_type === "owner";

  // For non-owner registration, only show units that have an approved owner
  const availableUnits = isOwnerRegistration
    ? units.filter((u) => !u.has_owner) // Owner: only units WITHOUT an owner
    : units.filter((u) => u.has_owner); // Family: only units WITH an approved owner

  const handleSubmit = async () => {
    if (!form.full_name || !form.unit_id || !user) return;
    if (!capturedImage) {
      toast({ title: "Photo required", description: "Please capture a live photo.", variant: "destructive" });
      return;
    }

    if (isOwnerRegistration && selectedUnit?.has_owner) {
      toast({ title: "This unit already has an approved owner", variant: "destructive" });
      return;
    }
    if (!isOwnerRegistration && selectedUnit && !selectedUnit.has_owner) {
      toast({ title: "This unit has no approved owner yet", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    let photoUrl: string | null = null;
    try {
      photoUrl = await uploadPhoto();
    } catch (err: any) {
      toast({ title: "Photo upload failed", description: err.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const { data: unitRow } = await tenantDb.from("units")
      .select("building_id")
      .eq("id", form.unit_id)
      .single();

    let societyId: string | null = null;
    if (unitRow?.building_id) {
      const { data: buildingRow } = await tenantDb.from("buildings")
        .select("society_id")
        .eq("id", unitRow.building_id)
        .maybeSingle();
      societyId = buildingRow?.society_id ?? null;
    }
    if (!societyId) {
      toast({ title: "Could not determine society", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const { error } = await tenantDb.from("residents").insert({
      full_name: form.full_name,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      unit_id: form.unit_id,
      society_id: societyId,
      resident_type: form.resident_type,
      user_id: user.id,
      photo_url: photoUrl,
      status: "pending" as const,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Registration submitted!",
        description: isOwnerRegistration
          ? "Your ownership registration is pending admin approval."
          : "Your registration is pending owner & admin approval.",
      });
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (alreadyRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold">Already Registered</h2>
          <p className="text-sm text-muted-foreground">
            You already have a resident record. Check your dashboard for status updates.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="gradient-primary text-primary-foreground">
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Register as Resident</h1>
          <p className="text-muted-foreground mt-1">Join your society by registering for your flat</p>
        </div>

        <Card className="p-6 space-y-5">
          {/* Registration Type */}
          <div className="space-y-2">
            <Label>I am registering as</Label>
            <Select
              value={form.resident_type}
              onValueChange={(v) => setForm({ ...form, resident_type: v, unit_id: "" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">
                  <span className="flex items-center gap-2"><Home className="h-4 w-4" /> Flat Owner</span>
                </SelectItem>
                <SelectItem value="family">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Family Member</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info banner */}
          {isOwnerRegistration ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground flex gap-2">
              <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                As the flat owner, you'll be the primary contact. Once approved by the admin, your family
                members can register under your flat. Only one owner per flat is allowed.
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-id-tenant/5 border border-id-tenant/20 p-3 text-xs text-muted-foreground flex gap-2">
              <AlertCircle className="h-4 w-4 text-id-tenant shrink-0 mt-0.5" />
              <span>
                You can only register for a flat that already has an approved owner.
                Your registration will need approval from the admin.
              </span>
            </div>
          )}

          <CameraCapture
            onCapture={(blob) => { setPhotoBlob(blob); setCapturedImage(URL.createObjectURL(blob)); }}
            capturedImage={capturedImage}
            onClear={() => { setCapturedImage(null); setPhotoBlob(null); }}
            required
          />
          {!capturedImage && (
            <p className="text-xs text-destructive">A live photo is required to register.</p>
          )}

          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </div>

          {/* Unit Selection */}
          <div className="space-y-2">
            <Label>Select Your Flat *</Label>
            {availableUnits.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {isOwnerRegistration
                  ? "All flats already have an owner registered."
                  : "No flats with an approved owner found. The flat owner must register and be approved first."}
              </div>
            ) : (
              <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose your flat" /></SelectTrigger>
                <SelectContent>
                  {availableUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-2">
                        {u.unit_number}
                        {u.has_owner && (
                          <Badge variant="secondary" className="text-[9px] ml-1">Owner verified</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.full_name || !form.unit_id}
            className="w-full gradient-primary text-primary-foreground"
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              "Submit Registration"
            )}
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Already registered?{" "}
          <button onClick={() => navigate("/dashboard")} className="text-primary font-medium hover:underline">
            Go to Dashboard
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterResident;
