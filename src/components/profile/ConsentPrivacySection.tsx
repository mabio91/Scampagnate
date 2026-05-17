import { useState } from "react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Bell, ChevronDown, ChevronRight, FileText, Loader2, Shield } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserConsents, useToggleConsent } from "@/hooks/useUserConsents";
import { useToast } from "@/hooks/use-toast";

const ConsentPrivacySection = () => {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
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
      <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Le tue preferenze
      </p>
      <Collapsible open={preferencesOpen} onOpenChange={setPreferencesOpen} className="mb-5">
        <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors hover:bg-muted/50 group">
          <Bell className="h-[18px] w-[18px] shrink-0 text-secondary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-body font-semibold text-foreground">Notifiche e consensi</p>
            <p className="text-xs font-body text-muted-foreground">
              Gestisci aggiornamenti e foto condivise
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${
              preferencesOpen ? "rotate-180" : ""
            }`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-[34px] space-y-3 border-l border-border/70 pl-4 pt-1">
            <div className="flex items-start gap-3 py-3">
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

            <div className="flex items-start gap-3 py-3">
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
        </CollapsibleContent>
      </Collapsible>

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
