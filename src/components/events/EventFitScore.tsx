import { AlertTriangle, User, Info } from "lucide-react";
import { FitScoreResult } from "@/hooks/useEventFitScore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventFitScoreProps {
  fitScore: FitScoreResult;
  /** Compact mode for participant lists */
  compact?: boolean;
}

const colorMap = {
  green: {
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800/30",
    text: "text-green-700 dark:text-green-400",
    bar: "bg-green-500",
    icon: "text-green-600",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800/30",
    text: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
    icon: "text-amber-600",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/10",
    border: "border-red-200/60 dark:border-red-800/20",
    text: "text-red-600 dark:text-red-400",
    bar: "bg-red-400",
    icon: "text-red-500",
  },
};

const breakdownLabels: Record<string, string> = {
  level: "Livello",
  experience: "Esperienza",
  activity: "Attività fisica",
  interests: "Interessi",
};

/** Full display for event detail page */
const EventFitScore = ({ fitScore, compact = false }: EventFitScoreProps) => {
  const [showDetails, setShowDetails] = useState(false);

  if (fitScore.hidden) return null;

  // Profile incomplete state
  if (fitScore.profileIncomplete) {
    return (
      <div className="p-3 rounded-xl bg-muted/50 border border-border/50 flex items-start gap-3">
        <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-body text-muted-foreground">
            <Link to="/profile" className="text-primary underline underline-offset-2 font-semibold">
              Completa il tuo profilo
            </Link>{" "}
            per vedere la compatibilità con questo evento.
          </p>
        </div>
      </div>
    );
  }

  const colors = colorMap[fitScore.color];

  if (compact) {
    return <EventFitScoreCompact fitScore={fitScore} />;
  }

  return (
    <>
      <div className={`p-3 rounded-xl ${colors.bg} border ${colors.border}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider">
              Compatibilità
            </p>
            <button
              onClick={() => setShowDetails(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dettagli compatibilità"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className={`text-lg font-display font-bold ${colors.text}`}>
            {fitScore.score}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden mb-2.5">
          <div
            className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${fitScore.score}%` }}
          />
        </div>

        {/* Label + short reasons */}
        <p className={`text-sm font-body font-semibold ${colors.text}`}>
          {fitScore.color === "green" ? "🟢" : fitScore.color === "amber" ? "🟡" : "🔴"}{" "}
          {fitScore.labelDisplay} — {fitScore.score}%
        </p>

        {fitScore.reasons.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {fitScore.reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs font-body text-foreground/70">
                {r.icon === "check" ? (
                  <span className="text-green-600 shrink-0">✓</span>
                ) : (
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                )}
                <span>{r.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-display">Dettagli compatibilità</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Overall score */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-body text-muted-foreground">Punteggio complessivo</span>
              <span className={`text-lg font-display font-bold ${colors.text}`}>
                {fitScore.score}%
              </span>
            </div>

            <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                style={{ width: `${fitScore.score}%` }}
              />
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5 pt-1">
              {(Object.keys(fitScore.breakdown) as (keyof typeof fitScore.breakdown)[]).map((key) => {
                const val = fitScore.breakdown[key];
                if (val === null) return null;
                const barColor = val >= 80 ? "bg-green-500" : val >= 50 ? "bg-amber-500" : "bg-red-400";
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs font-body mb-1">
                      <span className="text-muted-foreground">{breakdownLabels[key]}</span>
                      <span className="font-semibold">{val}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs font-body text-muted-foreground leading-relaxed">
                Il punteggio di compatibilità viene calcolato in base al tuo profilo e ai requisiti dell'evento:
              </p>
              <ul className="mt-2 space-y-1 text-xs font-body text-muted-foreground list-disc pl-4">
                <li><strong>Livello</strong> — confronto con la difficoltà richiesta</li>
                <li><strong>Esperienza</strong> — anni di pratica nell'attività</li>
                <li><strong>Attività fisica</strong> — frequenza di allenamento settimanale</li>
                <li><strong>Interessi</strong> — affinità con la categoria dell'evento</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Compact display for organizer participant lists */
export const EventFitScoreCompact = ({ fitScore }: { fitScore: FitScoreResult }) => {
  if (fitScore.hidden || fitScore.profileIncomplete) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const colors = colorMap[fitScore.color];
  const labelMap = { alta: "Alta", media: "Media", bassa: "Bassa" };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <div className={`h-2 w-2 rounded-full ${colors.bar}`} />
            <span className={`text-xs font-body font-semibold ${colors.text}`}>
              {fitScore.score}%
            </span>
            <span className="text-[10px] font-body text-muted-foreground">
              {labelMap[fitScore.label]}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <p className="text-xs font-body font-bold mb-1.5">
            {fitScore.labelDisplay} — {fitScore.score}%
          </p>
          <div className="space-y-1">
            {fitScore.breakdown.level !== null && (
              <div className="flex justify-between text-xs font-body">
                <span className="text-muted-foreground">Livello</span>
                <span className="font-semibold">{fitScore.breakdown.level}%</span>
              </div>
            )}
            {fitScore.breakdown.experience !== null && (
              <div className="flex justify-between text-xs font-body">
                <span className="text-muted-foreground">Esperienza</span>
                <span className="font-semibold">{fitScore.breakdown.experience}%</span>
              </div>
            )}
            {fitScore.breakdown.activity !== null && (
              <div className="flex justify-between text-xs font-body">
                <span className="text-muted-foreground">Attività</span>
                <span className="font-semibold">{fitScore.breakdown.activity}%</span>
              </div>
            )}
            {fitScore.breakdown.interests !== null && (
              <div className="flex justify-between text-xs font-body">
                <span className="text-muted-foreground">Interessi</span>
                <span className="font-semibold">{fitScore.breakdown.interests}%</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EventFitScore;
