import heroTrekking from "@/assets/hero-trekking.jpg";
import eventSocial from "@/assets/event-social.jpg";
import eventSport from "@/assets/event-sport.jpg";
import eventCulture from "@/assets/event-culture.jpg";

const imageMap: Record<string, string> = {
  trekking: heroTrekking,
  social: eventSocial,
  sport: eventSport,
  culture: eventCulture,
};

export const useEventImage = (key: string) => {
  return imageMap[key] || heroTrekking;
};
