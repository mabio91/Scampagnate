import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
  compact?: boolean;
}

const EmptyState = ({ icon: Icon, title, description, ctaLabel, ctaTo, onCtaClick, compact }: EmptyStateProps) => {
  const paddingClass = compact ? "p-4" : "p-6";

  return (
    <div className={`${paddingClass} rounded-2xl border border-dashed border-border bg-muted/30 text-center`}>
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-sm font-display font-bold text-foreground mb-1">{title}</p>
      <p className="text-xs font-body text-muted-foreground mb-4">{description}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          onClick={onCtaClick}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-body font-semibold hover:bg-primary/90 transition-colors"
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && !ctaTo && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-body font-semibold hover:bg-primary/90 transition-colors"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
