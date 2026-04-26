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
  category: string | null;
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
        .select("*, missions(*)")
        .eq("user_id", userId);
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
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data || []) as Mission[];
    },
  });
};
