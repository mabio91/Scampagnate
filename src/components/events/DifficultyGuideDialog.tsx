import { FC } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DIFFICULTY_LEVELS } from "./DifficultyBadge";

interface DifficultyGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
            {/* Level 1 */}
            <div className="space-y-1">
              <h4 className="font-display font-bold text-base flex items-center gap-2">
                <span className="text-xl">🟢</span> Level 1 — Introduzione
              </h4>
              <p className="text-sm font-body text-foreground">Perfect for beginners.</p>
              <ul className="text-xs font-body text-muted-foreground list-disc pl-5 mt-1 space-y-0.5">
                <li>simple walking routes</li>
                <li>very low elevation gain</li>
                <li>relaxed pace</li>
                <li>easy terrain</li>
              </ul>
              <div className="text-xs font-body mt-2 bg-muted/50 p-2 rounded-lg">
                <span className="font-semibold block text-foreground">Typical environments:</span> parks, wide trails, nature walks<br />
                <span className="font-semibold block text-foreground mt-1">Example parameters:</span> Elevation gain: up to 150–200 m, Duration: 1–2 hours
              </div>
            </div>

            {/* Level 2 */}
            <div className="space-y-1">
              <h4 className="font-display font-bold text-base flex items-center gap-2">
                <span className="text-xl">🟢</span> Level 2 — Facile
              </h4>
              <p className="text-sm font-body text-foreground">Suitable for people who have already done some walking or beginner trekking.</p>
              <ul className="text-xs font-body text-muted-foreground list-disc pl-5 mt-1 space-y-0.5">
                <li>simple trails</li>
                <li>moderate elevation gain</li>
                <li>relaxed pace</li>
              </ul>
              <div className="text-xs font-body mt-2 bg-muted/50 p-2 rounded-lg">
                <span className="font-semibold block text-foreground">Typical environments:</span> first real hiking experiences, panoramic trails<br />
                <span className="font-semibold block text-foreground mt-1">Example parameters:</span> Elevation gain: 200–400 m, Duration: 2–3 hours
              </div>
            </div>

            {/* Level 3 */}
            <div className="space-y-1">
              <h4 className="font-display font-bold text-base flex items-center gap-2">
                <span className="text-xl">🟡</span> Level 3 — Intermedio
              </h4>
              <p className="text-sm font-body text-foreground">Suitable for moderately active people.</p>
              <ul className="text-xs font-body text-muted-foreground list-disc pl-5 mt-1 space-y-0.5">
                <li>longer climbs</li>
                <li>mountain trails</li>
                <li>sustained pace</li>
              </ul>
              <div className="text-xs font-body mt-2 bg-muted/50 p-2 rounded-lg">
                <span className="font-semibold block text-foreground">Typical environments:</span> classic day hikes, longer excursions<br />
                <span className="font-semibold block text-foreground mt-1">Example parameters:</span> Elevation gain: 400–700 m, Duration: 3–5 hours
              </div>
            </div>

            {/* Level 4 */}
            <div className="space-y-1">
              <h4 className="font-display font-bold text-base flex items-center gap-2">
                <span className="text-xl">🟠</span> Level 4 — Impegnativo
              </h4>
              <p className="text-sm font-body text-foreground">Requires good physical condition.</p>
              <ul className="text-xs font-body text-muted-foreground list-disc pl-5 mt-1 space-y-0.5">
                <li>significant elevation gain</li>
                <li>more technical terrain</li>
                <li>higher physical effort</li>
              </ul>
              <div className="text-xs font-body mt-2 bg-muted/50 p-2 rounded-lg">
                <span className="font-semibold block text-foreground">Typical environments:</span> demanding mountain treks, long day excursions<br />
                <span className="font-semibold block text-foreground mt-1">Example parameters:</span> Elevation gain: 700–1100 m, Duration: 5–7 hours
              </div>
            </div>

            {/* Level 5 */}
            <div className="space-y-1">
              <h4 className="font-display font-bold text-base flex items-center gap-2">
                <span className="text-xl">🔴</span> Level 5 — Avanzato
              </h4>
              <p className="text-sm font-body text-foreground">Only for experienced hikers.</p>
              <ul className="text-xs font-body text-muted-foreground list-disc pl-5 mt-1 space-y-0.5">
                <li>very high elevation gain</li>
                <li>long distances</li>
                <li>sustained pace</li>
                <li>potentially technical terrain</li>
              </ul>
              <div className="text-xs font-body mt-2 bg-muted/50 p-2 rounded-lg">
                <span className="font-semibold block text-foreground">Example parameters:</span> Elevation gain: over 1100 m, Duration: 7+ hours
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
