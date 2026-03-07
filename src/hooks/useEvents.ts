import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EventWithDetails {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category_id: string | null;
  status: "available" | "full" | "closed";
  price: number;
  deposit: number | null;
  payment_type: "free" | "paid" | "deposit" | "location";
  additional_fields: any;
  image_url: string | null;
  difficulty: string | null;
  distance: string | null;
  elevation: string | null;
  duration: string | null;
  spots_total: number;
  spots_taken: number;
  featured: boolean;
  organizer_id: string | null;
  organizer_name: string;
  cancellation_policy: string | null;
  equipment_list: any;
  category?: { name: string; icon: string } | null;
  meeting_points?: { id: string; name: string; location: string; time: string; notes: string | null }[];
}

export const useEvents = (categoryName?: string | null) => {
  return useQuery({
    queryKey: ["events", categoryName],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("id, title, date, time, location, category_id, status, price, deposit, payment_type, image_url, difficulty, distance, elevation, duration, spots_total, spots_taken, featured, organizer_id, organizer_name, description, cancellation_policy, equipment_list, additional_fields, event_categories(name, icon), event_meeting_points(id, name, location, time, notes)")
        .order("date", { ascending: true });

      if (categoryName) {
        const { data: cat } = await supabase
          .from("event_categories")
          .select("id")
          .eq("name", categoryName)
          .single();
        if (cat) {
          query = query.eq("category_id", cat.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((e: any) => ({
        ...e,
        category: e.event_categories,
        meeting_points: e.event_meeting_points || [],
      })) as EventWithDetails[];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev: any) => prev,
  });
};

export const useEvent = (id: string) => {
  return useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_categories(name, icon), event_meeting_points(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return {
        ...data,
        category: data.event_categories,
        meeting_points: data.event_meeting_points || [],
      } as EventWithDetails;
    },
    enabled: !!id,
  });
};

export const useEventParticipants = (eventId: string) => {
  return useQuery({
    queryKey: ["event-participants", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, profiles(first_name, last_name, avatar_url), meeting_point:event_meeting_points(id, name)")
        .eq("event_id", eventId)
        .in("status", ["registered", "paid"]);
      if (error) throw error;

      // Fetch badges for all participant user_ids
      const userIds = (data || []).map((r: any) => r.user_id);
      let badgesMap: Record<string, any[]> = {};
      if (userIds.length > 0) {
        const { data: userBadges } = await supabase
          .from("user_badges")
          .select("user_id, badges(icon, name)")
          .in("user_id", userIds);
        if (userBadges) {
          for (const ub of userBadges) {
            if (!badgesMap[ub.user_id]) badgesMap[ub.user_id] = [];
            badgesMap[ub.user_id].push(ub.badges);
          }
        }
      }

      return (data || []).map((r: any) => ({
        ...r,
        badges: badgesMap[r.user_id] || [],
      }));
    },
    enabled: !!eventId,
  });
};

export const useMyRegistration = (eventId: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-registration", eventId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!eventId && !!user,
  });
};

export const useRegisterForEvent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ eventId, meetingPointId, sportLevel, asWaitlist, paymentType }: { eventId: string; meetingPointId?: string; sportLevel?: string; asWaitlist?: boolean; paymentType?: string }) => {
      if (!user) throw new Error("Devi effettuare il login");

      // Determine payment_status based on payment type
      let paymentStatus = "pending";
      if (!paymentType || paymentType === "free") {
        paymentStatus = "not_required";
      } else if (paymentType === "location") {
        paymentStatus = "pay_on_location";
      }

      const { error } = await supabase.from("event_registrations").insert({
        event_id: eventId,
        user_id: user.id,
        meeting_point_id: meetingPointId || null,
        sport_level: sportLevel || null,
        status: asWaitlist ? "waitlist" : "registered",
        payment_status: paymentStatus,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["event", vars.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-participants", vars.eventId] });
      queryClient.invalidateQueries({ queryKey: ["my-registration", vars.eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
    },
  });
};

export const useCancelRegistration = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("Devi effettuare il login");
      const { error } = await supabase
        .from("event_registrations")
        .update({ status: "cancelled" })
        .eq("event_id", eventId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-participants", eventId] });
      queryClient.invalidateQueries({ queryKey: ["my-registration", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
    },
  });
};

export const useMyEvents = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, events(*, event_categories(name, icon)), meeting_point:event_meeting_points(id, name, location, time)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

export const useSavedEvents = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_events")
        .select("*, events(*, event_categories(name, icon))")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

export const useToggleSaveEvent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ eventId, isSaved }: { eventId: string; isSaved: boolean }) => {
      if (!user) throw new Error("Devi effettuare il login");
      if (isSaved) {
        await supabase.from("saved_events").delete().eq("event_id", eventId).eq("user_id", user.id);
      } else {
        await supabase.from("saved_events").insert({ event_id: eventId, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-events"] });
    },
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // categories rarely change
    gcTime: 30 * 60 * 1000,
  });
};
