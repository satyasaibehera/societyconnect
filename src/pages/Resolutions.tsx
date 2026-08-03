import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Plus, Loader2, Trash2 } from "lucide-react";
import { tenantDb } from "@/services/tenantDb";
import { useToast } from "@/hooks/use-toast";

interface Resolution {
  id: string;
  title: string;
  description: string | null;
  decision_date: string | null;
  created_at: string;
}

const Resolutions = () => {
  const { toast } = useToast();
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchResolutions = useCallback(async () => {
    setLoading(true);
    const { data } = await tenantDb.from("resolutions").select("*").order("decision_date", { ascending: false });
    setResolutions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchResolutions(); }, [fetchResolutions]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); setSaving(false); return; }
    const { error } = await tenantDb.from("resolutions").insert({ title, description: description || null, decision_date: decisionDate || null, society_id: societyId });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Resolution recorded" }); setTitle(""); setDescription(""); setDecisionDate(""); setDialogOpen(false); fetchResolutions(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await tenantDb.from("resolutions").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Resolution deleted" }); fetchResolutions(); }
  };

  return (
    <DashboardLayout title="Resolutions">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">{resolutions.length} resolution{resolutions.length !== 1 && "s"}</p>
          <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Record Resolution</Button>
        </div>
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : resolutions.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No resolutions yet.</p></Card>
        ) : (
          <div className="grid gap-4">
            {resolutions.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-display font-semibold">{r.title}</h3>
                    {r.decision_date && <p className="text-xs text-primary mt-1">Decision Date: {new Date(r.decision_date).toLocaleDateString()}</p>}
                    {r.description && <p className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap">{r.description}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Record Resolution</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Title *</Label><Input placeholder="Resolution title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Decision Date</Label><Input type="date" value={decisionDate} onChange={(e) => setDecisionDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Resolution details..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !title.trim()} className="gradient-primary text-primary-foreground">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : "Record"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Resolutions;
