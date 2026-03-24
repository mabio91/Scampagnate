import { FC } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DIFFICULTY_LEVELS } from "./DifficultyBadge";

interface DifficultyGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEVEL_DETAILS: Record<string, { characteristics: string[]; environments: string; params: string[] }> = {
  "1": {
    characteristics: ["percorsi semplici", "dislivello molto basso", "ritmo rilassato", "terreno facile"],
    environments: "parchi, sentieri larghi, passeggiate nella natura",
    params: ["Dislivello: fino a 150–200 m", "Durata: 1–2 ore"],
  },
  "2": {
    characteristics: ["sentieri semplici", "dislivello moderato", "ritmo rilassato"],
    environments: "prime esperienze in montagna, sentieri panoramici",
    params: ["Dislivello: 200–400 m", "Durata: 2–3 ore"],
  },
  "3": {
    characteristics: ["salite più lunghe", "sentieri di montagna", "ritmo sostenuto"],
    environments: "escursioni classiche, trekking di giornata",
    params: ["Dislivello: 400–700 m", "Durata: 3–5 ore"],
  },
  "4": {
    characteristics: ["dislivello importante", "terreno più tecnico", "maggiore sforzo fisico"],
    environments: "trekking impegnativi, escursioni lunghe",
    params: ["Dislivello: 700–1100 m", "Durata: 5–7 ore"],
  },
  "5": {
    characteristics: ["dislivello molto elevato", "lunghe distanze", "ritmo sostenuto", "possibile terreno tecnico"],
    environments: "alta montagna, percorsi lunghi e impegnativi, sentieri alpini",
    params: ["Dislivello: oltre 1100 m", "Durata: 7+ ore"],
  },
};

export const DifficultyGuideDialog: FC<DifficultyGuideDialogProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-center">
            Guida ai livelli di difficoltà trekking
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <p className="text-sm font-body text-muted-foreground">
            Questa guida ti aiuta a scegliere attività adatte al tuo livello di esperienza e alla tua condizione fisica.
          </p>

          <div className="space-y-6">
            {DIFFICULTY_LEVELS.map((level) => {
              const details = LEVEL_DETAILS[level.level];
              const Icon = level.icon;
              return (
                <div key={level.level} className="space-y-2">
                  <h4 className="font-display font-bold text-base flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${level.color}`} />
                    Livello {level.level} — {level.name}
                  </h4>
                  <p className="text-sm font-body text-foreground">
                    {level.description.split(".")[0]}.
                  </p>
                  {details && (
                    <>
                      <div>
                        <p className="text-xs font-body font-semibold text-foreground mb-1">Caratteristiche:</p>
                        <ul className="text-xs font-body text-muted-foreground list-disc pl-5 space-y-0.5">
                          {details.characteristics.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="text-xs font-body bg-muted/50 p-2.5 rounded-lg space-y-1">
                        <div>
                          <span className="font-semibold text-foreground">Ambienti tipici:</span>
                          <br />
                          <span className="text-muted-foreground">{details.environments}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Parametri indicativi:</span>
                          <br />
                          {details.params.map((p, i) => (
                            <span key={i} className="text-muted-foreground">
                              {p}
                              {i < details.params.length - 1 && <br />}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs font-body text-muted-foreground italic border-t pt-4">
            I livelli di difficoltà (1–5) sono indipendenti dal livello dell'utente. Vengono utilizzati insieme ai dati del profilo (livello, esperienza, attività) per controlli di sicurezza e raccomandazioni eventi.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
