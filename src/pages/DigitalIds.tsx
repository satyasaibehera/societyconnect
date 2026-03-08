import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Search, Download, Users, Shield, Loader2, Briefcase, Home, Eye, Award } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Person {
  id: string;
  name: string;
  phone: string | null;
  category: ColorKey;
  unitLabel?: string | null;
  designation?: string | null;
}

type ColorKey = "resident" | "tenant" | "helper" | "visitor" | "security" | "office_bearer";

const colorConfig: Record<ColorKey, {
  hex: string; label: string;
  bg: string; text: string; border: string; bgLight: string; borderTop: string;
}> = {
  resident:      { hex: "#3b82f6", label: "Resident",        bg: "bg-id-resident",      text: "text-id-resident",      border: "border-id-resident",      bgLight: "bg-id-resident/10",      borderTop: "border-t-id-resident" },
  tenant:        { hex: "#8b5cf6", label: "Tenant",          bg: "bg-id-tenant",        text: "text-id-tenant",        border: "border-id-tenant",        bgLight: "bg-id-tenant/10",        borderTop: "border-t-id-tenant" },
  helper:        { hex: "#eab308", label: "Domestic Helper", bg: "bg-id-helper",        text: "text-id-helper",        border: "border-id-helper",        bgLight: "bg-id-helper/10",        borderTop: "border-t-id-helper" },
  visitor:       { hex: "#f97316", label: "Visitor",         bg: "bg-id-visitor",       text: "text-id-visitor",       border: "border-id-visitor",       bgLight: "bg-id-visitor/10",       borderTop: "border-t-id-visitor" },
  security:      { hex: "#6b7280", label: "Security Guard",  bg: "bg-id-security",      text: "text-id-security",      border: "border-id-security",      bgLight: "bg-id-security/10",      borderTop: "border-t-id-security" },
  office_bearer: { hex: "#d4a017", label: "Office Bearer",   bg: "bg-id-office-bearer", text: "text-id-office-bearer", border: "border-id-office-bearer", bgLight: "bg-id-office-bearer/10", borderTop: "border-t-id-office-bearer" },
};

