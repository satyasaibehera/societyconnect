import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClipboardList, Plus, Loader2, Pencil, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NoticeTypeRow {
  id: string;
  name: string;
  label: string;
  color: string;
  has_structured_fields: boolean;
  is_active: boolean;
  sort_order: number;
}

const COLOR_OPTIONS = [
  { value: "bg-primary", label: "Primary" },
  { value: "bg-amber-600", label: "Amber" },
  { value: "bg-emerald-600", label: "Green" },
  { value: "bg-blue-600", label: "Blue" },
  { value: "bg-rose-600", label: "Rose" },
  { value: "bg-violet-600", label: "Violet" },
  { value: "bg-orange-600", label: "Orange" },
  { value: "bg-teal-600", label: "Teal" },
];

const emptyForm = { name: "", label: "", color: "bg-primary", has_structured_fields: false };

export const NoticeTypeManager = () => {
  const { toast } = useToast();
  const [types, setTypes] = useState<NoticeTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NoticeTypeRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    const sid = await getSocietyId();
    if (!sid) { setLoading(false); return; }
    const { data } = await supabase
      .from("notice_types")
      .select("*")
      .eq("society_id", sid)
      .order("sort_order");
    setTypes((data as NoticeTypeRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: NoticeTypeRow) => {
    setEditing(t);
    setForm({ name: t.name, label: t.label, color: t.color, has_structured_fields: t.has_structured_fields });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.label.trim()) return;
    setSaving(true);
    const sid = await getSocietyId();
    if (!sid) { setSaving(false); return; }

    if (editing) {
      const { error } = await supabase
        .from("notice_types")
        .update({ label: form.label, color: form.color, has_structured_fields: form.has_structured_fields } as any)
        .eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Updated" });
    } else {
      const { error } = await supabase
        .from("notice_types")
        .insert({
          society_id: sid,
          name: form.name.toLowerCase().replace(/\s+/g, "_"),
          label: form.label,
          color: form.color,
          has_structured_fields: form.has_structured_fields,
          sort_order: types.length,
        } as any);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Notice type added" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchTypes();
  };

  const toggleActive = async (t: NoticeTypeRow) => {
    const { error } = await supabase
      .from("notice_types")
      .update({ is_active: !t.is_active } as any)
      .eq("id", t.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchTypes();
  };

  const handleDelete = async (t: NoticeTypeRow) => {
    const { error } = await supabase.from("notice_types").delete().eq("id", t.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); fetchTypes(); }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Notice Types
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Configure notice categories available on the Notice Board.</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Type
        </Button>
      </div>

      {types.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notice types configured.</p>
      ) : (
        <div className="space-y-2">
          {types.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Badge className={`${t.color} text-white text-[10px] shrink-0`}>{t.label}</Badge>
                <span className="text-xs text-muted-foreground truncate">{t.name}</span>
                {t.has_structured_fields && (
                  <Badge variant="secondary" className="text-[10px]">Structured</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(t)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Notice Type" : "Add Notice Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Internal Name *</Label>
              <Input
                placeholder="e.g. agm_minutes"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!!editing}
              />
              {editing && <p className="text-xs text-muted-foreground">Internal name cannot be changed.</p>}
            </div>
            <div className="space-y-2">
              <Label>Display Label *</Label>
              <Input placeholder="e.g. AGM Minutes" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Badge Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`h-8 px-3 rounded text-white text-xs font-medium transition-all ${c.value} ${form.color === c.value ? "ring-2 ring-offset-2 ring-primary" : "opacity-70 hover:opacity-100"}`}
                    onClick={() => setForm({ ...form, color: c.value })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.has_structured_fields}
                onCheckedChange={(v) => setForm({ ...form, has_structured_fields: v })}
              />
              <div>
                <Label className="text-sm">Structured Fields</Label>
                <p className="text-xs text-muted-foreground">Enable meeting date, attendees, key decisions, and action items fields.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.label.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
