import { useState, forwardRef } from "react";
import { Bell, BellRing, CalendarDays, CreditCard, Users, AlertCircle, CheckCheck, Clock } from "lucide-react";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, Notification } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeNotification } from "@/lib/notificationLocalization";

const typeIcons: Record<string, React.ReactNode> = {
  registration: <CalendarDays className="h-4 w-4 text-primary" />,
  waitlist: <Users className="h-4 w-4 text-amber-500" />,
  waitlist_promotion: <Users className="h-4 w-4 text-green-500" />,
  payment: <CreditCard className="h-4 w-4 text-green-500" />,
  event_update: <AlertCircle className="h-4 w-4 text-blue-500" />,
  event_reminder: <Clock className="h-4 w-4 text-orange-500" />,
  event_reminder_24h: <Clock className="h-4 w-4 text-orange-500" />,
  event_reminder_3h: <Clock className="h-4 w-4 text-red-500" />,
  issue_resolved: <CheckCheck className="h-4 w-4 text-green-500" />,
  info: <Bell className="h-4 w-4 text-muted-foreground" />,
};

const NotificationItem = forwardRef<HTMLButtonElement, { notification: Notification; onRead: () => void; onSelect: (n: Notification) => void }>(
  ({ notification, onRead, onSelect }, ref) => {
    const navigate = useNavigate();
    const markAsRead = useMarkAsRead();
    const { language } = useLanguage();
    const locale = language === "it" ? it : enUS;
    const localized = localizeNotification(notification, language as "it" | "en");

    const handleClick = () => {
      if (!notification.read) {
        markAsRead.mutate(notification.id);
      }
      onSelect(notification);
      onRead();
      navigate("/notifications");
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={`w-full text-left p-3 flex gap-3 items-start transition-colors hover:bg-muted/50 ${
          !notification.read ? "bg-primary/5" : ""
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {typeIcons[notification.type] || typeIcons.info}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-tight ${!notification.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {localized.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {localized.message}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale })}
          </p>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
        )}
      </button>
    );
  },
);

NotificationItem.displayName = "NotificationItem";

const NotificationPanel = forwardRef<HTMLDivElement, { onClose: () => void }>(({ onClose }, ref) => {
  const { data: notifications, isLoading } = useNotifications();
  const markAllAsRead = useMarkAllAsRead();
  const hasUnread = notifications?.some((n) => !n.read);
  const { isSupported, canManagePush, isSubscribed, subscribe, unsubscribe, isLoading: pushLoading, errorMessage: pushError } = usePushNotifications();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const locale = language === "it" ? it : enUS;

  const handlePushToggle = async () => {
    if (!canManagePush && pushError) {
      toast({ title: pushError, variant: "destructive" });
      return;
    }

    if (isSubscribed) {
      await unsubscribe();
      toast({ title: language === "it" ? "Notifiche push disattivate" : "Push notifications disabled" });
    } else {
      const success = await subscribe();
      if (success) {
        toast({ title: language === "it" ? "Notifiche push attivate!" : "Push notifications enabled!" });
      } else {
        toast({
          title: pushError || (language === "it" ? "Non è stato possibile attivare le notifiche push" : "Could not enable push notifications"),
          variant: "destructive",
        });
      }
    }
  };

  if (selectedNotification) {
    const localized = localizeNotification(selectedNotification, language as "it" | "en");

    return (
      <div ref={ref} className="w-[calc(100vw-2rem)] max-w-80 max-h-[70vh] flex flex-col bg-background rounded-xl border border-border shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedNotification(null)}>
            {"<-"}
          </Button>
          <h3 className="font-display font-semibold text-sm truncate">{localized.title}</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            {typeIcons[selectedNotification.type] || typeIcons.info}
            <span className="text-xs font-medium text-muted-foreground capitalize">{selectedNotification.type.replace(/_/g, " ")}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{localized.message}</p>
          <p className="text-[10px] text-muted-foreground/60">
            {formatDistanceToNow(new Date(selectedNotification.created_at), { addSuffix: true, locale })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="w-[calc(100vw-2rem)] max-w-80 flex flex-col bg-background rounded-xl border border-border shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm">{t("notifications")}</h3>
        <div className="flex items-center gap-1">
          {isSupported && (
            <Button
              variant="ghost"
              size="sm"
              className={`text-xs h-7 gap-1 ${isSubscribed ? "text-primary" : "text-muted-foreground"}`}
              onClick={handlePushToggle}
              disabled={pushLoading}
            >
              <BellRing className="h-3.5 w-3.5" />
              {isSubscribed ? t("pushOn") : t("push")}
            </Button>
          )}
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1 text-muted-foreground"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("markAll")}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[60vh] overscroll-contain">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{language === "it" ? "Caricamento..." : "Loading..."}</div>
        ) : !notifications?.length ? (
          <div className="p-6 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("noNotifications")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={onClose} onSelect={setSelectedNotification} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

NotificationPanel.displayName = "NotificationPanel";
export default NotificationPanel;
