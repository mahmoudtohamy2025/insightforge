import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell, Trash2, Info, AlertCircle, CheckCircle2,
  DollarSign, Target, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  success:     <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warning:     <AlertCircle className="h-4 w-4 text-orange-500" />,
  error:       <AlertCircle className="h-4 w-4 text-destructive" />,
  study_match: <Target className="h-4 w-4 text-primary" />,
  payment:     <DollarSign className="h-4 w-4 text-green-500" />,
  approval:    <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  simulation:  <Zap className="h-4 w-4 text-amber-500" />,
  info:        <Info className="h-4 w-4 text-blue-500" />,
};

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (!error && data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (n: Notification) => {
    if (n.is_read) {
      // If already read, just navigate
      if (n.link) navigate(n.link);
      return;
    }
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    if (n.link) { setIsOpen(false); navigate(n.link); }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isUnread = notifications.find((n) => n.id === id)?.is_read === false;
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (isUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const badgeCount = Math.min(unreadCount, 99);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-bold leading-none",
              badgeCount > 9 ? "text-[8px] min-w-[16px] h-4 px-1" : "text-[9px] h-4 w-4"
            )}>
              {badgeCount > 9 ? `${badgeCount}+` : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-0 text-xs font-normal text-primary hover:bg-transparent hover:text-primary/80"
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Bell className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-medium text-sm">You're all caught up!</p>
                <p className="text-xs text-muted-foreground mt-0.5">No notifications right now.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n)}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors group relative",
                    !n.is_read && "bg-primary/[0.04]"
                  )}
                >
                  {/* Unread dot */}
                  {!n.is_read && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}

                  <div className="mt-0.5 shrink-0">
                    {TYPE_ICON[n.type] || TYPE_ICON.info}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-snug",
                      !n.is_read ? "font-semibold text-foreground" : "font-medium"
                    )}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-0.5"
                    onClick={(e) => deleteNotification(n.id, e)}
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2 bg-muted/10 text-center">
            <p className="text-[10px] text-muted-foreground">
              Showing latest {notifications.length} notifications
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
