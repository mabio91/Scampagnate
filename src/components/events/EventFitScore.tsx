import { User, Info, X } from "lucide-react";
import { FitScoreResult } from "@/hooks/useEventFitScore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface EventFitScoreProps {
  fitScore: FitScoreResult;
  compact?: boolean;
}

const colorMap = {
  green: {
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800/30",
    text: "text-green-700 dark:text-green-400",
    bar: "bg-green-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800/30",
    text: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/10",
    border: "border-red-200/60 dark:border-red-800/20",
    text: "text-red-600 dark:text-red-400",
    bar: "bg-red-400",
  },
};

const breakdownLabels: Record<string, string> = {
  level: "Livello",
  interests: "Interessi",
};

const DetailContent = ({ fitScore }: { fitScore: FitScoreResult }) => {
  const colors = colorMap[fitScore.color];

  return (
    <div className="space-y-5 px-1">
      <div className="flex items-center justify-between">
        <span className={`text-lg font-display font-bold ${colors.text}`}>
          {fitScore.label}
        </span>
        <span className={`text-2xl font-display font-bold ${colors.text}`}>
          {fitScore.score}%
        </span>
      </div>

      <p className="text-sm font-body text-muted-foreground leading-relaxed">
        Questo punteggio confronta il tuo livello e i tuoi interessi con le categorie dell&apos;evento.
      </p>

      {fitScore.reasons.length > 0 && (
        <div className="space-y-2">
          {fitScore.reasons.map((reason, index) => (
            <div key={index} className="flex items-start gap-2 text-sm font-body">
              <span className={reason.icon === "check" ? "text-green-600 shrink-0 mt-0.5" : "text-amber-500 shrink-0 mt-0.5"}>
                {reason.icon === "check" ? "OK" : "!"}
              </span>
              <span className="text-foreground/80 dark:text-foreground/90">{reason.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-border/50">
        <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
          Dettaglio
        </p>
        {(Object.keys(fitScore.breakdown) as (keyof typeof fitScore.breakdown)[]).map((key) => {
          const value = fitScore.breakdown[key];
          if (value === null) return null;

          const weight = fitScore.componentWeights[key];
          const barColor =
            value >= 70 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-400";

          return (
            <div key={key}>
              <div className="flex justify-between text-xs font-body mb-1">
                <span className="text-muted-foreground">
                  {breakdownLabels[key]}{weight !== null ? ` (${weight}%)` : ""}
                </span>
                <span className="font-semibold text-foreground">{value}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all duration-300`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EventFitScore = ({ fitScore, compact = false }: EventFitScoreProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();

  if (fitScore.hidden) return null;

  if (fitScore.profileIncomplete) {
    return (
      <div className="p-3 rounded-xl bg-muted/50 border border-border/50 flex items-start gap-3">
        <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-body text-muted-foreground">
            <Link
              to="/profile"
              className="text-primary underline underline-offset-2 font-semibold"
            >
              Completa il tuo profilo
            </Link>{" "}
            per vedere quanto questo evento fa per te.
          </p>
        </div>
      </div>
    );
  }

  if (compact) {
    return <EventFitScoreCompact fitScore={fitScore} />;
  }

  const colors = colorMap[fitScore.color];

  return (
    <>
      <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border}`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className={`text-lg font-display font-bold ${colors.text} leading-snug`}>
              {fitScore.label}
            </p>
            <p className={`text-sm font-body font-semibold ${colors.text} mt-0.5`}>
              {fitScore.score}%
            </p>
          </div>
          <button
            onClick={() => setShowDetails(true)}
            className="text-xs font-body font-semibold text-primary hover:underline underline-offset-2 flex items-center gap-1 shrink-0 ml-3"
          >
            Scopri perche
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isMobile ? (
        <Drawer open={showDetails} onOpenChange={setShowDetails}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="flex items-center justify-between pb-2">
              <DrawerTitle className="font-display text-base">Quanto fa per te</DrawerTitle>
              <DrawerClose asChild>
                <button className="p-1 rounded-full hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </DrawerClose>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-y-auto">
              <DetailContent fitScore={fitScore} />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-base">Quanto fa per te</DialogTitle>
            </DialogHeader>
            <DetailContent fitScore={fitScore} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export const EventFitScoreCompact = ({ fitScore }: { fitScore: FitScoreResult }) => {
  if (fitScore.hidden || fitScore.profileIncomplete) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const colors = colorMap[fitScore.color];
  const organizerLabel =
    fitScore.score >= 80 ? "Alta" : fitScore.score >= 50 ? "Media" : "Bassa";

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
              {organizerLabel}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <p className="text-xs font-body font-bold mb-1.5">
            {fitScore.label} - {fitScore.score}%
          </p>
          <div className="space-y-1">
            {(Object.keys(fitScore.breakdown) as (keyof typeof fitScore.breakdown)[]).map((key) => {
              const value = fitScore.breakdown[key];
              if (value === null) return null;
              const weight = fitScore.componentWeights[key];

              return (
                <div key={key} className="flex justify-between text-xs font-body">
                  <span className="text-muted-foreground">
                    {breakdownLabels[key]}{weight !== null ? ` (${weight}%)` : ""}
                  </span>
                  <span className="font-semibold">{value}%</span>
                </div>
              );
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EventFitScore;
