import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Plus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Meeting {
  id: string;
  title: string;
  agenda: string | null;
  meeting_date: string | null;
  created_at: string;
}

const Meetings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("meetings").select("*").order("meeting_date", { ascending: false });
    setMeetings(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); setSaving(false); return; }
    const { error } = await supabase.from("meetings").insert({ title, agenda: agenda || null, meeting_date: meetingDate || null, society_id: societyId, created_by: user?.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Meeting scheduled" }); setTitle(""); setAgenda(""); setMeetingDate(""); setDialogOpen(false); fetchMeetings(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Meeting deleted" }); fetchMeetings(); }
  };

  const isUpcoming = (date: string | null) => date && new Date(date) > new Date();

  return (
    <DashboardLayout title="Meetings & AGM">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">{meetings.length} meeting{meetings.length !== 1 && "s"}</p>
          <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Schedule Meeting</Button>
        </div>
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : meetings.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground"><Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No meetings scheduled.</p></Card>
        ) : (
          <div className="grid gap-4">
            {meetings.map((m) => (
              <Card key={m.id} className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-semibold">{m.title}</h3>
                      {m.meeting_date && <Badge variant={isUpcoming(m.meeting_date) ? "default" : "secondary"} className="text-xs">{isUpcoming(m.meeting_date) ? "Upcoming" : "Past"}</Badge>}
                    </div>
                    {m.meeting_date && <p className="text-sm text-primary font-medium">{new Date(m.meeting_date).toLocaleString()}</p>}
                    {m.agenda && <p className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap">{m.agenda}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Schedule Meeting</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Title *</Label><Input placeholder="e.g. Monthly AGM" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Date & Time</Label><Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Agenda</Label><Textarea placeholder="Meeting agenda..." rows={4} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !title.trim()} className="gradient-primary text-primary-foreground">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scheduling...</> : "Schedule"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Meetings;
