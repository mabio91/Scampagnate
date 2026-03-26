import { useQuery } from "@tanstack/react-query";
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
  return useQuery({
    queryKey: ["user-missions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("user_missions")
        .select("*, missions(*)")
        .eq("user_id", userId)
        .eq("completed", false);
      return (data || []) as unknown as UserMission[];
    },
    enabled: !!userId,
  });
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
