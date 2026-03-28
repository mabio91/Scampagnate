import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { Gift, Ticket, Trophy, Clock, CheckCircle, ArrowLeft, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REWARD_ICON: Record<string, typeof Gift> = {
  coupon: Ticket,
  badge: Trophy,
  physical: Gift,
  points: Gift,
  other: Gift,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Attivo", color: "text-success" },
  pending: { label: "Da riscattare", color: "text-warning" },
  used: { label: "Utilizzato", color: "text-muted-foreground" },
  redeemed: { label: "Riscattato", color: "text-muted-foreground" },
  expired: { label: "Scaduto", color: "text-destructive" },
};

const Rewards = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["user-rewards", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_rewards")
        .select("*, missions(title, icon)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!user) {
    navigate("/auth");
    return null;
  }

  const activeCoupons = rewards?.filter(r => r.type === "coupon" && r.status === "active") || [];
  const unlockedRewards = rewards?.filter(r => r.status === "active" && r.type !== "coupon" || r.status === "pending") || [];
  const history = rewards?.filter(r => ["used", "redeemed", "expired"].includes(r.status)) || [];

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Codice copiato!" });
  };

  const renderRewardCard = (r: any, showActions = false) => {
    const Icon = REWARD_ICON[r.type] || Gift;
    const status = STATUS_LABELS[r.status] || STATUS_LABELS.active;
    const isExpired = r.expiry_date && new Date(r.expiry_date) < new Date();
    const actualStatus = isExpired && r.status === "active" ? STATUS_LABELS.expired : status;

    return (
      <Card key={r.id} className={`p-4 space-y-2 ${r.status === "active" || r.status === "pending" ? "" : "opacity-60"}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            r.type === "coupon" ? "bg-primary/10" : r.type === "badge" ? "bg-accent/10" : "bg-secondary/10"
          }`}>
            <Icon className={`h-5 w-5 ${
              r.type === "coupon" ? "text-primary" : r.type === "badge" ? "text-accent" : "text-secondary"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-display font-bold text-foreground truncate">{r.title}</p>
              <span className={`text-[10px] font-body font-bold ${actualStatus.color}`}>
                {actualStatus.label}
              </span>
            </div>
            {r.value && r.type === "coupon" && (
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{r.value}</code>
                {r.status === "active" && (
                  <button onClick={() => copyCode(r.value)} className="text-primary hover:text-primary/80">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {r.value && r.type === "physical" && (
              <p className="text-xs font-body text-muted-foreground mt-0.5">{r.value}</p>
            )}
            {r.type === "physical" && r.status === "pending" && (
              <p className="text-xs font-body text-warning mt-1 flex items-center gap-1">
                <Gift className="h-3 w-3" /> Da ritirare al prossimo evento
              </p>
            )}
            {r.expiry_date && (
              <p className="text-[10px] font-body text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Scade il {new Date(r.expiry_date).toLocaleDateString("it-IT")}
              </p>
            )}
            {(r as any).missions?.title && (
              <p className="text-[10px] font-body text-muted-foreground mt-0.5">
                {(r as any).missions.icon} {(r as any).missions.title}
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-display text-xl font-bold text-foreground">Le tue ricompense</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : !rewards?.length ? (
          <EmptyState
            icon={Gift}
            title="Nessuna ricompensa"
            description="Completa le missioni per sbloccare ricompense"
          />
        ) : (
          <>
            {/* Active Coupons */}
            {activeCoupons.length > 0 && (
              <div>
                <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" /> Coupon attivi
                </h2>
                <div className="space-y-2">{activeCoupons.map(r => renderRewardCard(r, true))}</div>
              </div>
            )}

            {/* Unlocked rewards */}
            {unlockedRewards.length > 0 && (
              <div>
                <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-secondary" /> Ricompense sbloccate
                </h2>
                <div className="space-y-2">{unlockedRewards.map(r => renderRewardCard(r))}</div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Storico ricompense
                </h2>
                <div className="space-y-2">{history.map(r => renderRewardCard(r))}</div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Rewards;
