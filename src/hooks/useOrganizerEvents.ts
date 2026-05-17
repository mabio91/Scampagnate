import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useOrganizerEvents = () => {
  const { user, isAdmin } = useAuth();
  return useQuery({
    queryKey: ["organizer-events", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*, event_categories(name, icon)")
        .order("date", { ascending: true });
      if (!isAdmin) {
        query = query.eq("organizer_id", user!.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useEventRegistrations = (eventId: string) => {
  return useQuery({
    queryKey: ["event-registrations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, profiles!event_registrations_user_id_profiles_fkey(first_name, last_name, phone, instagram_handle, avatar_url, membership_id, membership_status, self_level, trekking_experience, activity_frequency, experience_grade)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

export const useEventMeetingPoints = (eventId: string) => {
  return useQuery({
    queryKey: ["event-meeting-points", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_meeting_points")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};
