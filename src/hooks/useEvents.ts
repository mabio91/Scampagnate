import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive as isMembershipActiveFn } from "@/lib/membership";
import { parseEventDateTime } from "@/lib/timezone";
import { ACTIVE_PARTICIPANT_STATUSES } from "@/lib/eventPayments";

const EDGE_GATEWAY_JWT =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_FUNCTIONS_URL = (
  import.meta.env.VITE_SUPABASE_URL || "https://istotjnoqtrtthnyreyv.supabase.co"
).replace(/\/$/, "");

export interface EventWithDetails {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category_id: string | null;
  status: "draft" | "unpublished" | "upcoming" | "published" | "available" | "open" | "full" | "closed" | "rescheduled" | "cancelled" | "past" | "completed";
  price: number;
  deposit: number | null;
  payment_type: "free" | "paid" | "deposit" | "location";
  balance_payment_mode?: "online" | "on_site" | null;
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
  access_rules: any;
  category?: { name: string; icon: string } | null;
  meeting_points?: { id: string; name: string; location: string; time: string; notes: string | null }[];
  price_options?: {
    id: string;
    name: string;
    price: number;
    sort_order: number;
    original_price: number | null;
    eligible_group: string;
    is_promotional: boolean;
    promo_start: string | null;
    promo_end: string | null;
    payment_type: "free" | "paid" | "deposit" | "location" | null;
    deposit_amount: number | null;
    balance_amount: number | null;
    balance_payment_mode: "online" | "on_site" | null;
    has_dedicated_spots: boolean | null;
    dedicated_spots: number | null;
    spots_taken: number | null;
    waitlist_enabled: boolean | null;
  }[];
}

export interface EventStaffMember {
  id: string;
  event_id: string;
  profile_id: string | null;
  display_name: string;
  role_label: string;
  avatar_url: string | null;
  sort_order: number;
  is_public: boolean;
  profile?: {
    first_name: string;
    avatar_url: string | null;
    last_name_initial?: string | null;
  } | null;
}

const PRICE_OPTION_SELECT =
  "id, name, price, sort_order, original_price, eligible_group, is_promotional, promo_start, promo_end, payment_type, deposit_amount, balance_amount, balance_payment_mode, has_dedicated_spots, dedicated_spots, spots_taken, waitlist_enabled";
const NON_MANUAL_REGISTRATION_FILTER = "sport_level.is.null,sport_level.not.like.manual:%";

