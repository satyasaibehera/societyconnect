import { useState, useEffect, useMemo } from "react";
import { Home, Users, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff, Mail, Lock, User, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { signOut } from "@/services/authService";
import { fetchActiveSocietiesDetailed, type SocietyListItem } from "@/services/societiesService";
import {
  fetchBuildingsForSociety,
  submitAdditionRequest,
  submitRegistration,
  type BuildingFlat,
  type BuildingWithFlats,
} from "@/services/buildingsService";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { PhoneInput, fullPhone } from "./PhoneInput";
import { OtpVerifyField } from "./OtpVerifyField";

type Society = SocietyListItem;

interface ResidentRegDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResidentRegDialog({ open, onOpenChange }: ResidentRegDialogProps) {
  const { toast } = useToast();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [buildings, setBuildings] = useState<BuildingWithFlats[]>([]);
  const [loadingSocieties, setLoadingSocieties] = useState(true);
  const [societiesError, setSocietiesError] = useState<string | null>(null);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAsTransfer, setSubmittedAsTransfer] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [ownershipDoc, setOwnershipDoc] = useState<File | null>(null);
  const [showAdditionForm, setShowAdditionForm] = useState(false);
  const [submittingAddition, setSubmittingAddition] = useState(false);
  const [additionForm, setAdditionForm] = useState<{
    requested_type: "building" | "flat";
    requested_name: string;
    notes: string;
  }>({
    requested_type: "building",
    requested_name: "",
    notes: "",
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    date_of_birth: "",
    society_id: "",
    building_id: "",
    flat_id: "",
    resident_type: "owner",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const fullPhoneNumber = fullPhone(countryCode, phoneNumber);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const phoneValid = /^\+\d{1,4}\d{7,12}$/.test(fullPhoneNumber);

  const isOwner = form.resident_type === "owner";

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === form.building_id) ?? null,
    [buildings, form.building_id],
  );

  const availableFlats: BuildingFlat[] = selectedBuilding?.flats ?? [];

  const selectedFlat = useMemo(
    () => availableFlats.find((f) => f.id === form.flat_id) ?? null,
    [availableFlats, form.flat_id],
  );

  const isOwnershipTransfer = Boolean(isOwner && selectedFlat?.is_occupied);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadSocieties = async () => {
      setLoadingSocieties(true);
      setSocietiesError(null);
      try {
        const result = await fetchActiveSocietiesDetailed();
        if (cancelled) return;
        setSocieties(result.societies);
        setSocietiesError(result.error);
        if (result.error) {
          toast({
            title: "Could not load societies",
            description: result.error,
            variant: "destructive",
          });
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load societies";
        setSocieties([]);
        setSocietiesError(message);
      } finally {
        if (!cancelled) setLoadingSocieties(false);
      }
    };

    loadSocieties();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load buildings (+ nested flats) from local GET /api/buildings
  useEffect(() => {
    if (!form.society_id) {
      setBuildings([]);
      return;
    }

    let cancelled = false;

    const loadBuildings = async () => {
      setLoadingBuildings(true);
      try {
        const list = await fetchBuildingsForSociety(form.society_id);
        if (!cancelled) setBuildings(list);
      } catch (err: unknown) {
        console.warn("[ResidentRegDialog] Failed to load /api/buildings:", err);
        if (!cancelled) {
          setBuildings([]);
          toast({
            title: "Could not load buildings",
            description: err instanceof Error ? err.message : "Failed to load buildings",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoadingBuildings(false);
      }
    };

    loadBuildings();
    setForm((f) => ({ ...f, building_id: "", flat_id: "" }));
    setOwnershipDoc(null);
    setShowAdditionForm(false);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.society_id]);

  useEffect(() => {
    if (!isOwnershipTransfer) setOwnershipDoc(null);
  }, [isOwnershipTransfer]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleBuildingChange = (buildingId: string) => {
    setForm((f) => ({ ...f, building_id: buildingId, flat_id: "" }));
    setOwnershipDoc(null);
  };

  const handleSubmitAddition = async () => {
    if (!form.society_id) {
      toast({ title: "Select a society first", variant: "destructive" });
      return;
    }
    if (!additionForm.requested_name.trim()) {
      toast({
        title: additionForm.requested_type === "building" ? "Building name is required" : "Flat number is required",
        variant: "destructive",
      });
      return;
    }

    setSubmittingAddition(true);
    try {
      await submitAdditionRequest({
        society_id: form.society_id,
        requested_type: additionForm.requested_type,
        requested_name: additionForm.requested_name.trim(),
        notes: additionForm.notes.trim() || undefined,
      });
      toast({
        title: "Request sent to admin",
        description: "We'll notify you once the building/flat is added.",
      });
      setAdditionForm({ requested_type: "building", requested_name: "", notes: "" });
      setShowAdditionForm(false);
    } catch (err: unknown) {
      toast({
        title: "Could not submit request",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmittingAddition(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.society_id || !form.building_id || !form.flat_id) {
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
    if (isOwnershipTransfer && !ownershipDoc) {
      toast({
        title: "Ownership proof required",
        description: "Upload Sale Deed or Tax Receipt to claim ownership transfer.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let supporting_document_base64: string | null = null;
      let supporting_document_content_type: string | null = null;
      if (ownershipDoc) {
        supporting_document_base64 = await blobToBase64(ownershipDoc);
        supporting_document_content_type = ownershipDoc.type || "application/octet-stream";
      }

      // Local Express API: POST /api/register
      await submitRegistration({
        society_id: form.society_id,
        building_id: form.building_id,
        flat_id: form.flat_id,
        full_name: form.full_name,
        phone_number: fullPhoneNumber,
        is_ownership_transfer: isOwnershipTransfer,
        supporting_document_base64,
        supporting_document_content_type,
      });

      setSubmittedAsTransfer(isOwnershipTransfer);
      await signOut();
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      toast({ title: "Registration failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSubmitted(false);
    setSubmittedAsTransfer(false);
    setForm({
      full_name: "",
      email: "",
      password: "",
      phone: "",
      date_of_birth: "",
      society_id: "",
      building_id: "",
      flat_id: "",
      resident_type: "owner",
    });
    setBuildings([]);
    setCapturedImage(null);
    setPhotoBlob(null);
    setEmailVerified(false);
    setPhoneVerified(false);
    setPhoneNumber("");
    setCountryCode("+91");
    setOwnershipDoc(null);
    setShowAdditionForm(false);
    setAdditionForm({ requested_type: "building", requested_name: "", notes: "" });
    onOpenChange(false);
  };

  const submitDisabled =
    submitting ||
    !form.full_name ||
    !form.email ||
    !form.password ||
    !form.building_id ||
    !form.flat_id ||
    !capturedImage ||
    !emailVerified ||
    !phoneVerified ||
    (isOwnershipTransfer && !ownershipDoc);

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
            <h2 className="font-display text-lg font-bold">
              {submittedAsTransfer ? "Ownership Transfer Claim Submitted!" : "Registration Submitted!"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Your request is pending approval by the Society Admin.
              You'll be able to sign in once approved.
            </p>
            <Button onClick={resetAndClose} variant="outline" className="w-full">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
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

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">Society & Flat</p>
            <div className="space-y-2">
              <Label>Select Society *</Label>
              {loadingSocieties ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3"><Loader2 className="h-4 w-4 animate-spin" /> Loading societies...</div>
              ) : societies.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground space-y-1">
                  <p>No active societies found. A society must be registered and approved first.</p>
                  {societiesError && (
                    <p className="text-xs text-destructive">API error: {societiesError}</p>
                  )}
                </div>
              ) : (
                <Select value={form.society_id} onValueChange={(v) => update("society_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Choose your society" /></SelectTrigger>
                  <SelectContent>
                    {societies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.code ? ` (${s.code})` : s.city ? ` — ${s.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {form.society_id && (
              <>
                <div className="space-y-2">
                  <Label>I am registering as</Label>
                  <Select
                    value={form.resident_type}
                    onValueChange={(v) => setForm({ ...form, resident_type: v, flat_id: "" })}
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

                <div className={`rounded-lg p-3 text-xs text-muted-foreground flex gap-2 ${isOwner ? "bg-primary/5 border border-primary/20" : "bg-accent/50 border border-accent"}`}>
                  <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    {isOwner
                      ? "Choose building then flat. An occupied flat as Flat Owner starts an ownership transfer claim."
                      : "Family members can register for any flat; society admin will review your request."}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label>Select Building *</Label>
                  {loadingBuildings ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading buildings...
                    </div>
                  ) : buildings.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No buildings found for this society yet.
                    </div>
                  ) : (
                    <Select value={form.building_id} onValueChange={handleBuildingChange}>
                      <SelectTrigger><SelectValue placeholder="Choose your building" /></SelectTrigger>
                      <SelectContent>
                        {buildings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({b.flats.length} flat{b.flats.length === 1 ? "" : "s"})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {form.building_id && (
                  <div className="space-y-2">
                    <Label>Select Flat *</Label>
                    {availableFlats.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No flats found in this building.
                      </div>
                    ) : (
                      <Select value={form.flat_id} onValueChange={(v) => update("flat_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Choose your flat" /></SelectTrigger>
                        <SelectContent>
                          {availableFlats.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              <span className="flex items-center gap-2">
                                {f.flat_number}
                                {f.is_occupied && (
                                  <Badge variant="secondary" className="text-[9px] ml-1">Occupied</Badge>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    className="text-sm text-primary font-medium hover:underline"
                    onClick={() => setShowAdditionForm((v) => !v)}
                  >
                    Can&apos;t find your building/flat?
                  </button>
                </div>

                {showAdditionForm && (
                  <div className="space-y-3 rounded-lg border border-dashed p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Request Addition — society admin will review and add the missing building or flat.
                    </p>
                    <div className="space-y-2">
                      <Label>What&apos;s missing? *</Label>
                      <Select
                        value={additionForm.requested_type}
                        onValueChange={(v: "building" | "flat") =>
                          setAdditionForm((f) => ({ ...f, requested_type: v, requested_name: "" }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="building">Building</SelectItem>
                          <SelectItem value="flat">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {additionForm.requested_type === "building" ? "Building name *" : "Flat number *"}
                      </Label>
                      <Input
                        placeholder={
                          additionForm.requested_type === "building" ? "e.g. Tower B" : "e.g. B-1204"
                        }
                        value={additionForm.requested_name}
                        onChange={(e) =>
                          setAdditionForm((f) => ({ ...f, requested_name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Textarea
                        placeholder="Any extra details for admin"
                        value={additionForm.notes}
                        onChange={(e) => setAdditionForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={submittingAddition}
                      onClick={handleSubmitAddition}
                      className="w-full"
                    >
                      {submittingAddition ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                      ) : (
                        "Submit Request to Admin"
                      )}
                    </Button>
                  </div>
                )}

                {isOwnershipTransfer && (
                  <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <Label htmlFor="ownership-doc">
                      Proof of Ownership (Sale Deed / Tax Receipt) *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      This flat is marked occupied. Upload proof to submit an ownership transfer claim.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        id="ownership-doc"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                        onChange={(e) => setOwnershipDoc(e.target.files?.[0] ?? null)}
                        className="cursor-pointer"
                      />
                      <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    {ownershipDoc && (
                      <p className="text-xs text-muted-foreground truncate">Selected: {ownershipDoc.name}</p>
                    )}
                  </div>
                )}
              </>
            )}

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
                disabled={submitDisabled}
                className="flex-1 gradient-primary text-primary-foreground"
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : isOwnershipTransfer ? (
                  "Submit Ownership Transfer Claim"
                ) : (
                  "Submit Registration"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
