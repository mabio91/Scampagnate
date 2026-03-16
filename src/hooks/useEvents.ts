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
  status: "draft" | "published" | "full" | "closed" | "cancelled" | "past";
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
  visibility: "public" | "private" | "hidden";
  gallery_images: { url: string; order: number }[] | null;
  category?: { name: string; icon: string } | null;
  meeting_points?: { id: string; name: string; location: string; time: string; notes: string | null }[];
  price_options?: { id: string; name: string; price: number; sort_order: number }[];
}

export const useEvents = (categoryName?: string | null) => {
  const { user, isOrganizer, isAdmin } = useAuth();
  return useQuery({
    queryKey: ["events", categoryName, user?.id, isOrganizer, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("id, title, date, time, location, category_id, status, price, deposit, payment_type, image_url, difficulty, distance, elevation, duration, spots_total, spots_taken, featured, organizer_id, organizer_name, description, cancellation_policy, equipment_list, additional_fields, visibility, gallery_images, event_categories(name, icon), event_meeting_points(id, name, location, time, notes), event_price_options(id, name, price, sort_order)")
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

      // Visibility filtering
      if (!isAdmin && !isOrganizer) {
        // Regular users/guests see only public events
        query = query.eq("visibility", "public");
      } else {
        // Admin/Organizer can see public and hidden events
        // Private events are hidden from the discovery list for everyone
        query = query.or("visibility.eq.public,visibility.eq.hidden");
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as any).map((event: any) => ({
        ...event,
        category: event.event_categories,
        meeting_points: event.event_meeting_points
      })) as unknown as EventWithDetails[];
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
      } as unknown as EventWithDetails;
    },
    enabled: !!id,
  });
};

export const useEventParticipants = (eventId: string) => {
  return useQuery({
    queryKey: ["event-participants", eventId],
    queryFn: async () => {
      // Fetch registrations with meeting points (no profile join — use RPC for public profile data)
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, meeting_point:event_meeting_points(id, name)")
        .eq("event_id", eventId)
        .in("status", ["registered", "paid"]);
      if (error) throw error;

      const userIds = (data || []).map((r: any) => r.user_id);
      
      // Fetch public profile data via security definer function (bypasses RLS safely)
      let profilesMap: Record<string, { first_name: string; avatar_url: string | null; last_name_initial: string | null }> = {};
      if (userIds.length > 0) {
        const { data: publicProfiles } = await supabase.rpc("get_public_profiles", { profile_ids: userIds });
        if (publicProfiles) {
          for (const p of publicProfiles) {
            profilesMap[p.id] = { first_name: p.first_name, avatar_url: p.avatar_url, last_name_initial: (p as any).last_name_initial || null };
          }
        }
      }

      // Fetch badges for all participant user_ids
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
        profiles: profilesMap[r.user_id] || { first_name: "?", avatar_url: null },
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
      // Get the latest non-cancelled registration first, fallback to any
      const { data } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (data) return data;
      // If no active registration, check for cancelled one
      const { data: cancelled } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .eq("status", "cancelled")
        .order("created_at", { ascending: false })
        .maybeSingle();
      return cancelled;
    },
    enabled: !!eventId && !!user,
  });
};

