import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import DynamicIcon from "@/components/DynamicIcon";
import { Gift, Ticket, Trophy, Clock, ArrowLeft, Copy, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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

interface RewardCardRow {
  id: string;
  type: string;
  title: string;
  value: string | null;
  status: string;
  expiry_date: string | null;
  missions?: {
    title: string | null;
    icon: string | null;
  } | null;
  source_reward?: {
    title: string | null;
    reward_kind: string | null;
    physical_config?: {
      reward_name?: string | null;
      claim_instructions?: string | null;
    } | null;
    badges?: {
      name: string | null;
      icon: string | null;
      description: string | null;
    } | null;
  } | null;
}

const isGenericBadgeTitle = (title: string | null | undefined) => {
  const normalized = (title || "").trim().toLowerCase();
  return normalized === "badge" || normalized === "badge missione";
};

const Rewards = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPhysicalReward, setSelectedPhysicalReward] = useState<RewardCardRow | null>(null);

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["user-rewards", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_rewards")
        .select("*, missions(title, icon), source_reward:mission_rewards!user_rewards_source_mission_reward_id_fkey(title, reward_kind, physical_config, badges(name, icon, description))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RewardCardRow[];
    },
  });

  if (!user) {
    navigate("/auth");
    return null;
  }

  const badgeRewards = rewards?.filter(r => r.type === "badge") || [];
  const physicalRewards = rewards?.filter(r => r.type === "physical" || r.type === "other") || [];
  const pointRewards = rewards?.filter(r => r.type === "points") || [];
  const couponRewards = rewards?.filter(r => r.type === "coupon") || [];

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Codice copiato!" });
  };

  const renderRewardCard = (r: RewardCardRow) => {
    const sourceReward = r.source_reward;
    const sourceBadge = sourceReward?.badges;
    const badgeName = sourceBadge?.name || (r.type === "badge" ? r.value : null);
    const badgeDescription = sourceBadge?.description || null;
    const displayTitle = r.type === "badge" && isGenericBadgeTitle(r.title) && badgeName
      ? badgeName
      : r.type === "physical" && sourceReward?.physical_config?.reward_name
        ? sourceReward.physical_config.reward_name
        : r.title;
    const Icon = REWARD_ICON[r.type] || Gift;
    const status = STATUS_LABELS[r.status] || STATUS_LABELS.active;
    const isExpired = r.expiry_date && new Date(r.expiry_date) < new Date();
    const actualStatus = isExpired && r.status === "active" ? STATUS_LABELS.expired : status;
    const iconValue = r.type === "badge" ? sourceBadge?.icon : null;

    const isPhysical = r.type === "physical" || r.type === "other";
    const claimInstructions = sourceReward?.physical_config?.claim_instructions?.trim();
    return (
      <Card
        key={r.id}
        role={isPhysical ? "button" : undefined}
        tabIndex={isPhysical ? 0 : undefined}
        onClick={isPhysical ? () => setSelectedPhysicalReward(r) : undefined}
        onKeyDown={isPhysical ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedPhysicalReward(r);
          }
        } : undefined}
        className={`p-4 space-y-2 ${isPhysical ? "cursor-pointer transition-colors hover:bg-muted/30" : ""} ${r.status === "active" || r.status === "pending" ? "" : "opacity-60"}`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            r.type === "coupon" ? "bg-primary/10" : r.type === "badge" ? "bg-accent/10" : "bg-secondary/10"
          }`}>
            {iconValue ? (
              <DynamicIcon
                value={iconValue}
                className={`h-5 w-5 ${r.type === "badge" ? "text-accent" : "text-secondary"}`}
                size={20}
              />
            ) : (
              <Icon className={`h-5 w-5 ${
                r.type === "coupon" ? "text-primary" : r.type === "badge" ? "text-accent" : "text-secondary"
              }`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-display font-bold text-foreground truncate">{displayTitle}</p>
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
            {r.value && isPhysical && (
              <p className="text-xs font-body text-muted-foreground mt-0.5">{r.value}</p>
            )}
            {r.type === "badge" && badgeName && displayTitle !== badgeName && (
              <p className="text-xs font-body text-muted-foreground mt-0.5">{badgeName}</p>
            )}
            {r.type === "badge" && badgeDescription && (
              <p className="text-[10px] font-body text-muted-foreground mt-0.5 line-clamp-2">{badgeDescription}</p>
            )}
            {isPhysical && r.status === "pending" && (
              <p className="text-xs font-body text-warning mt-1 flex items-center gap-1">
                <Gift className="h-3 w-3" /> Da ritirare al prossimo evento
              </p>
            )}
            {isPhysical && claimInstructions && (
              <p className="text-[10px] font-body text-primary mt-1 font-semibold">Tocca per vedere le istruzioni di riscatto</p>
            )}
            {r.expiry_date && (
              <p className="text-[10px] font-body text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Scade il {new Date(r.expiry_date).toLocaleDateString("it-IT")}
              </p>
            )}
            {r.missions?.title && (
              <p className="text-[10px] font-body text-muted-foreground mt-0.5 flex items-center gap-1">
                {r.missions.icon && (
                  <DynamicIcon value={r.missions.icon} className="h-3 w-3 shrink-0" size={12} />
                )}
                <span className="truncate">{r.missions.title}</span>
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderSection = (
    title: string,
    icon: typeof Gift,
    className: string,
    items: RewardCardRow[],
  ) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <div>
        <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Icon className={`h-4 w-4 ${className}`} /> {title}
        </h2>
        <div className="space-y-2">{items.map(r => renderRewardCard(r))}</div>
      </div>
    );
  };

  return (
    <>
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
            {renderSection("Badge", Trophy, "text-accent", badgeRewards)}
            {renderSection("Ricompense fisiche", Gift, "text-secondary", physicalRewards)}
            {renderSection("Punti", Star, "text-secondary", pointRewards)}
            {renderSection("Coupon", Ticket, "text-primary", couponRewards)}
          </>
        )}
      </div>

      <Dialog open={!!selectedPhysicalReward} onOpenChange={(open) => !open && setSelectedPhysicalReward(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          {selectedPhysicalReward && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedPhysicalReward.source_reward?.physical_config?.reward_name || selectedPhysicalReward.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {selectedPhysicalReward.value && (
                  <p className="text-sm text-muted-foreground">{selectedPhysicalReward.value}</p>
                )}
                {selectedPhysicalReward.source_reward?.physical_config?.claim_instructions?.trim() ? (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">Istruzioni di riscatto</p>
                    <p className="text-sm font-body text-foreground whitespace-pre-wrap">
                      {selectedPhysicalReward.source_reward?.physical_config?.claim_instructions}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Riceverai le indicazioni dal team Scampagnate.</p>
                )}
                {selectedPhysicalReward.missions?.title && (
                  <p className="text-xs text-muted-foreground">Missione: {selectedPhysicalReward.missions.title}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Rewards;
