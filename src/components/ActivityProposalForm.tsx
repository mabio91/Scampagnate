import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ActivityProposalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ActivityProposalForm = ({ open, onOpenChange }: ActivityProposalFormProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState(
    profile ? `${profile.first_name} ${profile.last_name}`.trim() : ""
  );
  const [activityTitle, setActivityTitle] = useState("");
  const [location, setLocation] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [suggestedTime, setSuggestedTime] = useState("");
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");

  const resetForm = () => {
    setActivityTitle("");
    setLocation("");
    setSuggestedDate("");
    setSuggestedTime("");
    setDescription("");
    setMaxParticipants("");
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activityTitle.trim()) {
      toast({ title: t("pleaseFillFields"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("activity_proposals" as any).insert({
        proposer_name: name.trim(),
        proposer_id: user?.id || null,
        activity_title: activityTitle.trim(),
        location: location.trim(),
        suggested_date: suggestedDate || null,
        suggested_time: suggestedTime || null,
        description: description.trim(),
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      } as any);
      if (error) throw error;
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              {t("thankYouProposal")}
            </h3>
            <p className="text-sm font-body text-muted-foreground">
              {t("proposalReview")}
            </p>
            <Button onClick={handleClose} className="w-full">{t("close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("proposeActivityTitle")}</DialogTitle>
          <DialogDescription className="font-body text-sm">
            {t("proposeActivityDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="font-body text-sm font-semibold">
              {t("yourName")} <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("firstName")} required disabled={!!user} className="mt-1" />
          </div>

          <div>
            <Label className="font-body text-sm font-semibold">
              {t("activityTitle")} <span className="text-destructive">*</span>
            </Label>
            <Input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder={t("whatIsIt")} required className="mt-1" />
          </div>

          <div>
            <Label className="font-body text-sm font-semibold">{t("location")}</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("locationPlaceholder")} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-body text-sm font-semibold">{t("suggestedDate")}</Label>
              <Input type="date" value={suggestedDate} onChange={(e) => setSuggestedDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="font-body text-sm font-semibold">{t("time")}</Label>
              <Input type="time" value={suggestedTime} onChange={(e) => setSuggestedTime(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="font-body text-sm font-semibold">{t("description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("describeIssue")} rows={4} className="mt-1" />
          </div>

          <div>
            <Label className="font-body text-sm font-semibold">{t("maxParticipants")}</Label>
            <Input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="Es. 20" min={1} className="mt-1" />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("submitProposal")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityProposalForm;
