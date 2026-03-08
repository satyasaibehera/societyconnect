import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Search, Download, Users, Shield, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Person {
  id: string;
  name: string;
  phone: string | null;
  type: "resident" | "security";
  subtype?: string;
}

type ColorKey = "owner" | "tenant" | "family_member" | "security";

const colorConfig: Record<ColorKey, { bg: string; text: string; border: string; hex: string; label: string }> = {
  owner:         { bg: "bg-primary/10",     text: "text-primary",     border: "border-primary/40",     hex: "#4f46e5", label: "Owner" },
  tenant:        { bg: "bg-accent/10",      text: "text-accent",      border: "border-accent/40",      hex: "#0d9488", label: "Tenant" },
  family_member: { bg: "bg-warning/10",     text: "text-warning",     border: "border-warning/40",     hex: "#d97706", label: "Family" },
  security:      { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/40", hex: "#dc2626", label: "Security" },
};

const getColorKey = (person: Person): ColorKey => {
  if (person.type === "security") return "security";
  if (person.subtype === "tenant") return "tenant";
  if (person.subtype === "family_member") return "family_member";
  return "owner";
};

const DigitalIds = () => {
  const { toast } = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    const persons: Person[] = [];

    const { data: residents } = await supabase
      .from("residents")
      .select("id, full_name, phone, resident_type")
      .eq("status", "approved");
    residents?.forEach((r) =>
      persons.push({ id: r.id, name: r.full_name, phone: r.phone, type: "resident", subtype: r.resident_type })
    );

    const { data: staff } = await supabase
      .from("security_staff")
      .select("id, name, phone");
    staff?.forEach((s) =>
      persons.push({ id: s.id, name: s.name, phone: s.phone, type: "security" })
    );

    setPeople(persons);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPeople(); }, [fetchPeople]);

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone?.includes(search) ?? false)
  );

  const residents = filtered.filter((p) => p.type === "resident");
  const security = filtered.filter((p) => p.type === "security");

  const qrPayload = (person: Person) =>
    JSON.stringify({ id: person.id, name: person.name, type: person.type, ts: Date.now() });

  const handleDownload = () => {
    if (!qrRef.current || !selectedPerson) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const ck = getColorKey(selectedPerson);
    const colors = colorConfig[ck];

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

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 520);

      // Color band at top
      ctx.fillStyle = colors.hex;
      ctx.fillRect(0, 0, 400, 8);

      // Role badge
      ctx.fillStyle = colors.hex;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      const badgeText = colors.label.toUpperCase();
      const badgeWidth = ctx.measureText(badgeText).width + 24;
      const badgeX = (400 - badgeWidth) / 2;
      ctx.beginPath();
      ctx.roundRect(badgeX, 20, badgeWidth, 24, 12);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(badgeText, 200, 37);

      // QR code
      ctx.drawImage(img, 50, 56, 300, 300);

      // Name
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(selectedPerson.name, 200, 390);

      // Subtype
      ctx.font = "14px sans-serif";
      ctx.fillStyle = colors.hex;
      ctx.fillText(
        selectedPerson.type === "resident"
          ? `Resident · ${selectedPerson.subtype?.replace("_", " ") || "Owner"}`
          : "Security Staff",
        200, 415
      );

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
    const ck = getColorKey(person);
    const colors = colorConfig[ck];
    return (
      <Card
        key={person.id}
        className={`p-4 cursor-pointer transition-colors border-l-4 ${colors.border} hover:shadow-md`}
        onClick={() => setSelectedPerson(person)}
      >
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
            <QrCode className={`h-5 w-5 ${colors.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{person.name}</p>
            <p className="text-xs text-muted-foreground">
              {person.type === "resident" ? person.subtype?.replace("_", " ") || "Owner" : "Security Staff"}
              {person.phone && ` · ${person.phone}`}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] capitalize shrink-0 ${colors.text} ${colors.border}`}>
            {colors.label}
          </Badge>
        </div>
      </Card>
    );
  };

  return (
    <DashboardLayout title="Digital IDs">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold font-display">{people.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total IDs</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold font-display text-primary">{people.filter((p) => p.type === "resident").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Residents</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold font-display text-accent">{people.filter((p) => p.type === "security").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Security</p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : people.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <QrCode className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No approved residents or security staff to generate IDs for.</p>
          </Card>
        ) : (
          <Tabs defaultValue="residents">
            <TabsList>
              <TabsTrigger value="residents"><Users className="mr-1.5 h-4 w-4" /> Residents ({residents.length})</TabsTrigger>
              <TabsTrigger value="security"><Shield className="mr-1.5 h-4 w-4" /> Security ({security.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="residents" className="mt-4">
              {residents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No residents match your search.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{residents.map(renderCard)}</div>
              )}
            </TabsContent>
            <TabsContent value="security" className="mt-4">
              {security.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No security staff match your search.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{security.map(renderCard)}</div>
              )}
            </TabsContent>
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
            const ck = getColorKey(selectedPerson);
            const colors = colorConfig[ck];
            return (
              <div className="flex flex-col items-center space-y-4 pt-2">
                <div ref={qrRef} className={`rounded-xl p-6 border-2 ${colors.border} shadow-sm w-full flex flex-col items-center`}>
                  <div className={`px-3 py-1 rounded-full ${colors.bg} ${colors.text} text-xs font-semibold uppercase tracking-wider mb-4`}>
                    {colors.label}
                  </div>
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
                    <p className={`text-sm capitalize ${colors.text}`}>
                      {selectedPerson.type === "resident"
                        ? `Resident · ${selectedPerson.subtype?.replace("_", " ") || "Owner"}`
                        : "Security Staff"}
                    </p>
                    {selectedPerson.phone && (
                      <p className="text-xs text-muted-foreground mt-1">{selectedPerson.phone}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
                      ID: {selectedPerson.id.slice(0, 8)}
                    </p>
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
