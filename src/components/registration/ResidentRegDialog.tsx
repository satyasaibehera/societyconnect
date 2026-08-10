import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Users, AlertCircle, Loader2, CheckCircle2, Mail, Lock, User, Upload } from "lucide-react";
import {
  PasswordVisibilityIcon,
  passwordInputTypeFromVisible,
} from "@/components/ui/password-visibility-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { signOut, signUp } from "@/services/authService";
import { fetchActiveSocietiesDetailed } from "@/services/societiesService";
import type { SocietyListItem } from "@/types/society";
import {
  fetchBuildingsForSociety,
  submitRegistration,
  type BuildingFlat,
  type BuildingWithFlats,
} from "@/services/buildingsService";
import { ensurePendingResidentForUser } from "@/services/residentRegistrationService";
import { AUTH_MESSAGES, isDuplicateRegistrationError } from "@/lib/authErrors";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { PhoneInput, fullPhone } from "./PhoneInput";

type Society = SocietyListItem;

const REQUEST_NEW_BUILDING = "__request_new_building__";
const REQUEST_NEW_FLAT = "__request_new_flat__";

const SubjectToApprovalNote = () => (
  <Badge
    variant="outline"
    className="text-[10px] font-normal text-amber-800 border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800"
  >
    * Subject to approval
  </Badge>
);

