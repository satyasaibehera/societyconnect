import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Plus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Notice {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

const Notices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("notices").select("*").order("created_at", { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); setSaving(false); return; }
    const { error } = await supabase.from("notices").insert({ title, description: description || null, society_id: societyId, created_by: user?.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Notice posted" }); setTitle(""); setDescription(""); setDialogOpen(false); fetchNotices(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Notice deleted" }); fetchNotices(); }
  };

  return (
    <DashboardLayout title="Notice Board">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">{notices.length} notice{notices.length !== 1 && "s"}</p>
          <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Post Notice</Button>
        </div>
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : notices.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground"><ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No notices yet.</p></Card>
        ) : (
          <div className="grid gap-4">
            {notices.map((n) => (
              <Card key={n.id} className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-lg">{n.title}</h3>
                    {n.description && <p className="text-muted-foreground text-sm mt-1 whitespace-pre-wrap">{n.description}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Post Notice</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Title *</Label><Input placeholder="Notice title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Details..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !title.trim()} className="gradient-primary text-primary-foreground">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</> : "Post Notice"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Notices;
