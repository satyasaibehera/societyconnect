import { useState, useEffect } from "react";
import { Home, Users, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { PhoneInput, fullPhone } from "./PhoneInput";
import { OtpVerifyField } from "./OtpVerifyField";

interface Society {
  id: string;
  name: string;
  city: string | null;
}

interface UnitOption {
  id: string;
  unit_number: string;
  building_name: string;
  has_owner: boolean;
}

interface ResidentRegDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResidentRegDialog({ open, onOpenChange }: ResidentRegDialogProps) {
  const { toast } = useToast();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loadingSocieties, setLoadingSocieties] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    date_of_birth: "",
    society_id: "",
    unit_id: "",
    resident_type: "owner",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const fullPhoneNumber = fullPhone(countryCode, phoneNumber);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const phoneValid = /^\+\d{1,4}\d{7,12}$/.test(fullPhoneNumber);

  // Fetch active societies
  useEffect(() => {
    if (!open) return;
    const fetchSocieties = async () => {
      setLoadingSocieties(true);
      const { data } = await supabase
        .from("societies")
        .select("id, name, city")
        .eq("is_active", true)
        .order("name");
      setSocieties(data || []);
      setLoadingSocieties(false);
    };
    fetchSocieties();
  }, [open]);

  // Fetch units when society changes
  useEffect(() => {
    if (!form.society_id) { setUnits([]); return; }
    const fetchUnits = async () => {
      setLoadingUnits(true);
      // Get buildings for this society
      const { data: buildings } = await supabase
        .from("buildings")
        .select("id, name")
        .eq("society_id", form.society_id);

      if (!buildings || buildings.length === 0) {
        setUnits([]);
        setLoadingUnits(false);
        return;
      }

      const buildingIds = buildings.map((b) => b.id);
      const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));

      const { data: allUnits } = await supabase
        .from("units")
        .select("id, unit_number, building_id")
        .in("building_id", buildingIds);

      // Check which units have approved owners (via secure RPC — anon has no
      // direct read access to the residents table to protect PII).
      const { data: ownedUnits } = await supabase.rpc("get_owned_unit_ids", {
        _society_id: form.society_id,
      });

      const ownedUnitIds = new Set((ownedUnits || []).map((r: any) => r.unit_id));

      const unitOptions: UnitOption[] = (allUnits || []).map((u) => ({
        id: u.id,
        unit_number: u.unit_number,
        building_name: buildingMap[u.building_id] || "",
        has_owner: ownedUnitIds.has(u.id),
      }));

      unitOptions.sort((a, b) =>
        a.building_name.localeCompare(b.building_name) || a.unit_number.localeCompare(b.unit_number)
      );

      setUnits(unitOptions);
      setLoadingUnits(false);
    };
    fetchUnits();
    setForm((f) => ({ ...f, unit_id: "" }));
  }, [form.society_id]);

  const isOwner = form.resident_type === "owner";
  const availableUnits = isOwner
    ? units.filter((u) => !u.has_owner)
    : units.filter((u) => u.has_owner);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // strip data:image/...;base64,
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.society_id || !form.unit_id) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (!capturedImage) {
      toast({ title: "Photo required", description: "Please capture a live photo.", variant: "destructive" });
      return;
    }
    if (!emailVerified || !phoneVerified) {
      toast({ title: "Verify email and phone", description: "Both OTPs must be verified before submitting.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let photo_base64: string | null = null;
      if (photoBlob) {
        photo_base64 = await blobToBase64(photoBlob);
      }

      const { data, error } = await supabase.functions.invoke("register-account", {
        body: {
          type: "resident",
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: fullPhoneNumber,
          date_of_birth: form.date_of_birth,
          society_id: form.society_id,
          unit_id: form.unit_id,
          resident_type: form.resident_type,
          photo_base64,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Ensure no auto-login
      await signOut();
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSubmitted(false);
    setForm({ full_name: "", email: "", password: "", phone: "", date_of_birth: "", society_id: "", unit_id: "", resident_type: "owner" });
    setCapturedImage(null);
    setPhotoBlob(null);
    setEmailVerified(false);
    setPhoneVerified(false);
    setPhoneNumber("");
    setCountryCode("+91");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Register as Resident</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-lg font-bold">Registration Submitted!</h2>
            <p className="text-sm text-muted-foreground">
              Your resident registration is pending approval by the Society Admin.
              You'll be able to sign in once approved.
            </p>
            <Button onClick={resetAndClose} variant="outline" className="w-full">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account Details */}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Account Details</p>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Your full name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="your@email.com" value={form.email}
                  onChange={(e) => { update("email", e.target.value); setEmailVerified(false); }}
                  className="pl-10" disabled={emailVerified} />
              </div>
              <OtpVerifyField kind="email" target={form.email} canSend={emailValid} verified={emailVerified} onVerified={() => setEmailVerified(true)} />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="••••••••"
                  value={form.password} onChange={(e) => update("password", e.target.value)} className="pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <PhoneInput
                countryCode={countryCode}
                number={phoneNumber}
                onCountryChange={(c) => { setCountryCode(c); setPhoneVerified(false); }}
                onNumberChange={(n) => { setPhoneNumber(n); setPhoneVerified(false); }}
                disabled={phoneVerified}
              />
              <OtpVerifyField kind="phone" target={fullPhoneNumber} canSend={phoneValid} verified={phoneVerified} onVerified={() => setPhoneVerified(true)} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
            </div>

            {/* Society Selection */}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">Society & Flat</p>
            <div className="space-y-2">
              <Label>Select Society *</Label>
              {loadingSocieties ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3"><Loader2 className="h-4 w-4 animate-spin" /> Loading societies...</div>
              ) : societies.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No active societies found. A society must be registered and approved first.
                </div>
              ) : (
                <Select value={form.society_id} onValueChange={(v) => update("society_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Choose your society" /></SelectTrigger>
                  <SelectContent>
                    {societies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.city ? ` — ${s.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {form.society_id && (
              <>
                {/* Registration Type */}
                <div className="space-y-2">
                  <Label>I am registering as</Label>
                  <Select value={form.resident_type} onValueChange={(v) => setForm({ ...form, resident_type: v, unit_id: "" })}>
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
                <div className={`rounded-lg p-3 text-xs text-muted-foreground flex gap-2 ${isOwner ? "bg-primary/5 border border-primary/20" : "bg-accent/50 border border-accent"}`}>
                  <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    {isOwner
                      ? "As the flat owner, you'll be the primary contact. Only one owner per flat is allowed."
                      : "You can only register for a flat that already has an approved owner."}
                  </span>
                </div>

                {/* Unit Selection */}
                <div className="space-y-2">
                  <Label>Select Your Flat *</Label>
                  {loadingUnits ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3"><Loader2 className="h-4 w-4 animate-spin" /> Loading flats...</div>
                  ) : availableUnits.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      {isOwner
                        ? "All flats already have an owner registered."
                        : "No flats with an approved owner found. The flat owner must register first."}
                    </div>
                  ) : (
                    <Select value={form.unit_id} onValueChange={(v) => update("unit_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Choose your flat" /></SelectTrigger>
                      <SelectContent>
                        {availableUnits.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <span className="flex items-center gap-2">
                              {u.building_name} — {u.unit_number}
                              {u.has_owner && <Badge variant="secondary" className="text-[9px] ml-1">Owner verified</Badge>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            )}

            {/* Photo Capture */}
            <CameraCapture
              onCapture={(blob) => { setPhotoBlob(blob); setCapturedImage(URL.createObjectURL(blob)); }}
              capturedImage={capturedImage}
              onClear={() => { setCapturedImage(null); setPhotoBlob(null); }}
              required
            />
            {!capturedImage && <p className="text-xs text-destructive">A live photo is required to register.</p>}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={resetAndClose} className="flex-1">Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !form.full_name || !form.email || !form.password || !form.unit_id || !capturedImage || !emailVerified || !phoneVerified}
                className="flex-1 gradient-primary text-primary-foreground"
              >
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit Registration"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