interface ResidentRegDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResidentRegDialog({ open, onOpenChange }: ResidentRegDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [ownershipDoc, setOwnershipDoc] = useState<File | null>(null);
  const [submittedWaitingForFlat, setSubmittedWaitingForFlat] = useState(false);
  const [customBuildingName, setCustomBuildingName] = useState("");
  const [customFlatNumber, setCustomFlatNumber] = useState("");
  const [requestNotes, setRequestNotes] = useState("");

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
  const requestingNewBuilding = form.building_id === REQUEST_NEW_BUILDING;
  const requestingNewFlat = requestingNewBuilding || form.flat_id === REQUEST_NEW_FLAT;
  const isRequestMode = requestingNewBuilding || requestingNewFlat;

  const selectedBuilding = useMemo(
    () =>
      !requestingNewBuilding
        ? buildings.find((b) => b.id === form.building_id) ?? null
        : null,
    [buildings, form.building_id, requestingNewBuilding],
  );

  const availableFlats: BuildingFlat[] = selectedBuilding?.flats ?? [];

  const selectedFlat = useMemo(
    () =>
      !requestingNewFlat
        ? availableFlats.find((f) => f.id === form.flat_id) ?? null
        : null,
    [availableFlats, form.flat_id, requestingNewFlat],
  );

  const isOwnershipTransfer = Boolean(!isRequestMode && isOwner && selectedFlat?.is_occupied);

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
    setCustomBuildingName("");
    setCustomFlatNumber("");
    setRequestNotes("");

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
    setOwnershipDoc(null);
    if (buildingId === REQUEST_NEW_BUILDING) {
      setForm((f) => ({ ...f, building_id: REQUEST_NEW_BUILDING, flat_id: REQUEST_NEW_FLAT }));
      setCustomFlatNumber("");
      return;
    }
    setForm((f) => ({ ...f, building_id: buildingId, flat_id: "" }));
    setCustomBuildingName("");
  };

  const handleFlatChange = (flatId: string) => {
    setOwnershipDoc(null);
    if (flatId === REQUEST_NEW_FLAT) {
      setForm((f) => ({ ...f, flat_id: REQUEST_NEW_FLAT }));
      return;
    }
    setForm((f) => ({ ...f, flat_id: flatId }));
    setCustomFlatNumber("");
  };

  const resolvedBuildingNameForRequest = (): string => {
    if (requestingNewBuilding) return customBuildingName.trim();
    return selectedBuilding?.name?.trim() || "";
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.society_id) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!emailValid) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    if (!phoneValid) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }

    if (isRequestMode) {
      const buildingName = resolvedBuildingNameForRequest();
      const flatNumber = customFlatNumber.trim();
      if (!buildingName || !flatNumber) {
        toast({
          title: requestingNewBuilding
            ? "Building name and flat number are required"
            : "Flat number is required",
          variant: "destructive",
        });
        return;
      }
    } else if (!form.building_id || !form.flat_id) {
      toast({ title: "Please select a building and flat", variant: "destructive" });
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
      let supporting_document_url: string | null = null;
      if (ownershipDoc) {
        supporting_document_base64 = await blobToBase64(ownershipDoc);
        supporting_document_content_type = ownershipDoc.type || "application/octet-stream";
        supporting_document_url = `data:${supporting_document_content_type};base64,${supporting_document_base64}`;
      }

      const buildingName = isRequestMode ? resolvedBuildingNameForRequest() : selectedBuilding?.name || null;
      const flatNumber = isRequestMode
        ? customFlatNumber.trim()
        : selectedFlat?.flat_number || null;
      const unitId = isRequestMode ? null : form.flat_id;

      const emailRedirectTo = `${window.location.origin}/auth/callback`;

      const { data: signUpData, error: signUpError } = await signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo,
          data: {
            full_name: form.full_name.trim(),
            phone: fullPhoneNumber,
            registration: {
              society_id: form.society_id,
              unit_id: unitId,
              building_id: requestingNewBuilding ? null : form.building_id || null,
              resident_type: form.resident_type,
              date_of_birth: form.date_of_birth || null,
              phone: fullPhoneNumber,
              full_name: form.full_name.trim(),
              email: form.email.trim(),
              request_new_flat: isRequestMode,
              building_name: buildingName,
              flat_number: flatNumber,
              notes: requestNotes.trim() || null,
              is_ownership_transfer: isOwnershipTransfer,
              supporting_document_url,
            },
          },
        },
      });

      if (signUpError) throw signUpError;

      const userId = signUpData?.user?.id;
      if (userId && signUpData?.session) {
        // Session present (email confirm disabled) — create pending resident now.
        const { error: ensureError } = await ensurePendingResidentForUser(userId);
        if (ensureError) {
          console.warn("[ResidentRegDialog] ensurePendingResident:", ensureError.message);
        }
      }

      // Keep Neon flat-request / registration_requests in sync for admin workflows.
      try {
        if (isRequestMode) {
          await submitRegistration({
            society_id: form.society_id,
            full_name: form.full_name,
            phone_number: fullPhoneNumber,
            email: form.email,
            resident_type: form.resident_type,
            request_new_flat: true,
            building_name: buildingName || "",
            flat_number: flatNumber || "",
            notes: requestNotes.trim() || undefined,
          });
          setSubmittedWaitingForFlat(true);
        } else {
          await submitRegistration({
            society_id: form.society_id,
            building_id: form.building_id,
            flat_id: form.flat_id,
            full_name: form.full_name,
            phone_number: fullPhoneNumber,
            email: form.email,
            resident_type: form.resident_type,
            is_ownership_transfer: isOwnershipTransfer,
            supporting_document_base64,
            supporting_document_content_type,
          });
          setSubmittedWaitingForFlat(false);
        }
      } catch (neonErr) {
        console.warn("[ResidentRegDialog] Neon register sync failed:", neonErr);
      }

      setSubmittedAsTransfer(isOwnershipTransfer);
      await signOut();
      setSubmitted(true);
      toast({
        title: "Registration Submitted!",
        description:
          "We have sent a confirmation link to your email address. Please check your inbox.",
      });
    } catch (err: unknown) {
      if (isDuplicateRegistrationError(err)) {
        toast({ description: AUTH_MESSAGES.duplicateRegistration });
        onOpenChange(false);
        navigate("/login");
        return;
      }
      const message = err instanceof Error ? err.message : "Registration failed";
      toast({ title: "Registration failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSubmitted(false);
    setSubmittedAsTransfer(false);
    setSubmittedWaitingForFlat(false);
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
    setPhoneNumber("");
    setCountryCode("+91");
    setOwnershipDoc(null);
    setCustomBuildingName("");
    setCustomFlatNumber("");
    setRequestNotes("");
    onOpenChange(false);
  };

  const requestFieldsValid = requestingNewBuilding
    ? Boolean(customBuildingName.trim() && customFlatNumber.trim())
    : requestingNewFlat
      ? Boolean(form.building_id && form.building_id !== REQUEST_NEW_BUILDING && customFlatNumber.trim())
      : true;

  const existingSelectionValid = !isRequestMode && Boolean(form.building_id && form.flat_id);

  const submitDisabled =
    submitting ||
    !form.full_name ||
    !form.email ||
    !emailValid ||
    !form.password ||
    !form.society_id ||
    !phoneValid ||
    !capturedImage ||
    (isRequestMode ? !requestFieldsValid : !existingSelectionValid) ||
    (isOwnershipTransfer && !ownershipDoc);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col">
        <div className="sticky top-0 z-10 shrink-0 bg-background border-b px-6 pt-6 pb-3 pr-12">
          <DialogHeader>
            <DialogTitle className="font-display">Register as Resident</DialogTitle>
          </DialogHeader>
          {!submitted && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-3">
              Account Details
            </p>
          )}
        </div>

        {submitted ? (
          <div className="overflow-y-auto max-h-[70vh] px-6 py-4">
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-lg font-bold">Registration Submitted!</h2>
              <p className="text-sm text-muted-foreground">
                We have sent a confirmation link to your email address. Please check your inbox.
                {submittedWaitingForFlat
                  ? " After verifying your email, your flat request will await society admin approval."
                  : submittedAsTransfer
                    ? " After verifying your email, your ownership transfer claim will await society admin approval."
                    : " After verifying your email, your request will await society admin approval."}
              </p>
              <Button onClick={resetAndClose} variant="outline" className="w-full">Close</Button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[70vh] px-6 py-4 space-y-4">
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
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="••••••••"
                  value={form.password} onChange={(e) => update("password", e.target.value)} className="pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {/*showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />*/}
                  <PasswordVisibilityIcon inputType={showPassword ? 'text' : 'password'} className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <PhoneInput
                countryCode={countryCode}
                number={phoneNumber}
                onCountryChange={setCountryCode}
                onNumberChange={setPhoneNumber}
              />
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
                    onValueChange={(v) => setForm({ ...form, resident_type: v, flat_id: requestingNewBuilding ? REQUEST_NEW_FLAT : "" })}
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

                <div className="rounded-lg p-3 text-xs flex gap-2 border bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                  <span>
                    {isOwner
                      ? "All available flats are currently registered with an Owner. Kindly review the list and either request for a transfer of ownership by submitting relevant documentations or request for adding a missing flat number to the society admin."
                      : "Family members may register for a flat once the primary owner has registered it. Please note that access will be granted upon approval by the flat owner or society admin."}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label>Select Building</Label>
                  {loadingBuildings ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading buildings...
                    </div>
                  ) : (
                    <Select value={form.building_id || undefined} onValueChange={handleBuildingChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your building" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({b.flats.length} flat{b.flats.length === 1 ? "" : "s"})
                            </span>
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value={REQUEST_NEW_BUILDING} className="text-primary font-medium">
                          + Request new building
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {requestingNewBuilding && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 flex-wrap">
                      New Building Name
                      <SubjectToApprovalNote />
                    </Label>
                    <Input
                      placeholder="e.g. Tower B"
                      value={customBuildingName}
                      onChange={(e) => setCustomBuildingName(e.target.value)}
                    />
                  </div>
                )}

                {(form.building_id || requestingNewBuilding) && (
                  <div className="space-y-2">
                    <Label>Select Flat</Label>
                    {requestingNewBuilding ? (
                      <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        + Request new flat
                      </div>
                    ) : (
                      <Select value={form.flat_id || undefined} onValueChange={handleFlatChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose your flat" />
                        </SelectTrigger>
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
                          <SelectSeparator />
                          <SelectItem value={REQUEST_NEW_FLAT} className="text-primary font-medium">
                            + Request new flat
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {requestingNewFlat && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 flex-wrap">
                      New Flat Number
                      <SubjectToApprovalNote />
                    </Label>
                    <Input
                      placeholder="e.g. B-1204"
                      value={customFlatNumber}
                      onChange={(e) => setCustomFlatNumber(e.target.value)}
                    />
                  </div>
                )}

                {isRequestMode && (
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      placeholder="Any extra details for admin"
                      value={requestNotes}
                      onChange={(e) => setRequestNotes(e.target.value)}
                      rows={2}
                    />
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
                  "Submit Request to Admin"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
