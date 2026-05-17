import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, ImageIcon, Video } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatIssueMediaSize, getIssueMediaAttachments, signIssueMediaAttachments, type IssueMediaAttachment } from "@/lib/issueMedia";
import type { Tables } from "@/integrations/supabase/types";

type Issue = Tables<"issues">;

const priorityConfig: Record<string, { color: string; label: string }> = {
  low: { color: "bg-muted text-muted-foreground", label: "Low" },
  medium: { color: "bg-warning/15 text-warning", label: "Medium" },
  high: { color: "bg-destructive/15 text-destructive", label: "High" },
};

const statusConfig: Record<string, { icon: typeof Clock; color: string }> = {
  open: { icon: Clock, color: "text-warning" },
  in_progress: { icon: AlertTriangle, color: "text-primary" },
  resolved: { icon: CheckCircle2, color: "text-success" },
};

const IssuesPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: issues, isLoading } = useQuery({
    queryKey: ["admin-issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const allAttachments = useMemo(
    () => (issues || []).flatMap((issue) => getIssueMediaAttachments(issue.media_attachments)),
    [issues],
  );
  const mediaPaths = useMemo(() => allAttachments.map((attachment) => attachment.path), [allAttachments]);

  const { data: signedMediaUrls = {} } = useQuery({
    queryKey: ["admin-issue-media", mediaPaths],
    enabled: mediaPaths.length > 0,
    queryFn: () => signIssueMediaAttachments(supabase, allAttachments),
    staleTime: 45 * 60 * 1000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("issues")
        .update({
          status: "resolved",
          resolution_notes: notes,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-issues"] });
      toast({ title: "Issue marked as resolved" });
      setSelectedIssue(null);
      setResolutionNotes("");
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  const openIssues = issues?.filter((i) => i.status !== "resolved") || [];
  const resolvedIssues = issues?.filter((i) => i.status === "resolved") || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">Open Issues ({openIssues.length})</h2>
      </div>

      {openIssues.length === 0 ? (
        <Card className="p-6 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
          <p className="text-muted-foreground font-body text-sm">No open issues!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {openIssues.map((issue) => {
            const pConfig = priorityConfig[issue.priority] || priorityConfig.medium;
            const sConfig = statusConfig[issue.status] || statusConfig.open;
            const StatusIcon = sConfig.icon;
            return (
              <Card
                key={issue.id}
                className="p-4 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => { setSelectedIssue(issue); setResolutionNotes(""); }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 shrink-0 ${sConfig.color}`} />
                      <p className="font-body font-semibold text-sm text-foreground truncate">{issue.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-body mt-1 line-clamp-2">{issue.description}</p>
                    <IssueMediaList
                      attachments={getIssueMediaAttachments(issue.media_attachments)}
                      signedUrls={signedMediaUrls}
                      compact
                    />
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${pConfig.color}`}>{pConfig.label}</Badge>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-body">
                  <span>By {issue.reporter_name}</span>
                  <span>{format(new Date(issue.created_at), "dd MMM yyyy HH:mm")}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {resolvedIssues.length > 0 && (
        <>
          <h2 className="font-display text-lg font-bold text-foreground mt-6">Resolved ({resolvedIssues.length})</h2>
          <div className="space-y-2">
            {resolvedIssues.slice(0, 5).map((issue) => (
              <Card key={issue.id} className="p-3 opacity-60">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <p className="font-body text-sm text-foreground truncate flex-1">{issue.title}</p>
                  <span className="text-[10px] text-muted-foreground font-body">
                    {format(new Date(issue.resolved_at || issue.updated_at), "dd MMM")}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={(o) => { if (!o) setSelectedIssue(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Issue Details</DialogTitle>
          </DialogHeader>
          {selectedIssue && (
            <div className="space-y-4 pt-2">
              <div>
                <p className="font-body font-semibold text-foreground">{selectedIssue.title}</p>
                <p className="text-sm text-muted-foreground font-body mt-1">{selectedIssue.description}</p>
              </div>
              <IssueMediaList
                attachments={getIssueMediaAttachments(selectedIssue.media_attachments)}
                signedUrls={signedMediaUrls}
              />
              <div className="flex gap-3 text-xs text-muted-foreground font-body">
                <span>Priority: <strong className="text-foreground">{selectedIssue.priority}</strong></span>
                <span>By: <strong className="text-foreground">{selectedIssue.reporter_name}</strong></span>
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground">Resolution Notes (optional)</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe how the issue was resolved..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={() => resolveMutation.mutate({ id: selectedIssue.id, notes: resolutionNotes })}
                disabled={resolveMutation.isPending}
                className="w-full gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const IssueMediaList = ({
  attachments,
  signedUrls,
  compact = false,
}: {
  attachments: IssueMediaAttachment[];
  signedUrls: Record<string, string>;
  compact?: boolean;
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 mt-2 max-w-sm" : "grid-cols-1 sm:grid-cols-2"}`}>
      {attachments.map((attachment) => {
        const signedUrl = signedUrls[attachment.path];
        const isVideo = attachment.type === "video";
        const MediaIcon = isVideo ? Video : ImageIcon;

        return (
          <div key={attachment.path} className="overflow-hidden rounded-lg border border-border bg-muted/30">
            {signedUrl && !isVideo ? (
              <a href={signedUrl} target="_blank" rel="noreferrer" className="block">
                <img src={signedUrl} alt={attachment.name} className={`${compact ? "h-20" : "h-32"} w-full object-cover`} />
              </a>
            ) : signedUrl && isVideo ? (
              <video src={signedUrl} controls className={`${compact ? "h-20" : "h-32"} w-full bg-black object-cover`} />
            ) : (
              <div className={`${compact ? "h-20" : "h-32"} flex items-center justify-center bg-muted`}>
                <MediaIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
              <MediaIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
              <span className="shrink-0">{formatIssueMediaSize(attachment.size)}</span>
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noreferrer" className="shrink-0 text-primary">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IssuesPanel;
