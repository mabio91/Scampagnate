import { FC } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DIFFICULTY_LEVELS } from "./DifficultyBadge";
import { Circle } from "lucide-react";

interface DifficultyGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEVEL_DETAILS: Record<string, { environments: string; params: string; extra: string[] }> = {
  "1": {
    environments: "parks, wide trails, nature walks",
    params: "Elevation gain: up to 150–200 m, Duration: 1–2 hours",
    extra: ["simple walking routes", "very low elevation gain", "relaxed pace", "easy terrain"],
  },
  "2": {
    environments: "first real hiking experiences, panoramic trails",
    params: "Elevation gain: 200–400 m, Duration: 2–3 hours",
    extra: ["simple trails", "moderate elevation gain", "relaxed pace"],
  },
  "3": {
    environments: "classic day hikes, longer excursions",
    params: "Elevation gain: 400–700 m, Duration: 3–5 hours",
    extra: ["longer climbs", "mountain trails", "sustained pace"],
  },
  "4": {
    environments: "demanding mountain treks, long day excursions",
    params: "Elevation gain: 700–1100 m, Duration: 5–7 hours",
    extra: ["significant elevation gain", "more technical terrain", "higher physical effort"],
  },
  "5": {
    environments: "",
    params: "Elevation gain: over 1100 m, Duration: 7+ hours",
    extra: ["very high elevation gain", "long distances", "sustained pace", "potentially technical terrain"],
  },
};

export const DifficultyGuideDialog: FC<DifficultyGuideDialogProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-center">Trekking Difficulty Guide</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <p className="text-sm font-body text-muted-foreground">
            This guide ensures transparency and helps you choose activities that perfectly match your experience and fitness level.
          </p>

          <div className="space-y-5">
            {DIFFICULTY_LEVELS.map((level) => {
              const details = LEVEL_DETAILS[level.level];
              return (
                <div key={level.level} className="space-y-1">
                  <h4 className="font-display font-bold text-base flex items-center gap-2">
                    <Circle className={`h-4 w-4 fill-current ${level.color}`} />
                    Level {level.level} — {level.name}
                  </h4>
                  <p className="text-sm font-body text-foreground">{level.description.split(".")[0]}.</p>
                  {details && (
                    <>
                      <ul className="text-xs font-body text-muted-foreground list-disc pl-5 mt-1 space-y-0.5">
                        {details.extra.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <div className="text-xs font-body mt-2 bg-muted/50 p-2 rounded-lg">
                        {details.environments && (
                          <>
                            <span className="font-semibold block text-foreground">Typical environments:</span> {details.environments}<br />
                          </>
                        )}
                        <span className="font-semibold block text-foreground mt-1">Example parameters:</span> {details.params}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
