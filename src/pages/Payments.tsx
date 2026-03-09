import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, IndianRupee, Trash2, QrCode, CreditCard, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSocietyId } from "@/lib/society";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface PaymentCategory {
  id: string;
  name: string;
  description: string | null;
  amount: number | null;
  amount_min: number | null;
  amount_max: number | null;
  is_fixed_amount: boolean;
  due_day: number | null;
  frequency: string;
  upi_id: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface PaymentRecord {
  id: string;
  payer_user_id: string;
  payment_type: string;
  amount: number;
  transaction_ref: string | null;
  notes: string | null;
  status: string;
  declared_at: string;
  verified_at: string | null;
  rejection_reason: string | null;
  period_label: string | null;
  category_id: string | null;
}

const emptyForm = {
  name: "",
  description: "",
  amount: "",
  amount_min: "",
  amount_max: "",
  is_fixed_amount: true,
  due_day: "",
  frequency: "monthly",
  upi_id: "",
  account_holder_name: "",
  account_number: "",
  ifsc_code: "",
  bank_name: "",
};

export default function Payments() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const societyId = await getSocietyId();
    if (!societyId) return;

    const [catRes, recRes] = await Promise.all([
      supabase
        .from("payment_categories")
        .select("*")
        .eq("society_id", societyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_records")
        .select("*")
        .eq("society_id", societyId)
        .eq("payment_type", "society")
        .order("declared_at", { ascending: false })
        .limit(100),
    ]);

    setCategories((catRes.data as PaymentCategory[]) || []);
    setRecords((recRes.data as PaymentRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (cat: PaymentCategory) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      description: cat.description || "",
      amount: cat.amount?.toString() || "",
      amount_min: cat.amount_min?.toString() || "",
      amount_max: cat.amount_max?.toString() || "",
      is_fixed_amount: cat.is_fixed_amount,
      due_day: cat.due_day?.toString() || "",
      frequency: cat.frequency,
      upi_id: cat.upi_id || "",
      account_holder_name: cat.account_holder_name || "",
      account_number: cat.account_number || "",
      ifsc_code: cat.ifsc_code || "",
      bank_name: cat.bank_name || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Error", description: "Category name is required.", variant: "destructive" });
      return;
    }
    if (!form.upi_id.trim()) {
      toast({ title: "Error", description: "UPI ID is required for QR generation.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const societyId = await getSocietyId();
    if (!societyId) { setSaving(false); return; }

    const payload = {
      society_id: societyId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      amount: form.is_fixed_amount && form.amount ? parseFloat(form.amount) : null,
      amount_min: !form.is_fixed_amount && form.amount_min ? parseFloat(form.amount_min) : null,
      amount_max: !form.is_fixed_amount && form.amount_max ? parseFloat(form.amount_max) : null,
      is_fixed_amount: form.is_fixed_amount,
      due_day: form.due_day ? parseInt(form.due_day) : null,
      frequency: form.frequency,
      upi_id: form.upi_id.trim(),
      account_holder_name: form.account_holder_name.trim() || null,
      account_number: form.account_number.trim() || null,
      ifsc_code: form.ifsc_code.trim() || null,
      bank_name: form.bank_name.trim() || null,
      created_by: user?.id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("payment_categories").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("payment_categories").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Category Updated" : "Category Created" });
      setDialogOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const toggleActive = async (cat: PaymentCategory) => {
    await supabase.from("payment_categories").update({ is_active: !cat.is_active }).eq("id", cat.id);
    fetchData();
  };

  const handleVerify = async (recordId: string, approve: boolean, reason?: string) => {
    const update: Record<string, unknown> = {
      status: approve ? "verified" : "rejected",
      verified_by: user?.id,
      verified_at: new Date().toISOString(),
    };
    if (!approve && reason) update.rejection_reason = reason;

    const { error } = await supabase.from("payment_records").update(update).eq("id", recordId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: approve ? "Payment Verified" : "Payment Rejected" });
      fetchData();
    }
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "—";
    return categories.find((c) => c.id === catId)?.name || "Unknown";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <DashboardLayout title="Payment Management">
      <div className="space-y-6">
        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">Payment Categories</TabsTrigger>
            <TabsTrigger value="records">Payment Records</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Society Payment Categories</h2>
                <p className="text-sm text-muted-foreground">Configure payment types, amounts, and bank details for QR generation.</p>
              </div>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>

            {categories.length === 0 && !loading ? (
              <Card className="p-8 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium">No payment categories yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first category to start collecting payments.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {categories.map((cat) => (
                  <Card key={cat.id} className={!cat.is_active ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{cat.name}</CardTitle>
                          {cat.description && (
                            <CardDescription className="mt-1">{cat.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cat.is_active ? "default" : "secondary"}>
                            {cat.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="flex items-center gap-1">
                          <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                          {cat.is_fixed_amount
                            ? `₹${cat.amount?.toLocaleString() || "—"}`
                            : `₹${cat.amount_min?.toLocaleString() || "0"} – ₹${cat.amount_max?.toLocaleString() || "∞"}`}
                        </span>
                        <span className="capitalize text-muted-foreground">{cat.frequency}</span>
                        {cat.due_day && (
                          <span className="text-muted-foreground">Due: {cat.due_day}th</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <QrCode className="h-3 w-3" />
                        UPI: {cat.upi_id || "Not set"}
                        {cat.bank_name && ` • ${cat.bank_name}`}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(cat)}>
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(cat)}>
                          {cat.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="records" className="space-y-4 mt-4">
            <div>
              <h2 className="text-lg font-semibold">Payment Records</h2>
              <p className="text-sm text-muted-foreground">Review and verify payments declared by residents.</p>
            </div>

            {records.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No payment records yet.</p>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Transaction Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-medium">{getCategoryName(rec.category_id)}</TableCell>
                        <TableCell>₹{rec.amount.toLocaleString()}</TableCell>
                        <TableCell>{rec.period_label || "—"}</TableCell>
                        <TableCell className="text-xs">{rec.transaction_ref || "—"}</TableCell>
                        <TableCell className="text-xs">{format(new Date(rec.declared_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>{statusBadge(rec.status)}</TableCell>
                        <TableCell>
                          {rec.status === "declared" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleVerify(rec.id, true)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verify
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleVerify(rec.id, false, "Payment not found")}>
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Category Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Create"} Payment Category</DialogTitle>
            <DialogDescription>Configure the payment details and bank info for QR generation.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Category Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Monthly Maintenance" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" rows={2} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_fixed_amount} onCheckedChange={(v) => setForm({ ...form, is_fixed_amount: v })} />
                <Label>{form.is_fixed_amount ? "Fixed Amount" : "Flexible Amount (range)"}</Label>
              </div>
              {form.is_fixed_amount ? (
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g., 5000" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Min (₹)</Label>
                    <Input type="number" value={form.amount_min} onChange={(e) => setForm({ ...form, amount_min: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max (₹)</Label>
                    <Input type="number" value={form.amount_max} onChange={(e) => setForm({ ...form, amount_max: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one_time">One Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Day of Month</Label>
                <Input type="number" min={1} max={28} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} placeholder="e.g., 5" />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Bank / UPI Details</h4>
              <div className="space-y-2">
                <Label>UPI ID * (for QR code)</Label>
                <Input value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="e.g., society@upi" />
              </div>
              <div className="space-y-2">
                <Label>Account Holder Name</Label>
                <Input value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="For bank transfer fallback" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Separator() {
  return <div className="border-t my-1" />;
}
