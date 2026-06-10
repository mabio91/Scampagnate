import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dedupeRegistrationsByEvent, isAttendedRegistration } from "@/lib/eventRegistrations";
import { isAnalyticsRegistration } from "@/lib/analyticsEvents";

export interface ReliabilityData {
  score: number;
  label: string;
  totalRegistrations: number;
  attended: number;
  noShows: number;
  cancellations: number;
  lateCancellations: number;
}

export const useReliability = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["reliability", userId],
    queryFn: async (): Promise<ReliabilityData> => {
      if (!userId) return { score: 100, label: "Ottima affidabilità", totalRegistrations: 0, attended: 0, noShows: 0, cancellations: 0, lateCancellations: 0 };

      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("status, checked_in, created_at, event_id, sport_level, events(status)")
        .eq("user_id", userId);

      const all = dedupeRegistrationsByEvent(
        (registrations || [])
          .filter((r: any) => !r.sport_level?.startsWith("manual:"))
          .filter(isAnalyticsRegistration)
      );
      const total = all.length;
      if (total === 0) return { score: 100, label: "Ottima affidabilità", totalRegistrations: 0, attended: 0, noShows: 0, cancellations: 0, lateCancellations: 0 };

      const attended = all.filter(isAttendedRegistration).length;
      const noShows = all.filter(r => r.status === "no_show").length;
      const cancellations = all.filter(r => r.status === "cancelled").length;
      // For late cancellations we'd need event date comparison; approximate for now
      const lateCancellations = 0;

      // Score: base 100, -10 per no-show, -3 per cancellation
      const score = Math.max(0, Math.min(100, 100 - (noShows * 10) - (cancellations * 3)));

      let label = "Ottima affidabilità";
      if (score < 60) label = "Da migliorare";
      else if (score < 80) label = "Buona affidabilità";

      return { score, label, totalRegistrations: total, attended, noShows, cancellations, lateCancellations };
    },
    enabled: !!userId,
  });
};
