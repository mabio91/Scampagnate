import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMembershipFee() {
  return useQuery({
    queryKey: ["membership-fee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "membership_fee")
        .single();
      if (error || !data?.value) return 10; // fallback
      const parsed = Number(data.value);
      return isNaN(parsed) || parsed < 0 ? 10 : parsed;
    },
    staleTime: 5 * 60 * 1000,
  });
}
