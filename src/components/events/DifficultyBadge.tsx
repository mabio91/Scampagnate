import { forwardRef } from "react";
import { Sprout, Footprints, Mountain, Dumbbell, Flame, type LucideIcon } from "lucide-react";

export const DIFFICULTY_LEVELS = [
  { level: "1", name: "Introduzione", color: "text-success", icon: Sprout, description: "Perfetto per chi è alle prime esperienze. Percorsi semplici, dislivello molto basso (fino a 150–200 m), ritmo rilassato, 1–2 ore." },
  { level: "2", name: "Esploratore", color: "text-success", icon: Footprints, description: "Adatto a chi ha già fatto qualche camminata o trekking facile. Dislivello moderato (200–400 m), 2–3 ore." },
  { level: "3", name: "Escursionista", color: "text-warning", icon: Mountain, description: "Adatto a persone moderatamente attive. Salite più lunghe (400–700 m), ritmo sostenuto, 3–5 ore." },
  { level: "4", name: "Intrepido", color: "text-orange-500", icon: Dumbbell, description: "Richiede una buona condizione fisica. Dislivello importante (700–1100 m), terreno più tecnico, 5–7 ore." },
  { level: "5", name: "Avanzato", color: "text-destructive", icon: Flame, description: "Solo per escursionisti esperti. Dislivello molto elevato (oltre 1100 m), lunghe distanze, 7+ ore." },
];

export const getDifficultyDetails = (difficulty: string | null | undefined) => {
  if (!difficulty) return null;
  const found = DIFFICULTY_LEVELS.find(d => d.level === difficulty || d.name === difficulty);
  return found || null;
};

interface DifficultyBadgeProps {
  difficulty: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export const DifficultyBadge = forwardRef<HTMLSpanElement, DifficultyBadgeProps>(
  ({ difficulty, className = "", showLabel = true }, ref) => {
    const details = getDifficultyDetails(difficulty);
    if (!details) return null;

    const Icon = details.icon;

    return (
      <span ref={ref} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-body font-semibold ${className}`}>
        <Icon className={`h-3.5 w-3.5 ${details.color}`} />
        {showLabel && details.name}
      </span>
    );
  }
);

DifficultyBadge.displayName = "DifficultyBadge";