export const useRegisterForEvent = () => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ eventId, meetingPointId, sportLevel, asWaitlist, requestApproval, paymentType }: { eventId: string; meetingPointId?: string; sportLevel?: string; asWaitlist?: boolean; requestApproval?: boolean; paymentType?: string }) => {
      if (!user) throw new Error("Devi effettuare il login");

      // Determine payment_status based on payment type
      let paymentStatus = "pending";
      if ((!paymentType || paymentType === "free") && profile?.membership_status === "Active") {
        paymentStatus = "not_required";
      } else if (paymentType === "location" && profile?.membership_status === "Active") {
        paymentStatus = "pay_on_location";
      }
      // If membership is not active, always default to "pending" for stripe payment

      type RegistrationStatus = "registered" | "waitlist" | "pending_approval";
      let status: RegistrationStatus = "registered";
      if (asWaitlist) status = "waitlist";
      if (requestApproval) status = "pending_approval";

      const { error } = await supabase.from("event_registrations").insert({
        event_id: eventId,
        user_id: user.id,
        meeting_point_id: meetingPointId || null,
        sport_level: sportLevel || null,
        status: status as any, // Cast required if TypeScript still struggles
        payment_status: paymentStatus,
      });
      if (error) throw error;

      // Handle Membership Activation if not active
      if (profile && profile.membership_status !== "Active") {
        const { error: profileError } = await supabase.rpc('activate_membership' as any, { 
          user_id_param: user.id 
        });
        
        if (profileError) {
          console.error("RPC activate_membership failed", profileError);
          throw profileError;
        }
        await refreshProfile();
      }
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

export const useCheckEventAccess = (difficulty: string | null) => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ["check-access", difficulty, user?.id],
    queryFn: async () => {
      if (!user || !profile || !difficulty) return { hasAccess: true };
      
      const diffLevel = parseInt(difficulty);
      if (isNaN(diffLevel) || diffLevel < 3) return { hasAccess: true };

      // Helper to check base profile criteria
      const checkProfileCriteria = () => {
        const { trekking_experience, activity_frequency } = profile;
        if (diffLevel === 3) { // Intermediate
          // Requires: >= 1-2 physical activities/week AND >= 3 trekking experiences
          const hasActivity = activity_frequency === "1-2/week" || activity_frequency === ">2/week";
          const hasTrekking = trekking_experience === "3-5" || trekking_experience === "5+";
          return hasActivity && hasTrekking;
        }
        if (diffLevel >= 4) { // Advanced
          // Requires: > 2 physical activities/week AND >= 5 trekking experiences
          return activity_frequency === ">2/week" && trekking_experience === "5+";
        }
        return false;
      };

      if (checkProfileCriteria()) {
        return { hasAccess: true };
      }

      // If profile criteria fails, check past event completions
      // For level 3: OR >= 3 easy-level events completed (difficulty 1 or 2)
      // For level 4/5: OR >= 3 intermediate-level events completed (difficulty 3)
      const { data: pastEvents, error } = await supabase
        .from("event_registrations")
        .select("*, events(difficulty, date)")
        .eq("user_id", user.id)
        .eq("checked_in", true)
        .in("status", ["registered", "paid"]);

      if (error || !pastEvents) {
        return { hasAccess: false, reason: "Non hai i requisiti minimi di esperienza per questo evento." };
      }

      // Filter to past events (in a real app, you'd check if event.date < now)
      // Since we just have the registrations, we count them based on linked event difficulty
      const easyCount = pastEvents.filter(r => {
        const d = parseInt((r.events as any)?.difficulty);
        return !isNaN(d) && d <= 2;
      }).length;

      const interCount = pastEvents.filter(r => {
        const d = parseInt((r.events as any)?.difficulty);
        return !isNaN(d) && d >= 3;
      }).length;

      if (diffLevel === 3 && easyCount >= 3) return { hasAccess: true };
      if (diffLevel >= 4 && interCount >= 3) return { hasAccess: true };

      return { hasAccess: false, reason: "Non hai i requisiti minimi di esperienza per questo evento." };
    },
    enabled: !!user && !!profile && !!difficulty,
  });
};

export const useOrganizerProfile = (organizerId: string | undefined) => {
  return useQuery({
    queryKey: ["organizer-full-profile", organizerId],
    queryFn: async () => {
      if (!organizerId) return null;

      // Fetch public profile data via security definer function (first_name, avatar_url only)
      const { data: publicProfile } = await supabase.rpc("get_public_profile", { profile_id: organizerId });
      const publicData = publicProfile?.[0] || null;

      // Try to get extended profile data (phone, bio) — will only work if caller has RLS access
      let phone: string | null = null;
      let bio: string | null = null;
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("phone, bio")
        .eq("id", organizerId)
        .single();
      if (fullProfile) {
        phone = fullProfile.phone;
        bio = fullProfile.bio;
      }

      // Fetch total event count
      const { count: totalCount, error: countError } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("organizer_id", organizerId);

      if (countError) throw countError;

      // Fetch public events list
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, date, time, location, image_url, difficulty, price, spots_taken, spots_total, category:event_categories(name)")
        .eq("organizer_id", organizerId)
        .eq("visibility", "public")
        .order("date", { ascending: true });

      if (eventsError) throw eventsError;

      return {
        profile: {
          first_name: publicData?.first_name || "",
          avatar_url: publicData?.avatar_url || null,
          phone,
          bio,
        },
        eventCount: totalCount || 0,
        events: events as any[]
      };
    },
    enabled: !!organizerId
  });
};
