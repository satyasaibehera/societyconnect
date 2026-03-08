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
import { Loader2 } from "lucide-react";

export interface VisitorFormData {
  name: string;
  phone: string;
  purpose: string;
  visiting_unit_id: string;
  visiting_unit_label: string;
}

interface Unit {
  id: string;
  unit_number: string;
  building_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: VisitorFormData) => Promise<void>;
  units: Unit[];
  initialData?: VisitorFormData | null;
  mode: "add" | "edit";
}

export function VisitorFormDialog({ open, onOpenChange, onSubmit, units, initialData, mode }: Props) {
  const [form, setForm] = useState<VisitorFormData>({
    name: "", phone: "", purpose: "", visiting_unit_id: "", visiting_unit_label: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) setForm(initialData);
    else setForm({ name: "", phone: "", purpose: "", visiting_unit_id: "", visiting_unit_label: "" });
  }, [initialData, open]);

  const handleUnitChange = (unitId: string) => {
    const unit = units.find((u) => u.id === unitId);
    setForm({ ...form, visiting_unit_id: unitId, visiting_unit_label: unit ? `${unit.building_name} - ${unit.unit_number}` : "" });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSubmit(form); onOpenChange(false); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{mode === "add" ? "Add Visitor" : "Edit Visitor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Visitor Name *</Label>
            <Input placeholder="Enter visitor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+91 9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Visiting Unit</Label>
              <Select value={form.visiting_unit_id} onValueChange={handleUnitChange}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.building_name} - {u.unit_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Input placeholder="e.g. Delivery, Guest, Maintenance" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.name.trim()} className="gradient-primary text-primary-foreground">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : mode === "add" ? "Add Visitor" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
