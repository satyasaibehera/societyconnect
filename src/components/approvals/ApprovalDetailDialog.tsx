import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Phone, Mail, Home, Calendar, Car, Shield, Wrench, PackageOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ApprovalDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  category: string | null;
}

export function ApprovalDetailDialog({ open, onOpenChange, itemId, category }: ApprovalDetailDialogProps) {
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !itemId || !category) return;
    setLoading(true);
    fetchDetail();
  }, [open, itemId, category]);

  const fetchDetail = async () => {
    if (!itemId || !category) return;
    try {
      let query: any;
      switch (category) {
        case "visitors":
          query = supabase.from("visitors").select("*").eq("id", itemId).single();
          break;
        case "residents":
          query = supabase.from("residents").select("*, units(unit_number, buildings(name)), societies(name)").eq("id", itemId).single();
          break;
        case "helpers":
          query = supabase.from("helpers").select("*, societies(name)").eq("id", itemId).single();
          break;
        case "vehicles":
          query = supabase.from("vehicles").select("*, residents(full_name, unit_id, units(unit_number, buildings(name))), societies(name)").eq("id", itemId).single();
          break;
        case "role_requests":
          query = supabase.from("role_requests").select("*, societies(name)").eq("id", itemId).single();
          break;
        case "move_passes":
          query = supabase.from("move_passes").select("*, units(unit_number, buildings(name)), societies(name)").eq("id", itemId).single();
          break;
        default:
          setLoading(false);
          return;
      }
      const { data } = await query;

      // For role_requests, also fetch the requester profile
      if (category === "role_requests" && data?.requester_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", data.requester_id)
          .single();
        if (profile) {
          data._requester_profile = profile;
        }
      }

      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const icons: Record<string, typeof User> = {
    visitors: User, residents: Home, helpers: Wrench,
    vehicles: Car, role_requests: Shield, move_passes: PackageOpen,
  };
  const Icon = icons[category || "visitors"] || User;

  const renderField = (label: string, value: any) => {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-sm">{String(value)}</span>
      </div>
    );
  };

  const renderContent = () => {
    if (!detail) return <p className="text-sm text-muted-foreground">No details found.</p>;

    switch (category) {
      case "residents":
        return (
          <div className="grid grid-cols-2 gap-4">
            {renderField("Full Name", detail.full_name)}
            {renderField("Email", detail.email)}
            {renderField("Phone", detail.phone)}
            {renderField("Gender", detail.gender)}
            {renderField("Date of Birth", detail.date_of_birth)}
            {renderField("Age", detail.age)}
            {renderField("Resident Type", detail.resident_type)}
            {renderField("Relationship", detail.relationship)}
            {renderField("Society", detail.societies?.name)}
            {renderField("Building", detail.units?.buildings?.name)}
            {renderField("Unit", detail.units?.unit_number)}
            {renderField("Tenancy Start", detail.tenancy_start_date)}
            {renderField("Tenancy End", detail.tenancy_end_date)}
            {renderField("Submitted", new Date(detail.created_at).toLocaleString())}
            {detail.photo_url && (
              <div className="col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Photo</span>
                <img src={detail.photo_url} alt="Resident" className="mt-1 h-24 w-24 rounded-lg object-cover border" />
              </div>
            )}
          </div>
        );
      case "visitors":
        return (
          <div className="grid grid-cols-2 gap-4">
            {renderField("Name", detail.name)}
            {renderField("Phone", detail.phone)}
            {renderField("Purpose", detail.purpose)}
            {renderField("Visiting Unit", detail.visiting_unit_label)}
            {renderField("Entry Time", detail.entry_time && new Date(detail.entry_time).toLocaleString())}
            {renderField("Submitted", new Date(detail.created_at).toLocaleString())}
          </div>
        );
      case "helpers":
        return (
          <div className="grid grid-cols-2 gap-4">
            {renderField("Name", detail.name)}
            {renderField("Phone", detail.phone)}
            {renderField("Service Type", detail.service_type)}
            {renderField("Society", detail.societies?.name)}
            {renderField("Submitted", new Date(detail.created_at).toLocaleString())}
            {detail.photo_url && (
              <div className="col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Photo</span>
                <img src={detail.photo_url} alt="Helper" className="mt-1 h-24 w-24 rounded-lg object-cover border" />
              </div>
            )}
          </div>
        );
      case "vehicles":
        return (
          <div className="grid grid-cols-2 gap-4">
            {renderField("Vehicle Number", detail.vehicle_number)}
            {renderField("Vehicle Type", detail.vehicle_type)}
            {renderField("Parking Slot", detail.parking_slot)}
            {renderField("Ownership", detail.ownership_type)}
            {renderField("Resident", detail.residents?.full_name)}
            {renderField("Building", detail.residents?.units?.buildings?.name)}
            {renderField("Unit", detail.residents?.units?.unit_number)}
            {renderField("Submitted", new Date(detail.created_at).toLocaleString())}
          </div>
        );
      case "role_requests":
        return (
          <div className="grid grid-cols-2 gap-4">
            {renderField("Requested Role", detail.requested_role)}
            {renderField("Reason", detail.reason)}
            {renderField("Requester Name", detail._requester_profile?.full_name)}
            {renderField("Requester Phone", detail._requester_profile?.phone)}
            {renderField("Society", detail.societies?.name)}
            {renderField("Submitted", new Date(detail.created_at).toLocaleString())}
          </div>
        );
      case "move_passes":
        return (
          <div className="grid grid-cols-2 gap-4">
            {renderField("Pass Type", detail.pass_type === "move_in" ? "Move In" : "Move Out")}
            {renderField("Status", detail.status)}
            {renderField("Tenant Name", detail.tenant_name)}
            {renderField("Tenant Phone", detail.tenant_phone)}
            {renderField("Tenant Email", detail.tenant_email)}
            {renderField("Building", detail.units?.buildings?.name)}
            {renderField("Unit", detail.units?.unit_number)}
            {renderField("Scheduled Date", detail.scheduled_date)}
            {renderField("Scheduled Time", detail.scheduled_time)}
            {renderField("Vehicle", detail.vehicle_number)}
            {renderField("Vehicle Type", detail.vehicle_type)}
            {renderField("Purpose", detail.purpose)}
            {renderField("Notes", detail.notes)}
            {renderField("Submitted", new Date(detail.created_at).toLocaleString())}
          </div>
        );
      default:
        return null;
    }
  };

  const categoryLabels: Record<string, string> = {
    visitors: "Visitor", residents: "Resident", helpers: "Helper",
    vehicles: "Vehicle", role_requests: "Role Request", move_passes: "Move Pass",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {categoryLabels[category || ""] || "Request"} Details
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="pt-2">{renderContent()}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