export const useEvents = (categoryName?: string | null) => {
  const { user, isOrganizer, isAdmin } = useAuth();
  return useQuery({
    queryKey: ["events", categoryName, user?.id, isOrganizer, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select(`id, title, date, time, location, location_label, category_id, status, price, deposit, payment_type, balance_payment_mode, image_url, difficulty, distance, elevation, duration, spots_total, spots_taken, featured, organizer_id, organizer_name, description, cancellation_policy, equipment_list, additional_fields, visibility, gallery_images, event_categories(name, icon), event_meeting_points(id, name, location, time, notes), event_price_options(${PRICE_OPTION_SELECT})`)
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
        meeting_points: event.event_meeting_points,
        price_options: event.event_price_options?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [],
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
        .select(`*, event_categories(name, icon), event_meeting_points(*), event_price_options(${PRICE_OPTION_SELECT})`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return {
        ...data,
        category: data.event_categories,
        meeting_points: data.event_meeting_points || [],
        price_options: ((data as any).event_price_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      } as unknown as EventWithDetails;
    },
    enabled: !!id,
  });
};

export const useEventStaff = (eventId: string) => {
  return useQuery({
    queryKey: ["event-staff", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_staff" as any)
        .select("id, event_id, profile_id, display_name, role_label, avatar_url, sort_order, is_public")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const staffRows = ((data || []) as any[]) as EventStaffMember[];
      const profileIds = [...new Set(staffRows.map((row) => row.profile_id).filter(Boolean))] as string[];
      let profilesMap: Record<string, EventStaffMember["profile"]> = {};

      if (profileIds.length > 0) {
        const { data: publicProfiles } = await supabase.rpc("get_public_profiles", { profile_ids: profileIds });
        profilesMap = Object.fromEntries(
          ((publicProfiles || []) as any[]).map((profile) => [
            profile.id,
            {
              first_name: profile.first_name,
              avatar_url: profile.avatar_url,
              last_name_initial: profile.last_name_initial || null,
            },
          ])
        );
      }

      return staffRows.map((row) => ({
        ...row,
        profile: row.profile_id ? profilesMap[row.profile_id] || null : null,
      }));
    },
    enabled: !!eventId,
  });
};

export const useEventParticipants = (eventId: string) => {
  return useQuery({
    queryKey: ["event-participants", eventId],
    queryFn: async () => {
      // Fetch registrations with meeting points (no profile join — use RPC for public profile data)
      const { data, error } = await supabase
        .from("event_registrations")
        .select(`*, meeting_point:event_meeting_points(id, name), price_option:event_price_options(${PRICE_OPTION_SELECT})`)
        .eq("event_id", eventId)
        .in("status", [...ACTIVE_PARTICIPANT_STATUSES])
        .neq("payment_status", "pending");
      if (error) throw error;

      const userIds = (data || [])
        .map((r: any) => r.user_id)
        .filter(Boolean);
      
      // Fetch public profile data via security definer function (bypasses RLS safely)
      const profilesMap: Record<string, { first_name: string; avatar_url: string | null; last_name_initial: string | null }> = {};
      if (userIds.length > 0) {
        const { data: publicProfiles } = await supabase.rpc("get_public_profiles", { profile_ids: userIds });
        if (publicProfiles) {
          for (const p of publicProfiles) {
            profilesMap[p.id] = { first_name: p.first_name, avatar_url: p.avatar_url, last_name_initial: (p as any).last_name_initial || null };
          }
        }
      }

      // Fetch badges for all participant user_ids
      const badgesMap: Record<string, any[]> = {};
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

      return (data || []).map((r: any) => {
        const isManual = r.sport_level?.startsWith("manual:");
        let manualName: string | null = null;
        let manualLevel: string | null = null;

        if (isManual) {
          const payload = r.sport_level.replace("manual:", "");
          // Format: "Name" or "Name|level:beginner"
          const parts = payload.split("|");
          manualName = parts[0] || "?";
          const levelPart = parts.find((p: string) => p.startsWith("level:"));
          if (levelPart) {
            manualLevel = levelPart.replace("level:", "");
          }
        }

        return {
          ...r,
          profiles: isManual
            ? { first_name: manualName, avatar_url: null, last_name_initial: null }
            : profilesMap[r.user_id] || { first_name: "?", avatar_url: null },
          badges: isManual ? [] : badgesMap[r.user_id] || [],
          is_manual: isManual,
          manual_level: manualLevel,
        };
      });
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
        .or(NON_MANUAL_REGISTRATION_FILTER)
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
        .or(NON_MANUAL_REGISTRATION_FILTER)
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
  const { user, profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      eventId,
      meetingPointId,
      sportLevel,
      asWaitlist,
      requestApproval,
      paymentType,
      priceOptionId,
      carAvailability,
      additionalResponses,
    }: {
      eventId: string;
      meetingPointId?: string;
      sportLevel?: string;
      asWaitlist?: boolean;
      requestApproval?: boolean;
      paymentType?: string;
      priceOptionId?: string;
      carAvailability?: string;
      additionalResponses?: Record<string, string>;
    }) => {
      if (!user) throw new Error("Devi effettuare il login");

      // Determine payment_status based on payment type
      let paymentStatus = "pending";
      if (asWaitlist) {
        paymentStatus = "not_required";
      } else if ((!paymentType || paymentType === "free") && isMembershipActiveFn(profile)) {
        paymentStatus = "not_required";
      } else if (paymentType === "location" && isMembershipActiveFn(profile)) {
        paymentStatus = "pay_on_location";
      }
      // If membership is not active, payment remains pending and is handled at checkout.

      type RegistrationStatus = "registered" | "waitlist" | "pending_approval" | "pending_payment";
      let status: RegistrationStatus = "registered";
      if (asWaitlist) status = "waitlist";
      if (requestApproval) status = "pending_approval";
      if (!asWaitlist && !requestApproval && (paymentType === "paid" || paymentType === "deposit")) {
        status = "pending_payment";
      }

      const registrationPayload = {
        event_id: eventId,
        user_id: user.id,
        meeting_point_id: meetingPointId || null,
        car_availability: carAvailability || null,
        additional_responses: additionalResponses && Object.keys(additionalResponses).length > 0 ? additionalResponses : null,
        sport_level: sportLevel || null,
        status: status as any,
        payment_status: paymentStatus,
        price_option_id: priceOptionId || null,
      } as any;

      const { data: insertedData, error } = await supabase
        .from("event_registrations")
        .insert(registrationPayload)
        .select("id")
        .single();
      if (error) throw error;
      return { registrationId: insertedData?.id, eventId };
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

export const useUpdateRegistrationDetails = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      registrationId,
      eventId,
      meetingPointId,
      carAvailability,
      additionalResponses,
    }: {
      registrationId: string;
      eventId: string;
      meetingPointId?: string;
      carAvailability?: string;
      additionalResponses?: Record<string, string>;
    }) => {
      if (!user) throw new Error("Devi effettuare il login");

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("date, time")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      if (!eventData?.date || !eventData?.time || parseEventDateTime(eventData.date, eventData.time).getTime() <= Date.now()) {
        throw new Error("Non è più possibile modificare l'iscrizione dopo l'inizio dell'evento");
      }

      const payload = {
        meeting_point_id: meetingPointId || null,
        car_availability: carAvailability || null,
        additional_responses: additionalResponses && Object.keys(additionalResponses).length > 0 ? additionalResponses : null,
      };

      const { error } = await supabase
        .from("event_registrations")
        .update(payload)
        .eq("id", registrationId)
        .eq("user_id", user.id);

      if (error) throw error;
      return { eventId, registrationId };
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
      if (!EDGE_GATEWAY_JWT) {
        throw new Error("Configurazione Supabase mancante per la funzione.");
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessione scaduta. Effettua di nuovo l'accesso.");
      }

      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/functions/v1/process-refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EDGE_GATEWAY_JWT,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Errore durante la cancellazione");
      }
      if (data?.error) throw new Error(data.error);
      
      return data as { refunded: boolean; cancelled: boolean; reason?: string; policy?: string };
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
        .select(`*, events(*, event_categories(name, icon), event_meeting_points(id, name, location, time, notes), event_price_options(${PRICE_OPTION_SELECT})), meeting_point:event_meeting_points(id, name, location, time)`)
        .eq("user_id", user.id)
        .or(NON_MANUAL_REGISTRATION_FILTER)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((registration: any) => ({
        ...registration,
        events: registration.events
          ? {
              ...registration.events,
              category: registration.events.event_categories,
              meeting_points: registration.events.event_meeting_points || [],
              price_options: (registration.events.event_price_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
            }
          : registration.events,
      }));
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

export const useEventOpeningReminders = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["event-opening-reminders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("event_opening_reminders")
        .select("id, event_id, created_at, cancelled_at, notified_at")
        .eq("user_id", user.id)
        .is("cancelled_at", null)
        .is("notified_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

export const useToggleEventOpeningReminder = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ eventId, isReminderActive }: { eventId: string; isReminderActive: boolean }) => {
      if (!user) throw new Error("Devi effettuare il login");

      if (isReminderActive) {
        const { error } = await supabase
          .from("event_opening_reminders")
          .update({ cancelled_at: new Date().toISOString() })
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .is("cancelled_at", null)
          .is("notified_at", null);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("event_opening_reminders")
        .insert({ event_id: eventId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-opening-reminders"] });
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

// Legacy: keep export name for backward compat, delegates to new hook
export { useCheckEventAccessRules as useCheckEventAccess } from "./useEventAccessRules";

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
