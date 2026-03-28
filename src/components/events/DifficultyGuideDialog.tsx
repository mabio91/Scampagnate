import { FC } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrekkingDifficultyLevels } from "@/hooks/useTrekkingDifficultyLevels";

interface DifficultyGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Static descriptive content keyed by level_number
const LEVEL_DETAILS: Record<number, { description: string; characteristics: string[]; environments: string; params: string[] }> = {
  1: {
    description: "Perfetto per chi è alle prime esperienze.",
    characteristics: ["percorsi semplici", "dislivello molto basso", "ritmo rilassato", "terreno facile"],
    environments: "parchi, sentieri larghi, passeggiate nella natura",
    params: ["Dislivello: fino a 150–200 m", "Durata: 1–2 ore"],
  },
  2: {
    description: "Adatto a chi ha già fatto qualche camminata o trekking facile.",
    characteristics: ["sentieri semplici", "dislivello moderato", "ritmo rilassato"],
    environments: "prime esperienze in montagna, sentieri panoramici",
    params: ["Dislivello: 200–400 m", "Durata: 2–3 ore"],
  },
  3: {
    description: "Adatto a persone moderatamente attive.",
    characteristics: ["salite più lunghe", "sentieri di montagna", "ritmo sostenuto"],
    environments: "escursioni classiche, trekking di giornata",
    params: ["Dislivello: 400–700 m", "Durata: 3–5 ore"],
  },
  4: {
    description: "Richiede una buona condizione fisica.",
    characteristics: ["dislivello importante", "terreno più tecnico", "maggiore sforzo fisico"],
    environments: "trekking impegnativi, escursioni lunghe",
    params: ["Dislivello: 700–1100 m", "Durata: 5–7 ore"],
  },
  5: {
    description: "Solo per escursionisti esperti.",
    characteristics: ["dislivello molto elevato", "lunghe distanze", "ritmo sostenuto", "possibile terreno tecnico"],
    environments: "alta montagna, percorsi lunghi e impegnativi, sentieri alpini",
    params: ["Dislivello: oltre 1100 m", "Durata: 7+ ore"],
  },
};

export const DifficultyGuideDialog: FC<DifficultyGuideDialogProps> = ({ open, onOpenChange }) => {
  const { data: levels, isLoading } = useQuery({
    queryKey: ["trekking-difficulty-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trekking_difficulty_levels")
        .select("*")
        .order("level_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

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

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {(levels || []).map((level) => {
                const details = LEVEL_DETAILS[level.level_number];
                return (
                  <div key={level.id} className="space-y-2">
                    <h4 className="font-display font-bold text-base flex items-center gap-2">
                      <span
                        className="text-lg"
                        style={{ color: level.color_icon }}
                      >
                        {level.icon}
                      </span>
                      <span>Livello {level.level_number} — {level.label}</span>
                    </h4>
                    {details && (
                      <>
                        <p className="text-sm font-body text-foreground">
                          {details.description}
                        </p>
                        <div>
                          <p className="text-xs font-body font-semibold text-foreground mb-1">Caratteristiche:</p>
                          <ul className="text-xs font-body text-muted-foreground list-disc pl-5 space-y-0.5">
                            {details.characteristics.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div
                          className="text-xs font-body p-2.5 rounded-lg space-y-1"
                          style={{
                            backgroundColor: level.color_background,
                            borderColor: level.color_border,
                            borderWidth: 1,
                            borderStyle: "solid",
                          }}
                        >
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
          )}

          <p className="text-xs font-body text-muted-foreground italic border-t pt-4">
            I livelli di difficoltà (1–5) sono indipendenti dal livello dell'utente. Vengono utilizzati insieme ai dati del profilo (livello, esperienza, attività) per controlli di sicurezza e raccomandazioni eventi.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
