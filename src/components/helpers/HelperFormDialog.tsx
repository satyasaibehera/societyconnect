import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface HelperFormData {
  name: string;
  phone: string;
  service_type: string;
  unit_ids: string[];
}

interface Unit {
  id: string;
  unit_number: string;
  building_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HelperFormData) => Promise<void>;
  units: Unit[];
  initialData?: HelperFormData | null;
  mode: "add" | "edit";
}

const serviceTypes = ["Maid", "Cook", "Driver", "Gardener", "Plumber", "Electrician", "Nanny", "Other"];

export function HelperFormDialog({ open, onOpenChange, onSubmit, units, initialData, mode }: Props) {
  const [form, setForm] = useState<HelperFormData>({ name: "", phone: "", service_type: "", unit_ids: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) setForm(initialData);
    else setForm({ name: "", phone: "", service_type: "", unit_ids: [] });
  }, [initialData, open]);

  const toggleUnit = (unitId: string) => {
    setForm((prev) => ({
      ...prev,
      unit_ids: prev.unit_ids.includes(unitId)
        ? prev.unit_ids.filter((id) => id !== unitId)
        : [...prev.unit_ids, unitId],
    }));
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
          <DialogTitle className="font-display">{mode === "add" ? "Add Helper" : "Edit Helper"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input placeholder="Enter helper name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+91 9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assigned Units</Label>
            <Select onValueChange={toggleUnit} value="">
              <SelectTrigger><SelectValue placeholder="Add unit..." /></SelectTrigger>
              <SelectContent>
                {units.filter((u) => !form.unit_ids.includes(u.id)).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.building_name} - {u.unit_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.unit_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.unit_ids.map((uid) => {
                  const u = units.find((x) => x.id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1 pr-1">
                      {u ? `${u.building_name} - ${u.unit_number}` : uid}
                      <button onClick={() => toggleUnit(uid)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.name.trim()} className="gradient-primary text-primary-foreground">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : mode === "add" ? "Add Helper" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
