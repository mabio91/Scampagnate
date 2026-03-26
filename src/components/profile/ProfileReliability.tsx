import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useReliability } from "@/hooks/useReliability";
import { ShieldCheck, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const ProfileReliability = () => {
  const { user } = useAuth();
  const { data: reliability } = useReliability(user?.id);
  const [showInfo, setShowInfo] = useState(false);

  if (!reliability || reliability.totalRegistrations === 0) return null;

  const colorClass =
    reliability.score >= 80
      ? "text-success"
      : reliability.score >= 60
        ? "text-warning"
        : "text-destructive";

  const bgClass =
    reliability.score >= 80
      ? "bg-success/10 border-success/20"
      : reliability.score >= 60
        ? "bg-warning/10 border-warning/20"
        : "bg-destructive/10 border-destructive/20";

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-secondary" /> Affidabilità
      </h2>

      <div className={`p-4 rounded-2xl border ${bgClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${colorClass}`} />
            <span className={`text-sm font-display font-bold ${colorClass}`}>
              {reliability.label}
            </span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="p-1.5 rounded-full hover:bg-background/50 transition-colors"
          >
            <Info className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Come funziona l'affidabilità</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Il punteggio di affidabilità riflette il tuo comportamento come partecipante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Cosa influisce
              </p>
              <ul className="space-y-1.5 text-sm font-body text-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-success">✓</span> Partecipazione agli eventi
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-destructive">✗</span> No-show (-10 punti)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-warning">!</span> Cancellazioni (-3 punti)
                </li>
              </ul>
            </div>
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-2">
                I tuoi dati
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm font-body">
                <div>
                  <p className="text-muted-foreground">Eventi partecipati</p>
                  <p className="font-bold text-foreground">{reliability.attended}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">No-show</p>
                  <p className="font-bold text-foreground">{reliability.noShows}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cancellazioni</p>
                  <p className="font-bold text-foreground">{reliability.cancellations}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Punteggio</p>
                  <p className={`font-bold ${colorClass}`}>{reliability.score}%</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileReliability;
