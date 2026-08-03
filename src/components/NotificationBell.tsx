import { useEffect, useState } from "react";
import { Bell, AlertTriangle, Flame, Heart, ShieldAlert, Siren, CheckCheck, X, Clock, Phone, Mail, Home, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { tenantDb } from "@/services/tenantDb";
import { APP_SCHEMA } from "@/config/appConfig";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  metadata: Record<string, string> | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

const ALERT_ICONS: Record<string, typeof Heart> = {
  medical: Heart,
  fire: Flame,
  theft: ShieldAlert,
  other: Siren,
};

const ALERT_COLORS: Record<string, string> = {
  medical: "text-red-500",
  fire: "text-orange-500",
  theft: "text-yellow-500",
  other: "text-destructive",
};

const ALERT_BG: Record<string, string> = {
  medical: "bg-red-500/10",
  fire: "bg-orange-500/10",
  theft: "bg-yellow-500/10",
  other: "bg-destructive/10",
};

function getIconForType(alertType: string, size = "h-4 w-4") {
  const Icon = ALERT_ICONS[alertType] || AlertTriangle;
  const color = ALERT_COLORS[alertType] || "text-destructive";
  return <Icon className={`${size} shrink-0 ${color}`} />;
}

function NotificationDetailModal({
  notification,
  open,
  onOpenChange,
}: {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!notification) return null;
  const meta = (notification.metadata || {}) as Record<string, string>;
  const alertType = meta.alert_type || "other";
  const bg = ALERT_BG[alertType] || "bg-destructive/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2.5 ${bg}`}>
              {getIconForType(alertType, "h-6 w-6")}
            </div>
            <div>
              <DialogTitle className="text-base">{notification.title}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {format(new Date(notification.created_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Alert Summary */}
        {notification.body && (
          <div>
            <p className="text-sm text-foreground">{notification.body}</p>
          </div>
        )}

        {/* User's Note / Message */}
        {meta.alert_message && (
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Alert Note
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              "{meta.alert_message}"
            </p>
          </div>
        )}

        {/* Raiser Details */}
        {notification.type === "emergency" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Raised By
            </p>
            <div className="rounded-lg border p-3 space-y-2.5">
              {meta.raiser_name && (
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{meta.raiser_name}</p>
                    {meta.raiser_type && (
                      <p className="text-xs text-muted-foreground capitalize">{meta.raiser_type}</p>
                    )}
                  </div>
                </div>
              )}
              {(meta.building || meta.unit) && (
                <div className="flex items-center gap-2.5">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">
                    {[meta.building, meta.unit].filter(Boolean).join(" — ")}
                  </p>
                </div>
              )}
              {meta.raiser_phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${meta.raiser_phone}`} className="text-sm text-primary hover:underline">
                    {meta.raiser_phone}
                  </a>
                </div>
              )}
              {meta.raiser_email && (
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${meta.raiser_email}`} className="text-sm text-primary hover:underline">
                    {meta.raiser_email}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timestamp Details */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Timeline
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Alert raised: {format(new Date(notification.created_at), "MMM d, yyyy — h:mm:ss a")}</span>
          </div>
          {meta.raised_at && meta.raised_at !== notification.created_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Originated: {format(new Date(meta.raised_at), "MMM d, yyyy — h:mm:ss a")}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await tenantDb.from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications((data as Notification[]) || []);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: APP_SCHEMA, table: "notifications" },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await tenantDb.from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
  };

  const markRead = async (id: string) => {
    await tenantDb.from("notifications")
      .update({ is_read: true })
      .eq("id", id);
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    setSelectedNotification(n);
  };

  const getIcon = (n: Notification) => {
    if (n.type === "emergency") {
      const alertType = (n.metadata as Record<string, string>)?.alert_type || "other";
      return getIconForType(alertType);
    }
    return <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />;
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((n) => {
                  const meta = (n.metadata || {}) as Record<string, string>;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-accent/50 ${
                        !n.is_read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5">{getIcon(n)}</div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">{n.title}</p>
                            {!n.is_read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1" />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground/60">
                            {format(new Date(n.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <NotificationDetailModal
        notification={selectedNotification}
        open={!!selectedNotification}
        onOpenChange={(v) => {
          if (!v) setSelectedNotification(null);
        }}
      />
    </>
  );
}
