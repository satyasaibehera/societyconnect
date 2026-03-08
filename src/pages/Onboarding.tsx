import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, ArrowRight, ArrowLeft, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  { id: 1, title: "Society Details", description: "Basic information about your society" },
  { id: 2, title: "Building Structure", description: "Define buildings, floors, and units" },
  { id: 3, title: "Office Bearers", description: "Set up management roles" },
  { id: 4, title: "Invite Residents", description: "Add your residents" },
  { id: 5, title: "Security Staff", description: "Add security personnel" },
  { id: 6, title: "Policies", description: "Configure society rules" },
  { id: 7, title: "Go Live", description: "Activate your society" },
];

interface Building {
  name: string;
  floors: number;
  unitsPerFloor: number;
}

interface OfficeBearerRole {
  title: string;
  isCustom: boolean;
}

interface SecurityStaff {
  name: string;
  phone: string;
}

interface InviteEntry {
  phone: string;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savedSocietyId, setSavedSocietyId] = useState<string | null>(null);

  // Step 1
  const [societyName, setSocietyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Step 2
  const [buildings, setBuildings] = useState<Building[]>([
    { name: "A", floors: 10, unitsPerFloor: 4 },
  ]);

  // Step 3
  const [roles, setRoles] = useState<OfficeBearerRole[]>([
    { title: "President", isCustom: false },
    { title: "Secretary", isCustom: false },
    { title: "Treasurer", isCustom: false },
    { title: "Committee Member", isCustom: false },
  ]);
  const [newRole, setNewRole] = useState("");

  // Step 4
  const [invites, setInvites] = useState<InviteEntry[]>([{ phone: "" }]);

  // Step 5
  const [securityStaff, setSecurityStaff] = useState<SecurityStaff[]>([
    { name: "", phone: "" },
  ]);

  // Step 6
  const [visitorApproval, setVisitorApproval] = useState("pre-approved");
  const [helperTracking, setHelperTracking] = useState(true);
  const [vehicleRegistration, setVehicleRegistration] = useState(true);

  const generateUnits = (building: Building) => {
    const units: string[] = [];
    for (let floor = 1; floor <= building.floors; floor++) {
      for (let unit = 1; unit <= building.unitsPerFloor; unit++) {
        units.push(`${building.name}-${floor.toString().padStart(1, "0")}${unit.toString().padStart(2, "0")}`);
      }
    }
    return units;
  };

  const totalUnits = buildings.reduce((acc, b) => acc + b.floors * b.unitsPerFloor, 0);

  const addBuilding = () => {
    const nextName = String.fromCharCode(65 + buildings.length);
    setBuildings([...buildings, { name: nextName, floors: 10, unitsPerFloor: 4 }]);
  };

  const removeBuilding = (index: number) => {
    if (buildings.length > 1) {
      setBuildings(buildings.filter((_, i) => i !== index));
    }
  };

  const updateBuilding = (index: number, field: keyof Building, value: string | number) => {
    const updated = [...buildings];
    updated[index] = { ...updated[index], [field]: value };
    setBuildings(updated);
  };

  const addRole = () => {
    if (newRole.trim()) {
      setRoles([...roles, { title: newRole.trim(), isCustom: true }]);
      setNewRole("");
    }
  };

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index));
  };

  const next = () => setCurrentStep((s) => Math.min(s + 1, 7));
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const handleLaunchSociety = async () => {
    if (!user) {
      toast({ title: "Not authenticated", variant: "destructive" });
      return;
    }
    if (!societyName.trim()) {
      toast({ title: "Society name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Create the society
      const { data: society, error: societyError } = await supabase
        .from("societies")
        .insert({
          name: societyName,
          address,
          city,
          state,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (societyError) throw societyError;

      setSavedSocietyId(society.id);

      // 2. Create buildings and collect their IDs
      for (const building of buildings) {
        const { data: buildingData, error: buildingError } = await supabase
          .from("buildings")
          .insert({
            society_id: society.id,
            name: building.name,
            floors: building.floors,
            units_per_floor: building.unitsPerFloor,
          })
          .select()
          .single();

        if (buildingError) throw buildingError;

        // 3. Generate and insert units for this building
        const unitRows = [];
        for (let floor = 1; floor <= building.floors; floor++) {
          for (let unit = 1; unit <= building.unitsPerFloor; unit++) {
            unitRows.push({
              building_id: buildingData.id,
              unit_number: `${building.name}-${floor.toString().padStart(1, "0")}${unit.toString().padStart(2, "0")}`,
              floor,
            });
          }
        }

        // Insert in batches of 100 to avoid payload limits
        for (let i = 0; i < unitRows.length; i += 100) {
          const batch = unitRows.slice(i, i + 100);
          const { error: unitError } = await supabase.from("units").insert(batch);
          if (unitError) throw unitError;
        }
      }

      toast({
        title: "Society launched! 🎉",
        description: `${societyName} with ${buildings.length} building(s) and ${totalUnits} units created successfully.`,
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error saving society",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <Label htmlFor="society-name">Society Name</Label>
              <Input id="society-name" placeholder="Green Valley Heights" value={societyName} onChange={(e) => setSocietyName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" placeholder="123, MG Road" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Bangalore" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" placeholder="Karnataka" value={state} onChange={(e) => setState(e.target.value)} />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-fade-in">
            {buildings.map((building, i) => (
              <Card key={i} className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold">Building {building.name}</h3>
                  {buildings.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeBuilding(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Name/Wing</Label>
                    <Input value={building.name} onChange={(e) => updateBuilding(i, "name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Floors</Label>
                    <Input type="number" min={1} value={building.floors} onChange={(e) => updateBuilding(i, "floors", parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Units/Floor</Label>
                    <Input type="number" min={1} value={building.unitsPerFloor} onChange={(e) => updateBuilding(i, "unitsPerFloor", parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Preview: {building.floors * building.unitsPerFloor} units
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {generateUnits(building).slice(0, 12).map((unit) => (
                      <Badge key={unit} variant="secondary" className="text-[10px] font-mono">
                        {unit}
                      </Badge>
                    ))}
                    {building.floors * building.unitsPerFloor > 12 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{building.floors * building.unitsPerFloor - 12} more
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            <Button variant="outline" onClick={addBuilding} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Building
            </Button>
            <div className="rounded-lg bg-primary/5 p-4 text-center">
              <p className="text-sm text-muted-foreground">Total units to be created</p>
              <p className="text-3xl font-display font-bold text-primary">{totalUnits}</p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              {roles.map((role, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{role.title}</span>
                    {role.isCustom && <Badge variant="secondary" className="text-[10px]">Custom</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeRole(i)} className="h-8 w-8">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex gap-2">
              <Input placeholder="Add custom role..." value={newRole} onChange={(e) => setNewRole(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} />
              <Button onClick={addRole} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              {invites.map((inv, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="+91 98765 43210"
                    value={inv.phone}
                    onChange={(e) => {
                      const updated = [...invites];
                      updated[i].phone = e.target.value;
                      setInvites(updated);
                    }}
                  />
                  {invites.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setInvites(invites.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => setInvites([...invites, { phone: "" }])} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Another
            </Button>
            <Separator />
            <Button variant="outline" className="w-full">
              <Upload className="h-4 w-4 mr-2" /> Upload CSV
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              CSV format: Name, Phone Number, Unit Number
            </p>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4 animate-fade-in">
            {securityStaff.map((staff, i) => (
              <Card key={i} className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Guard Name</Label>
                    <Input
                      placeholder="Name"
                      value={staff.name}
                      onChange={(e) => {
                        const updated = [...securityStaff];
                        updated[i].name = e.target.value;
                        setSecurityStaff(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={staff.phone}
                      onChange={(e) => {
                        const updated = [...securityStaff];
                        updated[i].phone = e.target.value;
                        setSecurityStaff(updated);
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
            <Button
              variant="outline"
              onClick={() => setSecurityStaff([...securityStaff, { name: "", phone: "" }])}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Security Staff
            </Button>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <Label>Visitor Approval Mode</Label>
              <Select value={visitorApproval} onValueChange={setVisitorApproval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre-approved">Pre-approved by Resident</SelectItem>
                  <SelectItem value="gate-approval">Approval at Gate</SelectItem>
                  <SelectItem value="auto">Auto-approve All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Helper Tracking</p>
                <p className="text-xs text-muted-foreground">Track domestic helper entry/exit</p>
              </div>
              <Switch checked={helperTracking} onCheckedChange={setHelperTracking} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mandatory Vehicle Registration</p>
                <p className="text-xs text-muted-foreground">Require all vehicles to be registered</p>
              </div>
              <Switch checked={vehicleRegistration} onCheckedChange={setVehicleRegistration} />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 animate-fade-in text-center">
            <div className="mx-auto h-20 w-20 rounded-full gradient-primary flex items-center justify-center shadow-glow">
              <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold">
                {societyName || "Your Society"} is ready!
              </h3>
              <p className="text-muted-foreground mt-2">
                Here's a summary of your setup:
              </p>
            </div>
            <Card className="p-4 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Society</span>
                <span className="font-medium">{societyName}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{city}{state ? `, ${state}` : ""}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Buildings</span>
                <span className="font-medium">{buildings.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Units</span>
                <span className="font-medium">{totalUnits}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Office Roles</span>
                <span className="font-medium">{roles.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invites Queued</span>
                <span className="font-medium">{invites.filter((i) => i.phone).length}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Security Staff</span>
                <span className="font-medium">{securityStaff.filter((s) => s.name).length}</span>
              </div>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Set Up Your Society</h1>
          <p className="text-muted-foreground mt-1">Complete in just a few minutes</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((step) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step.id === currentStep
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : step.id < currentStep
                    ? "bg-success text-success-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {step.id < currentStep ? "✓" : step.id}
              </div>
              {step.id < 7 && (
                <div className={`w-6 h-0.5 mx-1 ${step.id < currentStep ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="p-6 mb-6">
          <div className="mb-6">
            <h2 className="font-display text-lg font-semibold">
              {STEPS[currentStep - 1].title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {STEPS[currentStep - 1].description}
            </p>
          </div>
          {renderStep()}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={prev} disabled={currentStep === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {currentStep < 7 ? (
            <Button onClick={next} className="gradient-primary text-primary-foreground">
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleLaunchSociety}
              disabled={saving}
              className="gradient-primary text-primary-foreground"
            >
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <>Launch Society <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
