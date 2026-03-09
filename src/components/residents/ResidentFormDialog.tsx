import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, CalendarIcon, Search } from "lucide-react";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { supabase } from "@/integrations/supabase/client";

export interface ResidentFormData {
  full_name: string;
  phone: string;
  email: string;
  resident_type: string;
  date_of_birth: string;
  unit_id: string;
  photo_url?: string;
}

interface Unit {
  id: string;
  unit_number: string;
  building_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ResidentFormData) => Promise<void>;
  units: Unit[];
  initialData?: ResidentFormData | null;
  mode: "add" | "edit";
  isAdmin?: boolean;
}

export function ResidentFormDialog({ open, onOpenChange, onSubmit, units, initialData, mode, isAdmin }: Props) {
  const [form, setForm] = useState<ResidentFormData>({
    full_name: "",
    phone: "",
    email: "",
    resident_type: "owner",
    date_of_birth: "",
    unit_id: "",
    photo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [dobDate, setDobDate] = useState<Date | undefined>(undefined);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
      if (initialData.date_of_birth) {
        setDobDate(new Date(initialData.date_of_birth));
      }
      if (initialData.photo_url) {
        setCapturedImage(initialData.photo_url);
      } else {
        setCapturedImage(null);
      }
      setPhotoBlob(null);
      const selectedUnit = units.find((u) => u.id === initialData.unit_id);
      if (selectedUnit) setUnitSearch(selectedUnit.unit_number);
    } else {
      setForm({ full_name: "", phone: "", email: "", resident_type: "owner", date_of_birth: "", unit_id: "", photo_url: "" });
      setDobDate(undefined);
      setUnitSearch("");
      setCapturedImage(null);
      setPhotoBlob(null);
    }
  }, [initialData, open, units]);

  const handleDobSelect = (date: Date | undefined) => {
    setDobDate(date);
    setForm({ ...form, date_of_birth: date ? format(date, "yyyy-MM-dd") : "" });
  };

  const filteredUnits = unitSearch.trim()
    ? units.filter((u) =>
        u.unit_number.toLowerCase().includes(unitSearch.toLowerCase()) ||
        u.building_name.toLowerCase().includes(unitSearch.toLowerCase())
      )
    : units;

  const handlePhotoCapture = (blob: Blob) => {
    setPhotoBlob(blob);
    setCapturedImage(URL.createObjectURL(blob));
  };

  const handlePhotoClear = () => {
    setCapturedImage(null);
    setPhotoBlob(null);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoBlob) return form.photo_url || null;

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const filePath = `photos/${fileName}`;

    const { error } = await supabase.storage
      .from("resident-photos")
      .upload(filePath, photoBlob, { contentType: "image/jpeg" });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("resident-photos")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim()) return;

    // Photo is mandatory unless admin
    if (!isAdmin && !capturedImage) return;

    setSaving(true);
    try {
      const photoUrl = await uploadPhoto();
      await onSubmit({ ...form, photo_url: photoUrl || "" });
      onOpenChange(false);
    } catch (err: any) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const photoMissing = !isAdmin && !capturedImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "add" ? "Add Resident" : "Edit Resident"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Camera Capture */}
          <CameraCapture
            onCapture={handlePhotoCapture}
            capturedImage={capturedImage}
            onClear={handlePhotoClear}
            required={!isAdmin}
          />
          {photoMissing && (
            <p className="text-xs text-destructive">A live photo is required for registration.</p>
          )}

          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              placeholder="Enter full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="resident@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="+91 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dobDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dobDate ? format(dobDate, "dd MMM yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dobDate}
                    onSelect={handleDobSelect}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Resident Type</Label>
              <Select value={form.resident_type} onValueChange={(v) => setForm({ ...form, resident_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="family">Family Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit / Flat Number</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.unit_id && "text-muted-foreground"
                    )}
                  >
                    {form.unit_id
                      ? units.find((u) => u.id === form.unit_id)?.unit_number || "Selected"
                      : "Search or select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Type flat number..."
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filteredUnits.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No units match "{unitSearch}"</p>
                    ) : (
                      filteredUnits.slice(0, 50).map((u) => (
                        <button
                          key={u.id}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors",
                            form.unit_id === u.id && "bg-accent font-medium"
                          )}
                          onClick={() => {
                            setForm({ ...form, unit_id: u.id });
                            setUnitSearch(u.unit_number);
                          }}
                        >
                          <span className="font-mono text-xs">{u.unit_number}</span>
                          <span className="text-muted-foreground text-xs ml-1.5">({u.building_name})</span>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.full_name.trim() || photoMissing}
              className="gradient-primary text-primary-foreground"
            >
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : mode === "add" ? "Add Resident" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
