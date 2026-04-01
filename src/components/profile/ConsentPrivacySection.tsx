import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, FileText, Shield, Loader2 } from "lucide-react";
import { useUserConsents, useToggleConsent } from "@/hooks/useUserConsents";
import { useToast } from "@/hooks/use-toast";

const ConsentPrivacySection = () => {
  const { getConsent, isLoading } = useUserConsents();
  const toggleConsent = useToggleConsent();
  const { toast } = useToast();

  const handleToggle = (type: "marketing" | "media", current: boolean) => {
    toggleConsent.mutate(
      { type, granted: !current },
      {
        onSuccess: () => {
          toast({
            title: !current ? "Consenso attivato" : "Consenso rimosso",
            description: !current
              ? "Preferenza aggiornata con successo."
              : "Preferenza aggiornata. Non riceverai più questo tipo di comunicazioni.",
          });
        },
        onError: () => {
          toast({ title: "Errore", description: "Impossibile aggiornare il consenso.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const marketingGranted = getConsent("marketing");
  const mediaGranted = getConsent("media");

  return (
    <div className="mb-8 animate-fade-in">
      <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-secondary" /> Consensi & Privacy
      </h2>

      {/* Toggles for optional consents */}
      <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Le tue preferenze
      </p>
      <div className="space-y-3 mb-5">
        {/* Marketing consent */}
        <div className="flex items-start gap-3 py-3 px-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">
              Non perderti le prossime scampagnate 🌿
            </p>
            <p className="text-xs font-body text-muted-foreground mt-0.5">
              Ti avvisiamo su nuovi eventi, posti che si liberano e chicche della community
            </p>
          </div>
          <Switch
            checked={marketingGranted}
            onCheckedChange={() => handleToggle("marketing", marketingGranted)}
            disabled={toggleConsent.isPending}
          />
        </div>

        {/* Media consent */}
        <div className="flex items-start gap-3 py-3 px-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">
              Fai parte delle nostre storie 📸
            </p>
            <p className="text-xs font-body text-muted-foreground mt-0.5">
              Possiamo condividere foto e momenti delle esperienze sui nostri canali
            </p>
          </div>
          <Switch
            checked={mediaGranted}
            onCheckedChange={() => handleToggle("media", mediaGranted)}
            disabled={toggleConsent.isPending}
          />
        </div>
      </div>

      {/* Legal documents */}
      <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Documenti legali
      </p>
      <div className="space-y-1">
        <Link
          to="/terms"
          className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group"
        >
          <FileText className="h-[18px] w-[18px] text-secondary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">Termini & Condizioni</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
        <Link
          to="/privacy"
          className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group"
        >
          <Shield className="h-[18px] w-[18px] text-secondary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">Informativa Privacy</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>
    </div>
  );
};

export default ConsentPrivacySection;
