import { useEffect, useState } from "react";
import { Bell, AlertTriangle, Flame, Heart, ShieldAlert, Siren, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
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

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
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
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
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
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
  };

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
  };

  const getIcon = (n: Notification) => {
    if (n.type === "emergency") {
      const alertType = (n.metadata as Record<string, string>)?.alert_type || "other";
      const Icon = ALERT_ICONS[alertType] || AlertTriangle;
      const color = ALERT_COLORS[alertType] || "text-destructive";
      return <Icon className={`h-4 w-4 shrink-0 ${color}`} />;
    }
    return <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />;
  };

  return (
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
                    onClick={() => {
                      if (!n.is_read) markRead(n.id);
                    }}
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
                          <p className="text-xs text-muted-foreground">{n.body}</p>
                        )}
                        {n.type === "emergency" && meta.alert_message && (
                          <p className="text-xs text-foreground/80 italic">
                            "{meta.alert_message}"
                          </p>
                        )}
                        {n.type === "emergency" && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            {meta.raiser_name && (
                              <span>👤 {meta.raiser_name}</span>
                            )}
                            {meta.raiser_type && (
                              <span className="capitalize">({meta.raiser_type})</span>
                            )}
                            {meta.building && meta.unit && (
                              <span>🏠 {meta.building} - {meta.unit}</span>
                            )}
                            {meta.raiser_phone && (
                              <span>📞 {meta.raiser_phone}</span>
                            )}
                          </div>
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
  );
}
