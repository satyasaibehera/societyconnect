import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus, Loader2, Trash2, Clock, UserCheck } from "lucide-react";
import { tenantDb } from "@/services/tenantDb";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Delegate {
  id: string;
  delegate_id: string;
  delegate_name: string;
  valid_from: string;
  valid_until: string;
  reason: string | null;
  is_active: boolean;
}

interface UnitResident {
  id: string;
  user_id: string | null;
  full_name: string;
  resident_type: string;
}

interface DelegateManagerProps {
  unitId: string;
}

export function DelegateManager({ unitId }: DelegateManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [residents, setResidents] = useState<UnitResident[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ delegate_id: "", duration_days: "7", reason: "" });

  const fetchDelegates = useCallback(async () => {
    const { data } = await tenantDb.from("approval_delegates")
      .select("id, delegate_id, valid_from, valid_until, reason, is_active")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch delegate names
      const delegateIds = data.map((d: any) => d.delegate_id);
      const { data: profiles } = await tenantDb.from("profiles")
        .select("user_id, full_name")
        .in("user_id", delegateIds);

      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      setDelegates(data.map((d: any) => ({
        ...d,
        delegate_name: nameMap.get(d.delegate_id) || "Unknown",
      })));
    }
    setLoading(false);
  }, [unitId]);

  const fetchResidents = useCallback(async () => {
    if (!user) return;
    // Fetch all approved residents in the unit (excluding current user by user_id if set)
    const { data } = await tenantDb.from("residents")
      .select("id, user_id, full_name, resident_type")
      .eq("unit_id", unitId)
      .eq("status", "approved");

    // Filter out self - keep residents with or without user_id
    const filtered = (data || []).filter((r: any) => r.user_id !== user.id);
    setResidents(filtered as UnitResident[]);
  }, [unitId, user]);

  useEffect(() => { fetchDelegates(); fetchResidents(); }, [fetchDelegates, fetchResidents]);

  const handleCreate = async () => {
    if (!form.delegate_id || form.delegate_id === "none" || !user) return;
    setSaving(true);

    const days = parseInt(form.duration_days) || 7;
    const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await tenantDb.from("approval_delegates").insert({
      unit_id: unitId,
      owner_id: user.id,
      delegate_id: form.delegate_id,
      valid_until: validUntil,
      reason: form.reason || null,
      is_active: true,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Delegate added", description: `Approval rights delegated for ${days} days.` });
      setDialogOpen(false);
      setForm({ delegate_id: "", duration_days: "7", reason: "" });
      fetchDelegates();
    }
  };

  const handleRevoke = async (id: string) => {
    const { error } = await tenantDb.from("approval_delegates")
      .update({ is_active: false } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Delegation revoked" });
      fetchDelegates();
    }
  };

  const isExpired = (d: Delegate) => new Date(d.valid_until) < new Date();
  const isEffective = (d: Delegate) => d.is_active && !isExpired(d);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Approval Delegates
          </h3>
          <p className="text-xs text-muted-foreground">Delegate visitor & vehicle pass approvals to a family member or tenant.</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-3 w-3" /> Add Delegate
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : delegates.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No delegates configured. Only you can approve visitors and temp vehicle passes.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {delegates.map((d) => (
            <Card key={d.id} className={`p-3 flex items-center gap-3 ${!isEffective(d) ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{d.delegate_name}</p>
                  {isEffective(d) ? (
                    <Badge className="bg-green-500 text-white text-[10px]">Active</Badge>
                  ) : isExpired(d) ? (
                    <Badge variant="secondary" className="text-[10px]">Expired</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Revoked</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  Until {format(new Date(d.valid_until), "dd MMM yyyy, hh:mm a")}
                </div>
                {d.reason && <p className="text-xs text-muted-foreground mt-0.5">Reason: {d.reason}</p>}
              </div>
              {isEffective(d) && (
                <Button size="sm" variant="outline" className="text-destructive shrink-0" onClick={() => handleRevoke(d.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Revoke
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Approval Delegate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Family Member / Tenant *</Label>
              {residents.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No eligible members found in your flat.</p>
              ) : (() => {
                const eligible = residents.filter((r) => r.user_id);
                const ineligible = residents.filter((r) => !r.user_id);
                return (
                  <>
                    {eligible.length > 0 ? (
                      <Select value={form.delegate_id || undefined} onValueChange={(v) => setForm({ ...form, delegate_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Choose a resident" /></SelectTrigger>
                        <SelectContent>
                          {eligible.map((r) => (
                            <SelectItem key={r.user_id!} value={r.user_id!}>
                              {r.full_name} ({r.resident_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">No members with registered accounts found.</p>
                    )}
                    {ineligible.length > 0 && (
                      <Alert className="mt-2">
                        <AlertDescription className="text-xs">
                          {ineligible.map((r) => r.full_name).join(", ")} {ineligible.length === 1 ? "hasn't" : "haven't"} registered an account yet. They need to sign up and get linked to your flat before they can be delegated.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                );
              })()}
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={form.duration_days} onValueChange={(v) => setForm({ ...form, duration_days: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="14">14 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input placeholder="e.g. Out of city for a week" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving || !form.delegate_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delegate Approvals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
