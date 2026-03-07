import { 
  Sprout, Footprints, Compass, Mountain, Trophy, Crown, 
  Sunrise, Wine, Flame, Sparkles, Medal,
  type LucideIcon 
} from "lucide-react";

// Maps DB badge icons (emojis) to Lucide components
const BADGE_ICON_MAP: Record<string, LucideIcon> = {
  "🌱": Sprout,
  "🥾": Footprints,
  "🗺": Compass,
  "⛰": Mountain,
  "🏆": Trophy,
  "👑": Crown,
  "🌅": Sunrise,
  "🍸": Wine,
  "🔥": Flame,
  "💫": Sparkles,
  "🏅": Medal,
};

export const getBadgeIcon = (emojiIcon: string): LucideIcon => {
  return BADGE_ICON_MAP[emojiIcon] || Sparkles;
};

export const BadgeIcon = ({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) => {
  const Icon = getBadgeIcon(icon);
  return <Icon className={className} />;
};
