import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveDiscount {
  event_id: string;
  discount_type: string;
  discount_value: number;
  code: string;
}

export const useActiveDiscounts = () => {
  return useQuery({
    queryKey: ["active-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("code, discount_type, discount_value, applies_to_all, event_ids, expires_at, max_uses, times_used")
        .eq("is_active", true);

      if (error) throw error;

      const now = new Date();
      const discountMap: Record<string, { discount_type: string; discount_value: number; code: string }> = {};

      for (const dc of data || []) {
        // Skip expired
        if (dc.expires_at && new Date(dc.expires_at) < now) continue;
        // Skip fully used
        if (dc.max_uses !== null && dc.times_used >= dc.max_uses) continue;

        // Pick the best (highest value) discount per event
        const addForEvent = (eventId: string) => {
          const existing = discountMap[eventId];
          if (!existing || dc.discount_value > existing.discount_value) {
            discountMap[eventId] = {
              discount_type: dc.discount_type,
              discount_value: dc.discount_value,
              code: dc.code,
            };
          }
        };

        if (dc.applies_to_all) {
          // Mark with special key for "all events"
          discountMap["__all__"] = {
            discount_type: dc.discount_type,
            discount_value: dc.discount_value,
            code: dc.code,
          };
        } else if (dc.event_ids && Array.isArray(dc.event_ids)) {
          for (const eid of dc.event_ids) {
            addForEvent(eid);
          }
        }
      }

      return discountMap;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
