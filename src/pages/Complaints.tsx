import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Complaint {
  id: string;
  description: string;
  category: string | null;
  status: string;
  created_at: string;
}

const categories = ["Maintenance", "Noise", "Parking", "Security", "Cleanliness", "Other"];
const statuses = ["open", "in_progress", "resolved", "closed"];

const statusStyles: Record<string, string> = {
  open: "bg-warning/15 text-warning border-warning/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  resolved: "bg-success/15 text-success border-success/30",
  closed: "bg-muted text-muted-foreground border-muted",
};

const Complaints = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    const { data } = await tenantDb.from("complaints").select("*").order("created_at", { ascending: false });
    setComplaints(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const handleAdd = async () => {
    if (!description.trim()) return;
    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); setSaving(false); return; }
    const { error } = await tenantDb.from("complaints").insert({ description, category: category || null, society_id: societyId });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Complaint filed" }); setDescription(""); setCategory(""); setDialogOpen(false); fetchComplaints(); }
    setSaving(false);
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    const { error } = await tenantDb.from("complaints").update({ status: newStatus }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchComplaints();
  };

  const filtered = complaints.filter((c) => statusFilter === "all" || c.status === statusFilter);
  const stats = { total: complaints.length, open: complaints.filter((c) => c.status === "open").length, resolved: complaints.filter((c) => c.status === "resolved").length };

  return (
    <DashboardLayout title="Complaints">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Total", value: stats.total, cls: "text-foreground" }, { label: "Open", value: stats.open, cls: "text-warning" }, { label: "Resolved", value: stats.resolved, cls: "text-success" }].map((s) => (
            <Card key={s.label} className="p-4 text-center"><p className={`text-2xl font-bold font-display ${s.cls}`}>{s.value}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p></Card>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent></Select>
          <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> File Complaint</Button>
        </div>
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground"><MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No complaints found.</p></Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {c.category && <Badge variant="secondary" className="text-xs">{c.category}</Badge>}
                      <Badge variant="outline" className={`text-xs capitalize ${statusStyles[c.status]}`}>{c.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <Select value={c.status} onValueChange={(v) => handleStatusUpdate(c.id, v)}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace("_", " ")}</SelectItem>)}</SelectContent></Select>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">File Complaint</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Description *</Label><Textarea placeholder="Describe your complaint..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !description.trim()} className="gradient-primary text-primary-foreground">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Filing...</> : "File Complaint"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Complaints;
