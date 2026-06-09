import { BadgeIcon } from "@/components/BadgeIcon";
import type { CommunityLevel } from "@/hooks/useCommunityLevel";

type CommunityLevelBadgeProps = {
  level: CommunityLevel | null | undefined;
  className?: string;
};

const CommunityLevelBadge = ({ level, className = "" }: CommunityLevelBadgeProps) => {
  if (!level) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-body font-semibold ${className}`}
      style={{
        backgroundColor: `${level.color}18`,
        color: level.color,
      }}
    >
      <BadgeIcon icon={level.icon} className="h-3.5 w-3.5" />
      {level.name}
    </span>
  );
};

export default CommunityLevelBadge;
