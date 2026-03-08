import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Vote, Plus, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Poll {
  id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  votes: { vote_option: string }[];
}

const Voting = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("polls").select("*, votes(vote_option)").order("created_at", { ascending: false });
    setPolls(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); setSaving(false); return; }
    const now = new Date();
    const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
    const { error } = await supabase.from("polls").insert({ title, description: description || null, society_id: societyId, created_by: user?.id, start_time: now.toISOString(), end_time: endTime.toISOString() });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Poll created" }); setTitle(""); setDescription(""); setDialogOpen(false); fetchPolls(); }
    setSaving(false);
  };

  const handleVote = async (pollId: string, option: "yes" | "no") => {
    setVoting(pollId);
    const { error } = await supabase.from("votes").insert({ poll_id: pollId, vote_option: option });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Vote recorded!" }); fetchPolls(); }
    setVoting(null);
  };

  const getVoteStats = (poll: Poll) => {
    const yes = poll.votes.filter((v) => v.vote_option === "yes").length;
    const no = poll.votes.filter((v) => v.vote_option === "no").length;
    const total = yes + no;
    return { yes, no, total, yesPercent: total > 0 ? (yes / total) * 100 : 0 };
  };

  const isActive = (poll: Poll) => {
    if (!poll.end_time) return true;
    return new Date(poll.end_time) > new Date();
  };

  return (
    <DashboardLayout title="Digital Voting">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">{polls.length} poll{polls.length !== 1 && "s"}</p>
          <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Create Poll</Button>
        </div>
        {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : polls.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground"><Vote className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No polls yet.</p></Card>
        ) : (
          <div className="grid gap-4">
            {polls.map((p) => {
              const stats = getVoteStats(p);
              const active = isActive(p);
              return (
                <Card key={p.id} className="p-5">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold">{p.title}</h3>
                        <Badge variant={active ? "default" : "secondary"} className="text-xs">{active ? "Active" : "Closed"}</Badge>
                      </div>
                      {p.description && <p className="text-muted-foreground text-sm">{p.description}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">{stats.total} vote{stats.total !== 1 && "s"}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm"><span className="text-success">Yes ({stats.yes})</span><span className="text-destructive">No ({stats.no})</span></div>
                    <Progress value={stats.yesPercent} className="h-2" />
                  </div>
                  {active && (
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" className="flex-1 text-success border-success/30 hover:bg-success/10" onClick={() => handleVote(p.id, "yes")} disabled={voting === p.id}><CheckCircle className="mr-1 h-4 w-4" /> Yes</Button>
                      <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleVote(p.id, "no")} disabled={voting === p.id}>No</Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Create Poll</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Question *</Label><Input placeholder="e.g. Should we renovate the gym?" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Additional details..." rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !title.trim()} className="gradient-primary text-primary-foreground">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Poll"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Voting;
