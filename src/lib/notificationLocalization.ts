import type { Notification } from "@/hooks/useNotifications";

export type AppLanguage = "it" | "en";

type NotificationCopy = {
  title: string;
  message: string;
};

function translateIssueResolved(title: string, message: string, language: AppLanguage): NotificationCopy | null {
  const match = message.match(/^Your reported issue "(.+)" has been resolved\. Thank you for helping us improve!$/);
  if (title !== "Issue Resolved" && !match) return null;

  const issueTitle = match?.[1];
  if (language === "it") {
    return {
      title: "Problema risolto",
      message: issueTitle
        ? `Il problema che hai segnalato "${issueTitle}" è stato risolto. Grazie per averci aiutato a migliorare!`
        : "Il problema che hai segnalato è stato risolto. Grazie per averci aiutato a migliorare!",
    };
  }

  return {
    title: "Issue Resolved",
    message: issueTitle
      ? `Your reported issue "${issueTitle}" has been resolved. Thank you for helping us improve!`
      : "Your reported issue has been resolved. Thank you for helping us improve!",
  };
}

function translateSubscription(title: string, message: string, language: AppLanguage): NotificationCopy | null {
  const normalizedTitle = title.trim();
  if (normalizedTitle !== "Thanks for subscribing!" && normalizedTitle !== "Grazie per esserti iscritto!") {
    return null;
  }

  return language === "it"
    ? {
        title: "Grazie per esserti iscritto!",
        message: message || "Riceverai gli aggiornamenti di Scampagnate direttamente nelle notifiche.",
      }
    : {
        title: "Thanks for subscribing!",
        message: message || "You will receive Scampagnate updates directly in your notifications.",
      };
}

function replaceReminderNavigationLabel(message: string, language: AppLanguage): string {
  return message.replace(
    /🗺️\s*Apri navigazione:/g,
    language === "it" ? "🗺️ Apri navigazione:" : "🗺️ Open navigation:"
  );
}

export function localizeNotification(notification: Notification, language: AppLanguage): NotificationCopy {
  const issueResolved = translateIssueResolved(notification.title, notification.message, language);
  if (issueResolved) return issueResolved;

  const subscription = translateSubscription(notification.title, notification.message, language);
  if (subscription) return subscription;

  if (notification.type === "event_reminder_24h" || notification.type === "event_reminder_3h") {
    return {
      title: notification.title,
      message: replaceReminderNavigationLabel(notification.message, language),
    };
  }

  return {
    title: notification.title,
    message: notification.message,
  };
}
