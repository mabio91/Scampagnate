import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrekkingDifficultyLevel {
  id: string;
  level_number: number;
  label: string;
  icon: string;
  color_primary: string;
  color_icon: string;
  color_background: string;
  color_border: string;
}

export const useTrekkingDifficultyLevels = () => {
  return useQuery({
    queryKey: ["trekking-difficulty-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trekking_difficulty_levels")
        .select("*")
        .order("level_number", { ascending: true });
      if (error) throw error;
      return data as TrekkingDifficultyLevel[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
