import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommunityLevel {
  level_number: number;
  name: string;
  icon: string;
  color: string;
  min_points: number;
}

export const useCommunityLevel = (points: number) => {
  return useQuery({
    queryKey: ["community-level", points],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_community_level", { p_points: points });
      return (data?.[0] as CommunityLevel) || null;
    },
  });
};

export const useAllCommunityLevels = () => {
  return useQuery({
    queryKey: ["all-community-levels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_levels")
        .select("*")
        .order("min_points", { ascending: true });
      return (data || []) as CommunityLevel[];
    },
  });
};
