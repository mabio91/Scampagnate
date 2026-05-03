import { useCommunityLevel, type CommunityLevel } from "@/hooks/useCommunityLevel";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface LevelAvatarProps {
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  points?: number;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  showLevelLabel?: boolean;
  className?: string;
  level?: CommunityLevel | null;
}

const LEVEL_ICONS: Record<number, string> = {
  1: "",
  2: "⭐",
  3: "⭐",
  4: "⭐⭐",
  5: "👑",
  6: "👑🔥",
};

const SIZE_MAP = {
  sm: { avatar: "w-9 h-9", ring: 2, badge: "text-[8px] -bottom-0.5 -right-0.5 w-4 h-4", multiBadge: "text-[8px] -bottom-0.5 -right-1.5 w-6 h-4" },
  md: { avatar: "w-11 h-11", ring: 2.5, badge: "text-[9px] -bottom-0.5 -right-0.5 w-5 h-5", multiBadge: "text-[9px] -bottom-0.5 -right-2 w-7 h-5" },
  lg: { avatar: "w-16 h-16", ring: 3, badge: "text-xs -bottom-1 -right-1 w-6 h-6", multiBadge: "text-xs -bottom-1 -right-3 w-9 h-6" },
};

const LevelAvatar = ({
  avatarUrl,
  firstName,
  lastName,
  points = 0,
  size = "md",
  showBadge = true,
  showLevelLabel = false,
  className = "",
  level: externalLevel,
}: LevelAvatarProps) => {
  const { data: fetchedLevel } = useCommunityLevel(points);
  const level = externalLevel ?? fetchedLevel;
  const sizeConfig = SIZE_MAP[size];
  const levelIcon = level ? LEVEL_ICONS[level.level_number] || "" : "";
  const levelIconParts = Array.from(levelIcon);
  const levelColor = level?.color || "hsl(var(--muted-foreground))";
  const isHighLevel = level && level.level_number >= 5;

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      <div
        className="rounded-full p-[2px]"
        style={{
          background: level && level.level_number >= 2
            ? `linear-gradient(135deg, ${levelColor}, ${levelColor}88)`
            : "transparent",
          boxShadow: isHighLevel ? `0 0 12px ${levelColor}40` : undefined,
        }}
      >
        <Avatar className={sizeConfig.avatar}>
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={firstName || ""} className="object-cover" />
          ) : null}
          <AvatarFallback className="text-sm font-display font-bold text-primary bg-primary/20">
            {firstName?.[0] || "?"}{lastName?.[0] || ""}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Level badge overlay */}
      {showBadge && levelIcon && level && level.level_number >= 2 && (
        <span
          className={`absolute ${levelIconParts.length > 1 ? sizeConfig.multiBadge : sizeConfig.badge} rounded-full bg-background border border-border flex items-center justify-center overflow-hidden leading-none`}
          title={level.name}
        >
          {levelIconParts.length > 1 ? (
            <span className="flex h-full w-full flex-row items-center justify-center gap-0.5 px-0.5 leading-none">
              {levelIconParts.map((icon, index) => (
                <span key={`${icon}-${index}`} className="block shrink-0 text-center leading-none">
                  {icon}
                </span>
              ))}
            </span>
          ) : (
            <span className="block translate-y-px text-center leading-none">
              {levelIcon}
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export default LevelAvatar;
