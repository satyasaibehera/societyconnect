import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { Car, Plus, Loader2, Search, Download, Clock, Shield, Home, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnitApprover } from "@/hooks/useUnitApprover";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VehiclePass {
  id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  pass_type: string;
  status: string;
  visitor_name: string | null;
  visitor_phone: string | null;
  purpose: string | null;
  unit_id: string | null;
  unit_label: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

const theme = {
  temporary: {
    hex: "#dc2626", label: "Temporary Pass",
    bg: "bg-red-600", text: "text-red-600", border: "border-red-500",
    bgLight: "bg-red-50 dark:bg-red-950/30", borderTop: "border-t-red-500",
  },
  permanent: {
    hex: "#16a34a", label: "Permanent Pass",
    bg: "bg-green-600", text: "text-green-600", border: "border-green-500",
    bgLight: "bg-green-50 dark:bg-green-950/30", borderTop: "border-t-green-500",
  },
};

type PassType = "temporary" | "permanent";

const VehiclePasses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isManagement, isSecurity } = useUserRole();
  const { myUnitId, societyId: approverSocietyId } = useUnitApprover();
  const [passes, setPasses] = useState<VehiclePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PassType>("permanent");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPass, setSelectedPass] = useState<VehiclePass | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // For creating passes
  const [passType, setPassType] = useState<PassType>("permanent");
  const [units, setUnits] = useState<{ id: string; unit_number: string; building_name: string }[]>([]);
  const [unitSearch, setUnitSearch] = useState("");
  const [form, setForm] = useState({
    vehicle_number: "", vehicle_type: "", unit_id: "", unit_label: "",
    visitor_name: "", visitor_phone: "", purpose: "",
  });
  const [tempPassValidityHours, setTempPassValidityHours] = useState(24);

  // Society context (use hook for unit, fallback for security staff)
  const [societyId, setSocietyId] = useState<string | null>(approverSocietyId);
  
  const fetchContext = useCallback(async () => {
    if (approverSocietyId) {
      setSocietyId(approverSocietyId);
      // Fetch society's temp pass validity config
      const { data: society } = await supabase
        .from("societies")
        .select("temp_pass_validity_hours")
        .eq("id", approverSocietyId)
        .maybeSingle();
      if (society) setTempPassValidityHours((society as any).temp_pass_validity_hours ?? 24);
      return;
    }
    if (!user) return;
    // Security staff fallback
    const { data: staff } = await supabase
      .from("security_staff")
      .select("society_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (staff) setSocietyId(staff.society_id);
  }, [user, approverSocietyId]);

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicle_passes")
      .select("*")
      .order("created_at", { ascending: false });
    setPasses((data as VehiclePass[]) || []);
    setLoading(false);
  }, []);

  const fetchUnits = useCallback(async () => {
    const { data } = await supabase
      .from("units")
      .select("id, unit_number, building_id, buildings!units_building_id_fkey(name)")
      .order("unit_number");
    if (data) {
      setUnits(data.map((u) => ({
        id: u.id,
        unit_number: u.unit_number,
        building_name: (u.buildings as any)?.name || "",
      })));
    }
  }, []);

  useEffect(() => { fetchContext(); }, [fetchContext]);
  useEffect(() => { fetchPasses(); }, [fetchPasses]);
  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const searchLower = search.toLowerCase();
  const filtered = passes.filter((p) =>
    p.vehicle_number.toLowerCase().includes(searchLower) ||
    (p.visitor_name?.toLowerCase().includes(searchLower) ?? false) ||
    (p.unit_label?.toLowerCase().includes(searchLower) ?? false)
  );

  const byType = (type: PassType) => filtered.filter((p) => p.pass_type === type);

  const isExpired = (p: VehiclePass) =>
    p.valid_until && new Date(p.valid_until) < new Date();

  const effectiveStatus = (p: VehiclePass) =>
    p.status === "approved" && isExpired(p) ? "expired" : p.status;

  const openCreateDialog = (type: PassType) => {
    setPassType(type);
    setForm({ vehicle_number: "", vehicle_type: "", unit_id: "", unit_label: "", visitor_name: "", visitor_phone: "", purpose: "" });
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.vehicle_number || !societyId) return;
    setSaving(true);

    const validUntil = passType === "temporary"
      ? new Date(Date.now() + tempPassValidityHours * 60 * 60 * 1000).toISOString()
      : null;

    // If owner creates a temp pass for their own unit, it's pre-approved
    const isOwnerTempPass = passType === "temporary" && form.unit_id && form.unit_id === myUnitId;
    const status = isOwnerTempPass ? "approved" : "pending";

    const { error } = await supabase.from("vehicle_passes").insert({
      vehicle_number: form.vehicle_number.toUpperCase(),
      vehicle_type: form.vehicle_type || null,
      pass_type: passType,
      unit_id: form.unit_id || null,
      unit_label: form.unit_label || null,
      visitor_name: form.visitor_name || null,
      visitor_phone: form.visitor_phone || null,
      purpose: form.purpose || null,
      society_id: societyId,
      requested_by: user?.id,
      approved_by: isOwnerTempPass ? user?.id : null,
      status,
      valid_until: validUntil,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const desc = isOwnerTempPass
        ? "Pre-approved. Valid for 24 hours."
        : passType === "temporary"
          ? "Sent to flat owner for approval."
          : "Sent to admin for approval.";
      toast({ title: "Pass requested", description: desc });
      setDialogOpen(false);
      fetchPasses();
    }
  };

  const handleApproval = async (passId: string, approved: boolean) => {
    const { error } = await supabase.from("vehicle_passes").update({
      status: approved ? "approved" : "rejected",
      approved_by: user?.id,
    }).eq("id", passId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: approved ? "Pass approved" : "Pass rejected" });
      fetchPasses();
    }
  };

  const qrPayload = (pass: VehiclePass) =>
    JSON.stringify({ id: pass.id, vehicle: pass.vehicle_number, type: pass.pass_type, valid_until: pass.valid_until, ts: Date.now() });

  const handleDownload = () => {
    if (!qrRef.current || !selectedPass) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const colors = theme[selectedPass.pass_type as PassType];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 560;
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 560);

      // Top band
      ctx.fillStyle = colors.hex;
      ctx.fillRect(0, 0, 400, 8);

      // Badge
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      const badgeText = colors.label.toUpperCase();
      const badgeWidth = ctx.measureText(badgeText).width + 28;
      const badgeX = (400 - badgeWidth) / 2;
      ctx.beginPath();
      ctx.roundRect(badgeX, 18, badgeWidth, 26, 13);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(badgeText, 200, 36);

      // QR
      ctx.drawImage(img, 50, 56, 300, 300);

      // Vehicle number
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(selectedPass.vehicle_number, 200, 390);

      // Type + unit
      ctx.font = "14px sans-serif";
      ctx.fillStyle = colors.hex;
      const line = selectedPass.unit_label
        ? `${selectedPass.vehicle_type || "Vehicle"} · ${selectedPass.unit_label}`
        : selectedPass.vehicle_type || "Vehicle";
      ctx.fillText(line, 200, 415);

      // Visitor info
      if (selectedPass.visitor_name) {
        ctx.fillStyle = "#444";
        ctx.font = "13px sans-serif";
        ctx.fillText(selectedPass.visitor_name, 200, 440);
      }

      // Validity
      if (selectedPass.valid_until) {
        ctx.fillStyle = colors.hex;
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(`Valid until: ${format(new Date(selectedPass.valid_until), "dd MMM yyyy, hh:mm a")}`, 200, 470);
      } else {
        ctx.fillStyle = colors.hex;
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("PERMANENT PASS", 200, 470);
      }

      ctx.font = "10px monospace";
      ctx.fillStyle = "#999";
      ctx.fillText(`ID: ${selectedPass.id.slice(0, 8)}`, 200, 500);

      ctx.fillStyle = colors.hex;
      ctx.fillRect(0, 552, 400, 8);

      const link = document.createElement("a");
      link.download = `pass-${selectedPass.vehicle_number}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-green-500", pending: "bg-yellow-500", rejected: "bg-red-500", expired: "bg-muted-foreground",
    };
    return <Badge className={`${map[status] || "bg-muted"} text-white text-[10px]`}>{status}</Badge>;
  };

  const canApproveTemp = (_p: VehiclePass) => false; // Temp pass approvals moved to My Vehicles

  const canApprovePerm = (p: VehiclePass) =>
    p.pass_type === "permanent" && p.status === "pending" && isManagement;

  const filteredUnits = unitSearch.trim()
    ? units.filter((u) =>
        u.unit_number.toLowerCase().includes(unitSearch.toLowerCase()) ||
        u.building_name.toLowerCase().includes(unitSearch.toLowerCase())
      )
    : units;

  const renderCard = (p: VehiclePass) => {
    const colors = theme[p.pass_type as PassType];
    const status = effectiveStatus(p);
    return (
      <Card
        key={p.id}
        className={`p-4 cursor-pointer transition-all hover:shadow-md border-2 ${colors.border} relative overflow-hidden ${status === "expired" || status === "rejected" ? "opacity-60" : ""}`}
        onClick={() => status === "approved" && setSelectedPass(p)}
      >
        <div className={`absolute top-0 left-0 right-0 h-7 ${colors.bg} flex items-center justify-center`}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">
            {colors.label}
          </span>
        </div>
        <div className="mt-7 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm tracking-wider">{p.vehicle_number}</p>
            {statusBadge(status)}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            {p.visitor_name && <p>Visitor: {p.visitor_name}</p>}
            {p.unit_label && <p>Unit: {p.unit_label}</p>}
            {p.vehicle_type && <p className="capitalize">Type: {p.vehicle_type}</p>}
            {p.valid_until && (
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Until: {format(new Date(p.valid_until), "dd MMM yyyy, hh:mm a")}
              </p>
            )}
            {!p.valid_until && status === "approved" && (
              <p className={`font-medium ${colors.text}`}>Permanent</p>
            )}
          </div>
          {(canApproveTemp(p) || canApprovePerm(p)) && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={(e) => { e.stopPropagation(); handleApproval(p.id, true); }}>
                <Check className="mr-1 h-3 w-3" /> Approve
              </Button>
              <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={(e) => { e.stopPropagation(); handleApproval(p.id, false); }}>
                <X className="mr-1 h-3 w-3" /> Reject
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  const tempCount = byType("temporary").length;
  const permCount = byType("permanent").length;

  return (
    <DashboardLayout title="Vehicle Passes">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className={`p-3 text-center ${theme.permanent.borderTop} border-t-4`}>
            <p className={`text-2xl font-bold font-display ${theme.permanent.text}`}>
              {passes.filter((p) => p.pass_type === "permanent" && p.status === "approved").length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Active Permanent</p>
          </Card>
          <Card className={`p-3 text-center ${theme.temporary.borderTop} border-t-4`}>
            <p className={`text-2xl font-bold font-display ${theme.temporary.text}`}>
              {passes.filter((p) => p.pass_type === "temporary" && p.status === "approved" && !isExpired(p)).length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Active Temporary</p>
          </Card>
          <Card className="p-3 text-center border-t-4 border-t-yellow-500">
            <p className="text-2xl font-bold font-display text-yellow-500">
              {passes.filter((p) => p.status === "pending").length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pending Approval</p>
          </Card>
          <Card className="p-3 text-center border-t-4 border-t-muted-foreground">
            <p className="text-2xl font-bold font-display text-muted-foreground">
              {passes.filter((p) => effectiveStatus(p) === "expired").length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Expired</p>
          </Card>
        </div>

        {/* Search + Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative sm:max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by vehicle, visitor, or unit..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {(isSecurity || !!myUnitId) && (
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => openCreateDialog("temporary")}>
                <Plus className="mr-2 h-4 w-4" /> Temp Pass
              </Button>
            )}
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => openCreateDialog("permanent")}>
              <Plus className="mr-2 h-4 w-4" /> Permanent Pass
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : passes.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No vehicle passes yet.</p>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PassType)}>
            <TabsList>
              <TabsTrigger value="permanent" className={theme.permanent.text}>
                <Home className="mr-1.5 h-4 w-4" /> Permanent ({permCount})
              </TabsTrigger>
              <TabsTrigger value="temporary" className={theme.temporary.text}>
                <Shield className="mr-1.5 h-4 w-4" /> Temporary ({tempCount})
              </TabsTrigger>
            </TabsList>
            {(["permanent", "temporary"] as PassType[]).map((type) => (
              <TabsContent key={type} value={type} className="mt-4">
                {byType(type).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No {theme[type].label.toLowerCase()}es found.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{byType(type).map(renderCard)}</div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {passType === "temporary" ? "Request Temporary Pass" : "Request Permanent Pass"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Vehicle Number *</Label><Input placeholder="e.g. MH01AB1234" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></div>
            <div>
              <Label>Vehicle Type</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["car", "bike", "scooter", "truck", "auto", "other"].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit / Flat</Label>
              <Input placeholder="Search unit..." value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} className="mb-2" />
              <div className="max-h-32 overflow-y-auto border rounded-md">
                {filteredUnits.slice(0, 50).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${form.unit_id === u.id ? "bg-accent font-medium" : ""}`}
                    onClick={() => setForm({ ...form, unit_id: u.id, unit_label: `${u.building_name} - ${u.unit_number}` })}
                  >
                    {u.building_name} - {u.unit_number}
                  </button>
                ))}
              </div>
              {form.unit_label && <p className="text-xs text-muted-foreground mt-1">Selected: {form.unit_label}</p>}
            </div>
            {passType === "temporary" && (
              <>
                <div><Label>Visitor Name</Label><Input value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} /></div>
                <div><Label>Visitor Phone</Label><Input value={form.visitor_phone} onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} /></div>
                <div><Label>Purpose</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">
                  ⏱ Valid for {tempPassValidityHours} hours. {myUnitId && form.unit_id === myUnitId ? "This will be pre-approved as you are the flat owner." : "Requires flat owner approval."}
                </p>
              </>
            )}
            {passType === "permanent" && (
              <p className="text-xs text-muted-foreground">🔒 This pass requires society admin approval.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving || !form.vehicle_number}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Request Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Pass Dialog */}
      <Dialog open={!!selectedPass} onOpenChange={(open) => !open && setSelectedPass(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Vehicle Pass</DialogTitle></DialogHeader>
          {selectedPass && (() => {
            const colors = theme[selectedPass.pass_type as PassType];
            return (
              <div className="flex flex-col items-center space-y-4 pt-2">
                <div
                  ref={qrRef}
                  className={`rounded-xl border-2 ${colors.border} shadow-sm w-full flex flex-col items-center overflow-hidden`}
                >
                  <div className={`w-full py-2 ${colors.bg} flex items-center justify-center`}>
                    <span className="text-xs font-bold uppercase tracking-widest text-white">
                      {colors.label}
                    </span>
                  </div>
                  <div className="p-6 flex flex-col items-center">
                    <QRCodeSVG
                      value={qrPayload(selectedPass)}
                      size={200}
                      level="H"
                      includeMargin
                      bgColor="transparent"
                      fgColor={colors.hex}
                    />
                    <div className="text-center mt-4">
                      <p className="font-display font-bold text-lg tracking-wider">{selectedPass.vehicle_number}</p>
                      <p className={`text-sm ${colors.text} font-medium capitalize`}>
                        {selectedPass.vehicle_type || "Vehicle"}
                        {selectedPass.unit_label && ` · ${selectedPass.unit_label}`}
                      </p>
                      {selectedPass.visitor_name && (
                        <p className="text-xs text-muted-foreground mt-1">Visitor: {selectedPass.visitor_name}</p>
                      )}
                      {selectedPass.valid_until ? (
                        <p className={`text-xs font-medium mt-2 ${colors.text}`}>
                          Valid until: {format(new Date(selectedPass.valid_until), "dd MMM yyyy, hh:mm a")}
                        </p>
                      ) : (
                        <p className={`text-xs font-bold mt-2 ${colors.text}`}>PERMANENT PASS</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
                        ID: {selectedPass.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleDownload} className={`w-full ${colors.bg} hover:opacity-90 text-white`}>
                  <Download className="mr-2 h-4 w-4" /> Download Pass
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default VehiclePasses;
