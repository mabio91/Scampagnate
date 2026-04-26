import { memo } from "react";
import { icons, type LucideIcon } from "lucide-react";

interface DynamicIconProps {
  value: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

function DynamicIconInner({ value, className = "", size = 20, style }: DynamicIconProps) {
  if (!value) return null;

  if (value.startsWith("lucide:")) {
    const rawIconName = value.replace("lucide:", "").trim();
    const normalizedIconName = rawIconName
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("");

    const iconCandidates = [
      rawIconName,
      normalizedIconName,
      rawIconName.charAt(0).toUpperCase() + rawIconName.slice(1),
    ] as (keyof typeof icons)[];

    const IconComponent = iconCandidates
      .map((candidate) => icons[candidate] as LucideIcon | undefined)
      .find(Boolean);

    if (IconComponent) {
      return <IconComponent className={className} size={size} style={style} />;
    }
    return <span className={className} style={{ fontSize: size * 0.8, ...style }}>?</span>;
  }

  return (
    <span className={className} style={{ fontSize: size, ...style }} role="img">
      {value}
    </span>
  );
}

const DynamicIcon = memo(DynamicIconInner);
export default DynamicIcon;
