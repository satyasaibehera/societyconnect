import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Award, UserPlus, MoreHorizontal, Pencil, Trash2, Loader2, ShieldCheck, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSocietyId } from "@/lib/society";

const DESIGNATIONS = [
  { value: "president", label: "President" },
  { value: "vice_president", label: "Vice President" },
  { value: "secretary", label: "Secretary" },
  { value: "joint_secretary", label: "Joint Secretary" },
  { value: "treasurer", label: "Treasurer" },
  { value: "joint_treasurer", label: "Joint Treasurer" },
  { value: "ward_leader", label: "Ward Leader" },
] as const;

interface OfficeBearerRow {
  id: string;
  user_id: string;
  designation: string;
  is_approver: boolean;
  phone: string | null;
  created_at: string;
  profileName?: string;
}

const OfficeBearers = () => {
  const { toast } = useToast();
  const [bearers, setBearers] = useState<OfficeBearerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [formDesignation, setFormDesignation] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formApprover, setFormApprover] = useState(false);
  const [formUserId, setFormUserId] = useState("");
  const [saving, setSaving] = useState(false);

  // Available residents to pick from
  const [residents, setResidents] = useState<{ id: string; user_id: string; name: string }[]>([]);

  const fetchBearers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("office_bearers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch profile names
    const userIds = (data || []).map((b: any) => b.user_id);
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      profiles?.forEach((p) => profileMap.set(p.user_id, p.full_name || ""));
    }

    setBearers(
      (data || []).map((b: any) => ({
        ...b,
        profileName: profileMap.get(b.user_id) || "Unknown",
      }))
    );
    setLoading(false);
  }, [toast]);

  const fetchResidents = useCallback(async () => {
    const { data } = await supabase
      .from("residents")
      .select("id, user_id, full_name")
      .eq("status", "approved")
      .not("user_id", "is", null);
    setResidents(
      (data || []).map((r) => ({ id: r.id, user_id: r.user_id!, name: r.full_name }))
    );
  }, []);

  useEffect(() => {
    fetchBearers();
    fetchResidents();
  }, [fetchBearers, fetchResidents]);

  const resetForm = () => {
    setFormDesignation("");
    setFormPhone("");
    setFormApprover(false);
    setFormUserId("");
    setEditId(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (b: OfficeBearerRow) => {
    setEditId(b.id);
    setFormDesignation(b.designation);
    setFormPhone(b.phone || "");
    setFormApprover(b.is_approver);
    setFormUserId(b.user_id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formDesignation) {
      toast({ title: "Please select a designation", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase
          .from("office_bearers")
          .update({
            designation: formDesignation as any,
            phone: formPhone || null,
            is_approver: formApprover,
          })
          .eq("id", editId);
        if (error) throw error;
        toast({ title: "Updated", description: "Office bearer updated." });
      } else {
        if (!formUserId) {
          toast({ title: "Please enter a user ID", variant: "destructive" });
          setSaving(false);
          return;
        }
        const societyId = await getSocietyId();
        if (!societyId) {
          toast({ title: "No society found", variant: "destructive" });
          setSaving(false);
          return;
        }
        const { error } = await supabase
          .from("office_bearers")
          .insert({
            user_id: formUserId,
            society_id: societyId,
            designation: formDesignation as any,
            phone: formPhone || null,
            is_approver: formApprover,
          });
        if (error) throw error;
        toast({ title: "Added", description: "Office bearer added." });
      }
      setDialogOpen(false);
      resetForm();
      fetchBearers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApprover = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("office_bearers")
      .update({ is_approver: !current })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "Approver enabled" : "Approver disabled" });
      fetchBearers();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("office_bearers").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed", description: `${name} removed.` });
      fetchBearers();
    }
  };

  const filtered = bearers.filter(
    (b) =>
      (b.profileName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      b.designation.includes(search.toLowerCase()) ||
      (b.phone?.includes(search) ?? false)
  );

  const formatDesignation = (d: string) =>
    d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <DashboardLayout title="Office Bearers">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4 text-center border-t-4 border-id-office-bearer">
            <p className="text-2xl font-bold font-display text-id-office-bearer">{bearers.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Bearers</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold font-display text-success">{bearers.filter((b) => b.is_approver).length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approvers</p>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 sm:max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or designation..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={openAdd} className="gradient-primary text-primary-foreground">
            <UserPlus className="mr-2 h-4 w-4" /> Add Office Bearer
          </Button>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "No bearers match your search." : "No office bearers yet."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Approver</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.profileName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-id-office-bearer border-id-office-bearer capitalize">
                        {formatDesignation(b.designation)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.phone || "—"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={b.is_approver}
                          onCheckedChange={() => handleToggleApprover(b.id, b.is_approver)}
                        />
                        {b.is_approver && (
                          <ShieldCheck className="h-4 w-4 text-success" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(b)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(b.id, b.profileName || "bearer")}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editId ? "Edit Office Bearer" : "Add Office Bearer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editId && (
              <div className="space-y-2">
                <Label>Resident</Label>
                <Select value={formUserId} onValueChange={setFormUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a resident..." />
                  </SelectTrigger>
                  <SelectContent>
                    {residents.map((r) => (
                      <SelectItem key={r.user_id} value={r.user_id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Designation</Label>
              <Select value={formDesignation} onValueChange={setFormDesignation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select designation..." />
                </SelectTrigger>
                <SelectContent>
                  {DESIGNATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="Phone number"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Approver Capability</p>
                <p className="text-xs text-muted-foreground">
                  Can approve residents, helpers, visitors etc.
                </p>
              </div>
              <Switch checked={formApprover} onCheckedChange={setFormApprover} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OfficeBearers;
