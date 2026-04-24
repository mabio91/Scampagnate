import { Bell, BellRing, CalendarDays, CreditCard, Users, AlertCircle, CheckCheck, Clock, ArrowLeft, MapPin, Navigation } from "lucide-react";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, Notification } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeNotification } from "@/lib/notificationLocalization";

const typeIcons: Record<string, React.ReactNode> = {
  registration: <CalendarDays className="h-5 w-5 text-primary" />,
  waitlist: <Users className="h-5 w-5 text-warning" />,
  waitlist_promotion: <Users className="h-5 w-5 text-success" />,
  payment: <CreditCard className="h-5 w-5 text-success" />,
  event_update: <AlertCircle className="h-5 w-5 text-secondary" />,
  event_reminder: <Clock className="h-5 w-5 text-accent" />,
  event_reminder_24h: <Clock className="h-5 w-5 text-orange-500" />,
  event_reminder_3h: <Clock className="h-5 w-5 text-destructive" />,
  issue_resolved: <CheckCheck className="h-5 w-5 text-success" />,
  info: <Bell className="h-5 w-5 text-muted-foreground" />,
};

const NotificationRow = ({ notification }: { notification: Notification }) => {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();
  const { language, t } = useLanguage();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.event_id) {
      navigate(`/event/${notification.event_id}`);
    }
  };

  const locale = language === "it" ? itLocale : enUS;
  const localized = localizeNotification(notification, language as "it" | "en");

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-4 flex gap-3 items-start transition-all duration-200 hover:bg-muted/50 active:bg-muted press-scale ${
        !notification.read ? "bg-primary/5" : ""
      }`}
    >
      <div className="mt-0.5 shrink-0 w-10 h-10 rounded-full bg-muted/80 flex items-center justify-center">
        {typeIcons[notification.type] || typeIcons.info}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${!notification.read ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
          {localized.title}
        </p>
        {(notification.type === "event_reminder_24h" || notification.type === "event_reminder_3h") ? (
          <div className="mt-1 space-y-1">
            {localized.message.split("\n").map((line, i) => {
              const cleanLine = line.replace(/(\d{2}:\d{2}):\d{2}/g, "$1");
              const mapsMatch = cleanLine.match(/🗺️.*?(https:\/\/\S+)/);
              if (mapsMatch) {
                return (
                  <a
                    key={i}
                    href={mapsMatch[1]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs font-body font-semibold text-primary hover:underline mt-1"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    {t("openNavigation")}
                  </a>
                );
              }
              if (cleanLine.includes("📍")) {
                return (
                  <p key={i} className="flex items-start gap-1 text-xs text-foreground font-body font-medium">
                    <MapPin className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
                    <span>{cleanLine.replace("📍 ", "")}</span>
                  </p>
                );
              }
              if (cleanLine.trim()) {
                return <p key={i} className="text-xs text-muted-foreground font-body line-clamp-2 leading-relaxed">{cleanLine}</p>;
              }
              return null;
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {localized.message.replace(/(\d{2}:\d{2}):\d{2}/g, "$1")}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-medium">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale })}
        </p>
      </div>
      {!notification.read && (
        <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2 animate-pulse" />
      )}
    </button>
  );
};

const Notifications = () => {
  const { data: notifications, isLoading } = useNotifications();
  const markAllAsRead = useMarkAllAsRead();
  const hasUnread = notifications?.some((n) => !n.read);
  const navigate = useNavigate();
  const { isSupported, canManagePush, isSubscribed, subscribe, unsubscribe, isLoading: pushLoading, errorMessage: pushError } = usePushNotifications();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const locale = language === "it" ? itLocale : enUS;

  const getDateGroup = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return language === "it" ? "Oggi" : "Today";
    if (isYesterday(date)) return language === "it" ? "Ieri" : "Yesterday";
    return format(date, "d MMMM", { locale });
  };

  const grouped = useMemo(() => {
    if (!notifications) return [];
    const groups: { label: string; items: Notification[] }[] = [];
    let currentLabel = "";
    for (const n of notifications) {
      const label = getDateGroup(n.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [n] });
      } else {
        groups[groups.length - 1].items.push(n);
      }
    }
    return groups;
  }, [notifications, language]);

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

  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors press-scale">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="font-display text-xl font-bold text-foreground">{t("notifications")}</h1>
          </div>
          <div className="flex items-center gap-1">
            {isSupported && (
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs h-8 gap-1 rounded-xl ${isSubscribed ? "text-primary" : "text-muted-foreground"}`}
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
                className="text-xs h-8 gap-1 text-muted-foreground rounded-xl"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("markAll")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !notifications?.length ? (
        <div className="p-16 text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Bell className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-body font-medium text-muted-foreground">{t("noNotifications")}</p>
          <p className="text-xs font-body text-muted-foreground/60 mt-1">{t("notificationsWillAppear")}</p>
        </div>
      ) : (
        <div className="stagger-children">
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-2">
                <p className="text-[11px] font-body font-bold text-muted-foreground/60 uppercase tracking-wider">
                  {group.label}
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {group.items.map((n) => (
                  <NotificationRow key={n.id} notification={n} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Notifications;
