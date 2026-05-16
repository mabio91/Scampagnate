import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: string;
  target_value: number;
  reward_points: number;
  reward_badge_id: string | null;
  reward_type?: string;
  reward_value?: string | null;
  category: string | null;
  sort_order?: number | null;
  mission_rewards?: MissionReward[];
}

export interface MissionReward {
  id: string;
  mission_id: string;
  sort_order: number;
  reward_kind: "points" | "badge" | "coupon" | "physical";
  title: string;
  points_value: number | null;
  badge_id: string | null;
  source_discount_code_id?: string | null;
  visible_on_profile?: boolean;
  coupon_config?: any;
  badge_config?: any;
  physical_config?: {
    reward_name?: string | null;
    claim_instructions?: string | null;
    [key: string]: unknown;
  } | null;
  badges?: {
    name: string;
    icon: string;
  } | null;
}

export interface UserMission {
  id: string;
  mission_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  missions: Mission;
}

export const useUserMissions = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user-missions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("user_missions")
        .select("*, missions(*, mission_rewards(*, badges(name, icon)))")
        .eq("user_id", userId)
        .order("sort_order", { referencedTable: "missions", ascending: true });
      return (data || []) as unknown as UserMission[];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-missions-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_missions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-missions", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
};

export const useActiveMissions = () => {
  return useQuery({
    queryKey: ["active-missions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("missions")
        .select("*, mission_rewards(*, badges(name, icon))")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("sort_order", { referencedTable: "mission_rewards", ascending: true });
      return (data || []) as Mission[];
    },
  });
};
