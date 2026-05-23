export const HOME_CARD_IMAGE_FIELD = "home_card_image_url";

type EventImageLike = {
  image_url?: string | null;
  additional_fields?: unknown;
};

const getAdditionalFieldString = (fields: unknown, key: string): string | null => {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  const value = (fields as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
};

export const getEventHomeCardImageUrl = (event: EventImageLike): string | null =>
  getAdditionalFieldString(event.additional_fields, HOME_CARD_IMAGE_FIELD);

export const getEventHomeCardImageSrc = (event: EventImageLike): string | null =>
  getEventHomeCardImageUrl(event) || event.image_url || null;
