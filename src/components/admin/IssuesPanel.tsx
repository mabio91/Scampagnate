import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
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
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

export default IssuesPanel;
