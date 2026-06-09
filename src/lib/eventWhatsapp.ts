type EventWhatsappLinkRelation =
  | { url?: string | null }
  | { url?: string | null }[]
  | null
  | undefined;

const WHATSAPP_GROUP_URL_PREFIX = "https://chat.whatsapp.com/";

export const normalizeWhatsappGroupUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const url = value.trim();
  if (!url.toLowerCase().startsWith(WHATSAPP_GROUP_URL_PREFIX)) return null;

  return url;
};

const ACTIVE_WHATSAPP_REGISTRATION_STATUSES = new Set([
  "registered",
  "deposit_paid",
  "paid",
  "attended",
  "no_show",
]);

export const canRegistrationViewWhatsappGroup = (
  registration:
    | {
        status?: string | null;
        payment_status?: string | null;
      }
    | null
    | undefined,
): boolean => {
  if (!registration) return false;

  const status = (registration.status || "").trim().toLowerCase();
  const paymentStatus = (registration.payment_status || "").trim().toLowerCase();

  return ACTIVE_WHATSAPP_REGISTRATION_STATUSES.has(status) && paymentStatus !== "pending";
};

export const resolveEventWhatsappGroupUrl = (
  event:
    | {
        whatsapp_group_url?: string | null;
        event_whatsapp_links?: EventWhatsappLinkRelation;
      }
    | null
    | undefined,
): string | null => {
  const directUrl = normalizeWhatsappGroupUrl(event?.whatsapp_group_url);
  if (directUrl) return directUrl;

  const relation = event?.event_whatsapp_links;
  const row = Array.isArray(relation) ? relation[0] : relation;

  return normalizeWhatsappGroupUrl(row?.url);
};
