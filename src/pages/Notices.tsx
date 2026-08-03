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
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

interface NoticeType {
  id: string;
  name: string;
  label: string;
  color: string;
  has_structured_fields: boolean;
  sort_order: number;
}

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

const Notices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isManagement } = useUserRole();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeTypes, setNoticeTypes] = useState<NoticeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Form state
  const [selectedType, setSelectedType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [keyDecisions, setKeyDecisions] = useState("");
  const [actionItems, setActionItems] = useState("");

  const fetchNoticeTypes = useCallback(async () => {
    const sid = await getSocietyId();
    if (!sid) return;
    const { data } = await tenantDb.from("notice_types")
      .select("*")
      .eq("society_id", sid)
      .eq("is_active", true)
      .order("sort_order");
    const types = (data as NoticeType[]) || [];
    setNoticeTypes(types);
    if (types.length > 0 && !selectedType) setSelectedType(types[0].name);
  }, []);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await tenantDb.from("notices")
      .select("*")
      .order("created_at", { ascending: false });
    setNotices((data as Notice[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNoticeTypes(); }, [fetchNoticeTypes]);
  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const resetForm = () => {
    setSelectedType(noticeTypes[0]?.name || "notice");
    setTitle("");
    setDescription("");
    setMeetingDate("");
    setAttendees("");
    setKeyDecisions("");
    setActionItems("");
  };

  const getTypeConfig = (name: string) => noticeTypes.find((t) => t.name === name);
  const currentTypeConfig = getTypeConfig(selectedType);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); setSaving(false); return; }

    const payload: Record<string, any> = {
      title,
      description: description || null,
      notice_type: selectedType,
      society_id: societyId,
      created_by: user?.id,
    };

    if (currentTypeConfig?.has_structured_fields) {
      payload.meeting_date = meetingDate || null;
      payload.attendees = attendees || null;
      payload.key_decisions = keyDecisions || null;
      payload.action_items = actionItems || null;
    }

    const { error } = await tenantDb.from("notices").insert(payload as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: `${getTypeConfig(selectedType)?.label || "Post"} published` }); resetForm(); setDialogOpen(false); fetchNotices(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await tenantDb.from("notices").delete().eq("id", id);
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
              {noticeTypes.map((t) => (
                <TabsTrigger key={t.name} value={t.name}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {isManagement && (
            <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gradient-primary text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" /> New Post
            </Button>
          )}
        </div>

        <p className="text-muted-foreground text-sm">{filtered.length} item{filtered.length !== 1 && "s"}</p>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No posts yet.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((n) => {
              const tc = getTypeConfig(n.notice_type);
              return (
                <Card key={n.id} className="p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`${tc?.color || "bg-muted"} text-white text-[10px]`}>
                          {tc?.label || n.notice_type}
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

                      {tc?.has_structured_fields && (
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
                    {isManagement && (
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8 shrink-0" onClick={() => handleDelete(n.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
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
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {noticeTypes.map((t) => (
                    <SelectItem key={t.name} value={t.name}>{t.label}</SelectItem>
                  ))}
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

            {currentTypeConfig?.has_structured_fields && (
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
                  <Textarea placeholder="Decisions taken..." rows={3} value={keyDecisions} onChange={(e) => setKeyDecisions(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Action Items</Label>
                  <Textarea placeholder="Follow-up actions..." rows={3} value={actionItems} onChange={(e) => setActionItems(e.target.value)} />
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