const DigitalIds = () => {
  const { toast } = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ColorKey>("resident");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    const persons: Person[] = [];

    // Residents (owners, tenants, family → mapped to resident/tenant)
    const { data: residents } = await supabase
      .from("residents")
      .select("id, full_name, phone, resident_type, unit_id, units!residents_unit_id_fkey(unit_number)")
      .eq("status", "approved");
    residents?.forEach((r) => {
      let category: ColorKey = "resident";
      if (r.resident_type === "tenant") category = "tenant";
      const unitLabel = (r.units as any)?.unit_number ?? null;
      persons.push({ id: r.id, name: r.full_name, phone: r.phone, category, unitLabel });
    });

    // Security staff
    const { data: staff } = await supabase
      .from("security_staff")
      .select("id, name, phone");
    staff?.forEach((s) =>
      persons.push({ id: s.id, name: s.name, phone: s.phone, category: "security" })
    );

    // Helpers
    const { data: helpers } = await supabase
      .from("helpers")
      .select("id, name, phone")
      .eq("status", "approved");
    helpers?.forEach((h) =>
      persons.push({ id: h.id, name: h.name, phone: h.phone, category: "helper" })
    );

    // Visitors (approved)
    const { data: visitors } = await supabase
      .from("visitors")
      .select("id, name, phone, visiting_unit_label")
      .eq("status", "approved");
    visitors?.forEach((v) =>
      persons.push({ id: v.id, name: v.name, phone: v.phone, category: "visitor", unitLabel: v.visiting_unit_label })
    );

    // Office bearers (from office_bearers table + profiles for names)
    const { data: officeBearers } = await supabase
      .from("office_bearers")
      .select("id, user_id, designation, phone");
    if (officeBearers && officeBearers.length > 0) {
      const obUserIds = officeBearers.map((ob) => ob.user_id);
      const { data: obProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", obUserIds);
      const profileMap = new Map(obProfiles?.map((p) => [p.user_id, p.full_name]) ?? []);
      officeBearers.forEach((ob) => {
        const designation = ob.designation?.replace(/_/g, " ") ?? "Office Bearer";
        persons.push({
          id: ob.id,
          name: profileMap.get(ob.user_id) || designation,
          phone: ob.phone,
          category: "office_bearer",
          designation,
        });
      });
    }

    setPeople(persons);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPeople(); }, [fetchPeople]);

  const searchLower = search.toLowerCase();
  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(searchLower) ||
    (p.phone?.includes(search) ?? false) ||
    (p.unitLabel?.toLowerCase().includes(searchLower) ?? false)
  );

  const byCategory = (key: ColorKey) => filtered.filter((p) => p.category === key);

  const qrPayload = (person: Person) =>
    JSON.stringify({ id: person.id, name: person.name, type: person.category, ts: Date.now() });

  const handleDownload = () => {
    if (!qrRef.current || !selectedPerson) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const colors = colorConfig[selectedPerson.category];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 520;
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 520);

      // Top color band
      ctx.fillStyle = colors.hex;
      ctx.fillRect(0, 0, 400, 8);

      // Role label header
      ctx.fillStyle = colors.hex;
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

      // QR code
      ctx.drawImage(img, 50, 56, 300, 300);

      // Name
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(selectedPerson.name, 200, 390);

      // Category + unit
      ctx.font = "14px sans-serif";
      ctx.fillStyle = colors.hex;
      const categoryLine = selectedPerson.unitLabel
        ? `${colors.label} · ${selectedPerson.unitLabel}`
        : colors.label;
      ctx.fillText(categoryLine, 200, 415);

      if (selectedPerson.phone) {
        ctx.fillStyle = "#666";
        ctx.font = "13px sans-serif";
        ctx.fillText(selectedPerson.phone, 200, 440);
      }

      ctx.font = "10px monospace";
      ctx.fillStyle = "#999";
      ctx.fillText(`ID: ${selectedPerson.id.slice(0, 8)}`, 200, 475);

      // Bottom color band
      ctx.fillStyle = colors.hex;
      ctx.fillRect(0, 512, 400, 8);

      const link = document.createElement("a");
      link.download = `id-${selectedPerson.name.replace(/\s/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const renderCard = (person: Person) => {
    const colors = colorConfig[person.category];
    return (
      <Card
        key={person.id}
        className={`p-4 cursor-pointer transition-all hover:shadow-md border-2 ${colors.border} relative overflow-hidden`}
        onClick={() => setSelectedPerson(person)}
      >
        {/* Color label header */}
        <div
          className={`absolute top-0 left-0 right-0 h-7 ${colors.bg} flex items-center justify-center`}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">
            {colors.label}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-7">
          <div className={`h-10 w-10 rounded-lg ${colors.bgLight} flex items-center justify-center shrink-0`}>
            <QrCode className={`h-5 w-5 ${colors.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{person.name}</p>
            <p className="text-xs text-muted-foreground">
              {person.designation && <span className="font-medium capitalize">{person.designation} · </span>}
              {person.unitLabel && <span className="font-medium">{person.unitLabel} · </span>}
              {person.phone || "No phone"}
            </p>
          </div>
        </div>
      </Card>
    );
  };

  const tabData: { key: ColorKey; icon: React.ReactNode }[] = [
    { key: "resident", icon: <Home className="mr-1.5 h-4 w-4" /> },
    { key: "tenant", icon: <Users className="mr-1.5 h-4 w-4" /> },
    { key: "helper", icon: <Briefcase className="mr-1.5 h-4 w-4" /> },
    { key: "visitor", icon: <Eye className="mr-1.5 h-4 w-4" /> },
    { key: "security", icon: <Shield className="mr-1.5 h-4 w-4" /> },
    { key: "office_bearer", icon: <Award className="mr-1.5 h-4 w-4" /> },
  ];

  return (
    <DashboardLayout title="Digital IDs">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {(Object.keys(colorConfig) as ColorKey[]).map((key) => (
            <Card key={key} className={`p-3 text-center border-t-4 ${colorConfig[key].borderTop}`}>
              <p className={`text-2xl font-bold font-display ${colorConfig[key].text}`}>
                {people.filter((p) => p.category === key).length}
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{colorConfig[key].label}</p>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone, or unit number..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : people.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <QrCode className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No approved people to generate IDs for.</p>
          </Card>
        ) : (
          <Tabs defaultValue="resident">
            <TabsList className="flex-wrap h-auto gap-1">
              {tabData.map(({ key, icon }) => (
                <TabsTrigger key={key} value={key} className="text-xs">
                  {icon} {colorConfig[key].label} ({byCategory(key).length})
                </TabsTrigger>
              ))}
            </TabsList>
            {tabData.map(({ key }) => (
              <TabsContent key={key} value={key} className="mt-4">
                {byCategory(key).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No {colorConfig[key].label.toLowerCase()}s found.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{byCategory(key).map(renderCard)}</div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* QR Dialog */}
      <Dialog open={!!selectedPerson} onOpenChange={(open) => !open && setSelectedPerson(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Digital ID Card</DialogTitle>
          </DialogHeader>
          {selectedPerson && (() => {
            const colors = colorConfig[selectedPerson.category];
            return (
              <div className="flex flex-col items-center space-y-4 pt-2">
                <div
                  ref={qrRef}
                  className={`rounded-xl border-2 ${colors.border} shadow-sm w-full flex flex-col items-center overflow-hidden`}
                >
                  {/* Prominent color header */}
                  <div className={`w-full py-2 ${colors.bg} flex items-center justify-center`}>
                    <span className="text-xs font-bold uppercase tracking-widest text-white">
                      {colors.label}
                    </span>
                  </div>

                  <div className="p-6 flex flex-col items-center">
                    <QRCodeSVG
                      value={qrPayload(selectedPerson)}
                      size={200}
                      level="H"
                      includeMargin
                      bgColor="transparent"
                      fgColor={colors.hex}
                    />
                    <div className="text-center mt-4">
                      <p className="font-display font-bold text-lg">{selectedPerson.name}</p>
                      <p className={`text-sm ${colors.text} font-medium capitalize`}>
                        {selectedPerson.designation || colors.label}
                        {selectedPerson.unitLabel && ` · ${selectedPerson.unitLabel}`}
                      </p>
                      {selectedPerson.phone && (
                        <p className="text-xs text-muted-foreground mt-1">{selectedPerson.phone}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
                        ID: {selectedPerson.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleDownload} className="w-full gradient-primary text-primary-foreground">
                  <Download className="mr-2 h-4 w-4" /> Download ID Card
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DigitalIds;
