import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export interface VehicleFormData {
  vehicle_number: string;
  vehicle_type: string;
  parking_slot: string;
  resident_id: string;
}

interface Resident { id: string; full_name: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: VehicleFormData) => Promise<void>;
  residents: Resident[];
  initialData?: VehicleFormData | null;
  mode: "add" | "edit";
}

const vehicleTypes = ["Car", "Bike", "Scooter", "Bicycle", "Other"];

export function VehicleFormDialog({ open, onOpenChange, onSubmit, residents, initialData, mode }: Props) {
  const [form, setForm] = useState<VehicleFormData>({ vehicle_number: "", vehicle_type: "Car", parking_slot: "", resident_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) setForm(initialData);
    else setForm({ vehicle_number: "", vehicle_type: "Car", parking_slot: "", resident_id: "" });
  }, [initialData, open]);

  const handleSubmit = async () => {
    if (!form.vehicle_number.trim()) return;
    setSaving(true);
    try { await onSubmit(form); onOpenChange(false); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{mode === "add" ? "Register Vehicle" : "Edit Vehicle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehicle Number *</Label>
              <Input placeholder="MH01AB1234" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parking Slot</Label>
              <Input placeholder="e.g. A-12" value={form.parking_slot} onChange={(e) => setForm({ ...form, parking_slot: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Owner (Resident)</Label>
              <Select value={form.resident_id} onValueChange={(v) => setForm({ ...form, resident_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
                <SelectContent>
                  {residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.vehicle_number.trim()} className="gradient-primary text-primary-foreground">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : mode === "add" ? "Register" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
