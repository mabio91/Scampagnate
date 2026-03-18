import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import ActivityProposalForm from "./ActivityProposalForm";

const ProposalSuggestionCard = () => {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <Card className="mx-4 p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm font-bold text-foreground">
              {t("haveIdea")}
            </h3>
            <p className="text-xs font-body text-muted-foreground mt-0.5">
              {t("proposeIt")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-xs"
              onClick={() => setOpen(true)}
            >
              {t("proposeActivity")}
            </Button>
          </div>
        </div>
      </Card>
      <ActivityProposalForm open={open} onOpenChange={setOpen} />
    </>
  );
};

export default ProposalSuggestionCard;
