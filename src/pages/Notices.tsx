import { useState, useEffect, useCallback } from "react";
import { getSocietyId } from "@/lib/society";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Loader2, Trash2, FileText, Users, CheckSquare, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Notice {
  id: string;
  title: string;
  description: string | null;
  notice_type: string;
  meeting_date: string | null;
  attendees: string | null;
  key_decisions: string | null;
  action_items: string | null;
  created_at: string;
}

type NoticeType = "notice" | "meeting_minutes" | "circular";

const typeLabels: Record<string, string> = {
  notice: "Notice",
  meeting_minutes: "Meeting Minutes",
  circular: "Circular",
};

const typeBadgeColors: Record<string, string> = {
  notice: "bg-primary",
  meeting_minutes: "bg-amber-600",
  circular: "bg-emerald-600",
};

const Notices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Form state
  const [noticeType, setNoticeType] = useState<NoticeType>("notice");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [keyDecisions, setKeyDecisions] = useState("");
  const [actionItems, setActionItems] = useState("");

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });
    setNotices((data as Notice[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const resetForm = () => {
    setNoticeType("notice");
    setTitle("");
    setDescription("");
    setMeetingDate("");
    setAttendees("");
    setKeyDecisions("");
    setActionItems("");
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); setSaving(false); return; }

    const payload: Record<string, any> = {
      title,
      description: description || null,
      notice_type: noticeType,
      society_id: societyId,
      created_by: user?.id,
    };

    if (noticeType === "meeting_minutes") {
      payload.meeting_date = meetingDate || null;
      payload.attendees = attendees || null;
      payload.key_decisions = keyDecisions || null;
      payload.action_items = actionItems || null;
    }

    const { error } = await supabase.from("notices").insert(payload);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: `${typeLabels[noticeType]} posted` }); resetForm(); setDialogOpen(false); fetchNotices(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); fetchNotices(); }
  };

  const filtered = activeTab === "all" ? notices : notices.filter((n) => n.notice_type === activeTab);

  return (
    <DashboardLayout title="Notice Board">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="notice">Notices</TabsTrigger>
              <TabsTrigger value="meeting_minutes">Minutes</TabsTrigger>
              <TabsTrigger value="circular">Circulars</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gradient-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> New Post
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">{filtered.length} item{filtered.length !== 1 && "s"}</p>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No {activeTab === "all" ? "posts" : typeLabels[activeTab]?.toLowerCase() || "posts"} yet.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((n) => (
              <Card key={n.id} className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`${typeBadgeColors[n.notice_type] || "bg-muted"} text-white text-[10px]`}>
                        {typeLabels[n.notice_type] || n.notice_type}
                      </Badge>
                      {n.meeting_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(n.meeting_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-semibold text-lg">{n.title}</h3>
                    {n.description && <p className="text-muted-foreground text-sm mt-1 whitespace-pre-wrap">{n.description}</p>}

                    {/* Meeting minutes structured fields */}
                    {n.notice_type === "meeting_minutes" && (
                      <div className="mt-3 space-y-2 text-sm">
                        {n.attendees && (
                          <div className="flex items-start gap-2">
                            <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Attendees</p>
                              <p className="whitespace-pre-wrap">{n.attendees}</p>
                            </div>
                          </div>
                        )}
                        {n.key_decisions && (
                          <div className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Key Decisions</p>
                              <p className="whitespace-pre-wrap">{n.key_decisions}</p>
                            </div>
                          </div>
                        )}
                        {n.action_items && (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Action Items</p>
                              <p className="whitespace-pre-wrap">{n.action_items}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8 shrink-0" onClick={() => handleDelete(n.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">New Post</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={noticeType} onValueChange={(v) => setNoticeType(v as NoticeType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="notice">Notice</SelectItem>
                  <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                  <SelectItem value="circular">Circular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Details..." rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {noticeType === "meeting_minutes" && (
              <>
                <div className="space-y-2">
                  <Label>Meeting Date</Label>
                  <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Attendees</Label>
                  <Textarea placeholder="List of attendees..." rows={2} value={attendees} onChange={(e) => setAttendees(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Key Decisions</Label>
                  <Textarea placeholder="Decisions taken in the meeting..." rows={3} value={keyDecisions} onChange={(e) => setKeyDecisions(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Action Items</Label>
                  <Textarea placeholder="Follow-up actions with owners..." rows={3} value={actionItems} onChange={(e) => setActionItems(e.target.value)} />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !title.trim()} className="gradient-primary text-primary-foreground">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</> : "Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Notices;
