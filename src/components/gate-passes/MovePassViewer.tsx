import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine, ArrowUpFromLine, CalendarDays, Phone, Mail,
  Car, FileCheck, Clock, Check, User, Home, Printer, QrCode, X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

interface MovePassData {
  id: string;
  pass_type: string;
  status: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  tenant_email: string | null;
  purpose: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
  dues_cleared: boolean;
  owner_approved_by: string | null;
  owner_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  created_at: string;
  unit_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pass: MovePassData | null;
  unitLabel?: string;
}

export function MovePassViewer({ open, onOpenChange, pass, unitLabel }: Props) {
  const [showLargeQr, setShowLargeQr] = useState(false);

  if (!pass) return null;
  const isMoveIn = pass.pass_type === "move_in";
  const qrValue = JSON.stringify({
    passId: pass.id,
    type: pass.pass_type,
    status: pass.status,
    date: pass.scheduled_date,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] print:shadow-none print:border-none">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-success" />
            Move {isMoveIn ? "In" : "Out"} Gate Pass
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto -mx-1 px-1">
        <div className="space-y-4 pb-2" id="gate-pass-content">
          {/* Header with QR */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isMoveIn ? (
                  <ArrowDownToLine className="h-5 w-5 text-success" />
                ) : (
                  <ArrowUpFromLine className="h-5 w-5 text-destructive" />
                )}
                <span className="text-lg font-bold capitalize">
                  {isMoveIn ? "Move In Pass" : "Move Out Pass"}
                </span>
              </div>
              <Badge
                className={
                  pass.status === "approved"
                    ? "bg-success text-success-foreground"
                    : "bg-warning text-warning-foreground"
                }
              >
                {pass.status === "approved" ? "APPROVED" : pass.status.toUpperCase().replace("_", " ")}
              </Badge>
            </div>
            <button
              onClick={() => setShowLargeQr(true)}
              className="shrink-0 border rounded-lg p-2 bg-card cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all active:scale-95"
              title="Tap to enlarge QR code"
            >
              <QRCodeSVG value={qrValue} size={80} />
            </button>
          </div>

          {/* Pass ID */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
            <QrCode className="h-3 w-3" />
            <span className="font-mono">Pass ID: {pass.id.slice(0, 8).toUpperCase()}</span>
          </div>

          <Separator />

          {/* Tenant Details */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tenant Details</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={User} label="Name" value={pass.tenant_name || "—"} />
              <InfoRow icon={Home} label="Flat / Unit" value={unitLabel || "—"} />
              <InfoRow icon={Phone} label="Phone" value={pass.tenant_phone || "—"} />
              <InfoRow icon={Mail} label="Email" value={pass.tenant_email || "—"} />
            </div>
          </div>

          <Separator />

          {/* Pass Details */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pass Details</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow
                icon={CalendarDays}
                label="Date"
                value={pass.scheduled_date ? format(new Date(pass.scheduled_date), "dd MMM yyyy") : "—"}
              />
              <InfoRow
                icon={Clock}
                label="Time"
                value={pass.scheduled_time || "—"}
              />
              <InfoRow
                icon={FileCheck}
                label="Purpose"
                value={pass.purpose || "Personal belongings"}
                fullWidth
              />
            </div>
          </div>

          {/* Vehicle details if provided */}
          {(pass.vehicle_number || pass.vehicle_type) && (
            <>
              <Separator />
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehicle Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow icon={Car} label="Vehicle No." value={pass.vehicle_number || "—"} />
                  <InfoRow icon={Car} label="Type" value={pass.vehicle_type || "—"} />
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Approvals Audit Trail */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approval Audit Trail</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>Requested: {format(new Date(pass.created_at), "dd MMM yyyy, hh:mm a")}</span>
              </div>
              {pass.owner_approved_at && (
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-success" />
                  <span>Owner Approved: {format(new Date(pass.owner_approved_at), "dd MMM yyyy, hh:mm a")}</span>
                </div>
              )}
              {pass.admin_approved_at && (
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-success" />
                  <span>Admin Approved: {format(new Date(pass.admin_approved_at), "dd MMM yyyy, hh:mm a")}</span>
                </div>
              )}
              {pass.dues_cleared && (
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-success" />
                  <span className="text-success font-medium">Outstanding Dues: Cleared ✓</span>
                </div>
              )}
            </div>
          </div>

          {pass.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm">{pass.notes}</p>
              </div>
            </>
          )}
        </div>
        </ScrollArea>

        {/* Print button */}
        <div className="flex justify-end gap-2 pt-2 shrink-0 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Print Pass
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  fullWidth,
}: {
  icon: typeof User;
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="font-medium">{value}</p>
    </div>
  );
}
