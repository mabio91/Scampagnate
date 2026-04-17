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
    const iconName = value.replace("lucide:", "") as keyof typeof icons;
    const IconComponent = icons[iconName] as LucideIcon | undefined;

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
