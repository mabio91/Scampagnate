import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { MapPin, Calendar, Users, MessageCircle, Archive, CheckCircle2, Clock } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "In attesa", variant: "secondary" },
  reviewed: { label: "Valutata", variant: "default" },
  archived: { label: "Archiviata", variant: "outline" },
  converted: { label: "Convertita", variant: "default" },
};

const ProposalsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proposals, isLoading } = useQuery({
    queryKey: ["activity-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_proposals" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("activity_proposals" as any)
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["activity-proposals"] });
      toast({ title: `Proposta ${STATUS_MAP[status]?.label?.toLowerCase() || status}` });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  if (!proposals?.length) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground font-body text-sm">Nessuna proposta ricevuta</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {proposals.map((p: any) => {
        const st = STATUS_MAP[p.status] || STATUS_MAP.pending;
        return (
          <Card key={p.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-display font-bold text-sm text-foreground truncate">{p.activity_title}</h4>
                <p className="text-xs font-body text-muted-foreground">
                  da {p.proposer_name} · {format(new Date(p.created_at), "d MMM yyyy", { locale: it })}
                </p>
              </div>
              <Badge variant={st.variant} className="text-[10px] flex-shrink-0">{st.label}</Badge>
            </div>

            {p.description && (
              <p className="text-xs font-body text-muted-foreground line-clamp-2">{p.description}</p>
            )}

            <div className="flex flex-wrap gap-3 text-[11px] font-body text-muted-foreground">
              {p.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
              )}
              {p.suggested_date && (
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{p.suggested_date}{p.suggested_time ? ` · ${p.suggested_time}` : ""}</span>
              )}
              {p.max_participants && (
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />Max {p.max_participants}</span>
              )}
            </div>

            {p.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus(p.id, "reviewed")}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Valutata
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus(p.id, "archived")}>
                  <Archive className="h-3 w-3 mr-1" /> Archivia
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default ProposalsPanel;
