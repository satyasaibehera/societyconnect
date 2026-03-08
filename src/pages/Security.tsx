import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield, UserPlus, Search, MoreHorizontal, Pencil, Trash2, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SecurityStaffFormDialog, SecurityStaffFormData } from "@/components/security/SecurityStaffFormDialog";

interface Staff {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

const Security = () => {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{ id: string; form: SecurityStaffFormData } | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("security_staff").select("*").order("created_at", { ascending: false });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    setStaff(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const { getSocietyId } = await import("@/lib/society");


  const handleAdd = async (form: SecurityStaffFormData) => {
    const societyId = await getSocietyId();
    if (!societyId) { toast({ title: "No society found", variant: "destructive" }); return; }
    const { error } = await supabase.from("security_staff").insert({ name: form.name, phone: form.phone || null, society_id: societyId });
    if (error) throw error;
    toast({ title: "Staff added", description: `${form.name} has been added.` });
    fetchStaff();
  };

  const handleEdit = async (form: SecurityStaffFormData) => {
    if (!editData) return;
    const { error } = await supabase.from("security_staff").update({ name: form.name, phone: form.phone || null }).eq("id", editData.id);
    if (error) throw error;
    toast({ title: "Staff updated" });
    setEditData(null);
    fetchStaff();
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("security_staff").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Removed", description: `${name} has been removed.` }); fetchStaff(); }
  };

  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone?.includes(search) ?? false)
  );

  return (
    <DashboardLayout title="Security Staff">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold font-display">{staff.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Staff</p>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 sm:max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => { setEditData(null); setDialogOpen(true); }} className="gradient-primary text-primary-foreground">
            <UserPlus className="mr-2 h-4 w-4" /> Add Staff
          </Button>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "No staff match your search." : "No security staff yet."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditData({ id: s.id, form: { name: s.name, phone: s.phone || "" } }); setDialogOpen(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(s.id, s.name)} className="text-destructive focus:text-destructive">
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

      <SecurityStaffFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditData(null); }}
        onSubmit={editData ? handleEdit : handleAdd}
        initialData={editData?.form ?? null}
        mode={editData ? "edit" : "add"}
      />
    </DashboardLayout>
  );
};

export default Security;
