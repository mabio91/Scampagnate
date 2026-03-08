import { Bell, BellRing, CalendarDays, CreditCard, Users, AlertCircle, CheckCheck, Clock, ArrowLeft } from "lucide-react";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, Notification } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";

const typeIcons: Record<string, React.ReactNode> = {
  registration: <CalendarDays className="h-5 w-5 text-primary" />,
  waitlist: <Users className="h-5 w-5 text-amber-500" />,
  waitlist_promotion: <Users className="h-5 w-5 text-green-500" />,
  payment: <CreditCard className="h-5 w-5 text-green-500" />,
  event_update: <AlertCircle className="h-5 w-5 text-blue-500" />,
  event_reminder: <Clock className="h-5 w-5 text-orange-500" />,
  issue_resolved: <CheckCheck className="h-5 w-5 text-green-500" />,
  info: <Bell className="h-5 w-5 text-muted-foreground" />,
};

const NotificationRow = ({ notification }: { notification: Notification }) => {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.event_id) {
      navigate(`/event/${notification.event_id}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-4 flex gap-3 items-start transition-colors hover:bg-muted/50 ${
        !notification.read ? "bg-primary/5" : ""
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {typeIcons[notification.type] || typeIcons.info}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${!notification.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: it })}
        </p>
      </div>
      {!notification.read && (
        <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5" />
      )}
    </button>
  );
};

const Notifications = () => {
  const { data: notifications, isLoading } = useNotifications();
  const markAllAsRead = useMarkAllAsRead();
  const hasUnread = notifications?.some((n) => !n.read);
  const navigate = useNavigate();
  const { isSupported, isSubscribed, subscribe, unsubscribe, isLoading: pushLoading } = usePushNotifications();

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success("Notifiche push disattivate");
    } else {
      const success = await subscribe();
      if (success) {
        toast.success("Notifiche push attivate!");
      } else {
        toast.error("Non è stato possibile attivare le notifiche push");
      }
    }
  };

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="font-display text-xl font-bold text-foreground">Notifiche</h1>
          </div>
          <div className="flex items-center gap-1">
            {isSupported && (
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs h-8 gap-1 ${isSubscribed ? "text-primary" : "text-muted-foreground"}`}
                onClick={handlePushToggle}
                disabled={pushLoading}
              >
                <BellRing className="h-3.5 w-3.5" />
                {isSubscribed ? "Push ON" : "Push"}
              </Button>
            )}
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 gap-1 text-muted-foreground"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Segna tutte
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Caricamento...</div>
      ) : !notifications?.length ? (
        <div className="p-12 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nessuna notifica</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Notifications;
