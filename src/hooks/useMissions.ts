import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PERIODIC_MISSION_TYPES = new Set(["monthly", "weekly"]);

const getZonedDateParts = (date: Date, timezone: string) => {
  const readParts = (timeZone: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

    return {
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
    };
  };

  try {
    return readParts(timezone);
  } catch {
    return readParts("Europe/Rome");
  }
};

const getMissionCycleKey = (missionType: string | null | undefined, timezone?: string | null, date = new Date()) => {
  const normalizedType = (missionType || "").toLowerCase();
  const safeTimezone = timezone?.trim() || "Europe/Rome";
  const parts = getZonedDateParts(date, safeTimezone);

  if (normalizedType === "monthly") {
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }

  if (normalizedType === "weekly") {
    const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const dayOfWeek = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
    const isoYear = utcDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const isoWeek = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  }

  return "lifetime";
};

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: string;
  target_value: number;
  reward_points: number;
  reward_badge_id: string | null;
  reward_type?: string;
  reward_value?: string | null;
  category: string | null;
  sort_order?: number | null;
  timezone?: string | null;
  mission_rewards?: MissionReward[];
}

export interface MissionReward {
  id: string;
  mission_id: string;
  sort_order: number;
  reward_kind: "points" | "badge" | "coupon" | "physical";
  title: string;
  points_value: number | null;
  badge_id: string | null;
  source_discount_code_id?: string | null;
  visible_on_profile?: boolean;
  coupon_config?: any;
  badge_config?: any;
  physical_config?: {
    reward_name?: string | null;
    claim_instructions?: string | null;
    [key: string]: unknown;
  } | null;
  badges?: {
    name: string;
    icon: string;
  } | null;
}

export interface UserMission {
  id: string;
  mission_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  missions: Mission;
}

interface UserMissionProgress {
  mission_id: string;
  cycle_key: string;
  current_value: number;
  is_completed: boolean;
  completed_at: string | null;
}

export const useUserMissions = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user-missions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const [missionsResult, progressResult] = await Promise.all([
        supabase
          .from("user_missions")
          .select("*, missions(*, mission_rewards(*, badges(name, icon)))")
          .eq("user_id", userId)
          .order("sort_order", { referencedTable: "missions", ascending: true }),
        supabase
          .from("user_mission_progress" as any)
          .select("mission_id, cycle_key, current_value, is_completed, completed_at")
          .eq("user_id", userId),
      ]);

      if (missionsResult.error) throw missionsResult.error;
      if (progressResult.error) throw progressResult.error;

      const missionRows = (missionsResult.data || []) as unknown as UserMission[];
      const progressRows = (progressResult.data || []) as UserMissionProgress[];

      return missionRows.map((userMission) => {
        const missionType = userMission.missions?.type || "";
        if (!PERIODIC_MISSION_TYPES.has(missionType.toLowerCase())) return userMission;

        const currentCycleKey = getMissionCycleKey(missionType, userMission.missions?.timezone);
        const currentProgress = progressRows.find((progress) =>
          progress.mission_id === userMission.mission_id && progress.cycle_key === currentCycleKey
        );

        return {
          ...userMission,
          progress: currentProgress?.current_value ?? 0,
          completed: currentProgress?.is_completed ?? false,
          completed_at: currentProgress?.completed_at ?? null,
        };
      });
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-missions-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_missions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-missions", userId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_mission_progress",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-missions", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
};

export const useActiveMissions = () => {
  return useQuery({
    queryKey: ["active-missions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("missions")
        .select("*, mission_rewards(*, badges(name, icon))")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("sort_order", { referencedTable: "mission_rewards", ascending: true });
      return (data || []) as Mission[];
    },
  });
};
