import { useState, type ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Image, Loader2, Paperclip, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  formatIssueMediaSize,
  issueMediaAttachmentsToJson,
  uploadIssueMediaFiles,
  validateIssueMediaFiles,
} from "@/lib/issueMedia";

const ReportIssueDialog = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setMediaFiles([]);
  };

  const handleMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const validationError = validateIssueMediaFiles(files, mediaFiles.length);
    if (validationError) {
      toast({ title: t("uploadError"), description: validationError, variant: "destructive" });
      return;
    }

    setMediaFiles((current) => [...current, ...files]);
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

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

    let uploadedAttachments: Awaited<ReturnType<typeof uploadIssueMediaFiles>> = [];

    try {
      uploadedAttachments = await uploadIssueMediaFiles(supabase, user.id, mediaFiles);

      const { error } = await supabase.from("issues").insert({
        title: title.trim(),
        description: description.trim(),
        priority,
        reporter_id: user.id,
        reporter_name: reporterName,
        media_attachments: issueMediaAttachmentsToJson(uploadedAttachments),
      });

      if (error) {
        if (uploadedAttachments.length > 0) {
          await supabase.storage.from("issue-media").remove(uploadedAttachments.map((item) => item.path));
        }
        throw error;
      }

      toast({ title: t("thankYouReporting"), description: t("reportReceived") });
      resetForm();
      setOpen(false);
    } catch (error: unknown) {
      toast({ title: t("error"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left">
          <AlertTriangle className="h-[18px] w-[18px] text-secondary shrink-0" />
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
          <div className="space-y-2">
            <Label className="font-body text-sm">{t("attachments")}</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
              <Paperclip className="h-4 w-4" />
              <span>{t("addPhotosVideos")}</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="sr-only"
                onChange={handleMediaChange}
                disabled={submitting}
              />
            </label>
            <p className="text-xs text-muted-foreground">{t("photosVideosHint")}</p>
            {mediaFiles.length > 0 && (
              <div className="space-y-2">
                {mediaFiles.map((file, index) => {
                  const MediaIcon = file.type.startsWith("video/") ? Video : Image;
                  return (
                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <MediaIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatIssueMediaSize(file.size)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeMediaFile(index)} disabled={submitting}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{mediaFiles.length > 0 ? t("uploadingAttachments") : t("submitting")}</> : t("submitReport")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportIssueDialog;
