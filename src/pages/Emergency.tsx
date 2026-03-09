import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Flame,
  Heart,
  ShieldAlert,
  Siren,
  Info,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { getSocietyId } from "@/lib/society";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ALERT_TYPES = [
  {
    type: "medical",
    label: "Medical Emergency",
    icon: Heart,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20 hover:bg-red-500/20",
    description: "Heart attack, injury, unconscious person, or any medical crisis requiring immediate help.",
  },
  {
    type: "fire",
    label: "Fire",
    icon: Flame,
    color: "text-orange-500",
    bg: "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20",
    description: "Fire, smoke, or gas leak in your flat, building, or common areas.",
  },
  {
    type: "theft",
    label: "Theft / Intrusion",
    icon: ShieldAlert,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20",
    description: "Break-in, suspicious activity, unauthorized person, or theft in progress.",
  },
  {
    type: "other",
    label: "Other Emergency",
    icon: Siren,
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/20 hover:bg-destructive/20",
    description: "Any other serious situation requiring immediate security attention.",
  },
];

interface EmergencyAlert {
  id: string;
  alert_type: string;
  message: string | null;
  status: string;
  raised_by: string;
  created_at: string;
  resolved_at: string | null;
}

export default function Emergency() {
  const { user } = useAuth();
  const { isManagement, isSecurity } = useUserRole();
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmType, setConfirmType] = useState<typeof ALERT_TYPES[number] | null>(null);
  const [message, setMessage] = useState("");

  const fetchAlerts = async () => {
    const societyId = await getSocietyId();
    if (!societyId) return;
    const { data } = await supabase
      .from("emergency_alerts")
      .select("*")
      .eq("society_id", societyId)
      .order("created_at", { ascending: false })
      .limit(50);
    setAlerts((data as EmergencyAlert[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();

    const channel = supabase
      .channel("emergency-alerts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_alerts" },
        () => fetchAlerts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSendAlert = async () => {
    if (!confirmType || !user) return;
    setSending(true);
    const societyId = await getSocietyId();
    if (!societyId) {
      toast({ title: "Error", description: "Society not found.", variant: "destructive" });
      setSending(false);
      return;
    }

    const { error } = await supabase.from("emergency_alerts").insert({
      society_id: societyId,
      raised_by: user.id,
      alert_type: confirmType.type,
      message: message.trim() || null,
    });

    if (error) {
      toast({ title: "Failed to send alert", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "🚨 Emergency Alert Sent", description: `${confirmType.label} alert has been sent to security and office bearers.` });
    }
    setSending(false);
    setConfirmType(null);
    setMessage("");
  };

  const handleResolve = async (alertId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("emergency_alerts")
      .update({ status: "resolved", resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("id", alertId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Alert Resolved", description: "The emergency alert has been marked as resolved." });
    }
  };

  const activeAlerts = alerts.filter((a) => a.status === "active");
  const resolvedAlerts = alerts.filter((a) => a.status === "resolved");

  const getAlertMeta = (type: string) => ALERT_TYPES.find((t) => t.type === type) || ALERT_TYPES[3];

  return (
    <DashboardLayout title="Emergency Alerts">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* User Guide */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex gap-3 p-4">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                When should I use this?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use emergency alerts <strong>only for serious, time-sensitive situations</strong> such
                as a medical emergency, fire, gas leak, theft, or intrusion. Pressing a button
                below instantly notifies all security staff and office bearers in your society.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">✓ Medical crisis</Badge>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">✓ Fire / Gas leak</Badge>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">✓ Theft / Break-in</Badge>
                <Badge variant="outline" className="text-xs border-red-500/30 text-red-500">✗ Noise complaints</Badge>
                <Badge variant="outline" className="text-xs border-red-500/30 text-red-500">✗ Maintenance requests</Badge>
              </div>
              <p className="text-xs text-muted-foreground/70 italic">
                Misuse of emergency alerts may lead to action by the society management.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alert Buttons */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Raise an Alert</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Select the type of emergency. You'll be asked to confirm before the alert is sent.
                    Security and office bearers will be notified immediately.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {ALERT_TYPES.map((at) => (
                <button
                  key={at.type}
                  onClick={() => setConfirmType(at)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-5 transition-all cursor-pointer ${at.bg}`}
                >
                  <at.icon className={`h-8 w-8 ${at.color}`} />
                  <span className="text-sm font-semibold text-foreground">{at.label}</span>
                  <span className="text-[11px] text-muted-foreground text-center leading-tight">
                    {at.description}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
                Active Alerts ({activeAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeAlerts.map((alert) => {
                const meta = getAlertMeta(alert.alert_type);
                return (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                  >
                    <div className="flex gap-3">
                      <meta.icon className={`h-5 w-5 mt-0.5 ${meta.color}`} />
                      <div>
                        <p className="text-sm font-semibold">{meta.label}</p>
                        {alert.message && (
                          <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(alert.created_at), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                    {(isManagement || isSecurity) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => handleResolve(alert.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Resolved Alerts History */}
        {resolvedAlerts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Recent History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {resolvedAlerts.slice(0, 10).map((alert) => {
                const meta = getAlertMeta(alert.alert_type);
                return (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 rounded-lg border p-3 opacity-70"
                  >
                    <meta.icon className={`h-4 w-4 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      {alert.message && (
                        <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Resolved
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {!loading && alerts.length === 0 && (
          <Card className="p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium">All Clear</p>
            <p className="text-xs text-muted-foreground mt-1">No emergency alerts have been raised.</p>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmType} onOpenChange={(v) => { if (!v) { setConfirmType(null); setMessage(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Emergency Alert
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to send a <strong>{confirmType?.label}</strong> alert.
                  This will immediately notify all security staff and office bearers.
                </p>
                <Textarea
                  placeholder="Optional: Add details (e.g., location, what happened)..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
                <p className="text-xs text-destructive font-medium">
                  ⚠️ Only confirm if this is a genuine emergency.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendAlert}
              disabled={sending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {sending ? "Sending..." : "Send Alert Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
