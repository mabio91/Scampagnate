import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const ReportIssueDialog = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: t("pleaseFillFields"), variant: "destructive" });
      return;
    }
    if (title.trim().length > 200 || description.trim().length > 2000) {
      toast({ title: t("inputTooLong"), description: t("titleMax200"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const reporterName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "User";

    const { error } = await supabase.from("issues").insert({
      title: title.trim(),
      description: description.trim(),
      priority,
      reporter_id: user.id,
      reporter_name: reporterName,
    });

    if (error) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("thankYouReporting"), description: t("reportReceived") });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setOpen(false);
    }
    setSubmitting(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left">
          <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">Segnala un problema</p>
            <p className="text-xs font-body text-muted-foreground">Aiutaci a migliorare l'esperienza</p>
          </div>
          <svg className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{t("reportIssue")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="font-body text-sm">{t("title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("briefSummary")} maxLength={200} className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">{t("descriptionLabel")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("describeIssue")} maxLength={2000} rows={4} className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">{t("priority")}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("low")}</SelectItem>
                <SelectItem value="medium">{t("medium")}</SelectItem>
                <SelectItem value="high">{t("high")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("submitting")}</> : t("submitReport")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportIssueDialog;
