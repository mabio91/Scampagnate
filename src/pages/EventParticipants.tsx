import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, User as UserIcon } from "lucide-react";
import { useEvent, useEventParticipants } from "@/hooks/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EventFitScoreCompact } from "@/components/events/EventFitScore";
import LevelAvatar from "@/components/LevelAvatar";
import type { FitScoreResult } from "@/hooks/useEventFitScore";
import type { AccessRulesConfig, AccessRule } from "@/hooks/useEventAccessRules";
import { useMemo } from "react";

// Lightweight score calculation for a given participant profile
const LEVEL_MAP: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
const EXPERIENCE_MAP: Record<string, number> = { "0_2": 1, "3_5": 2, "5_plus": 3, "5+": 3 };
const FREQUENCY_MAP: Record<string, number> = { low: 1, "0-1/week": 1, medium: 2, "1-2/week": 2, high: 3, ">2/week": 3 };

function calcFitScore(
  participantProfile: any,
  rules: AccessRule[],
  difficulty: string | null
): FitScoreResult {
  const HIDDEN: FitScoreResult = {
    score: 0,
    breakdown: { level: null, experience: null, activity: null, interests: null },
    label: "media", labelDisplay: "", color: "amber", reasons: [], profileIncomplete: false, hidden: true,
  };

  const hasLevel = rules.some(r => r.type === "min_level") || !!difficulty;
  const hasExp = rules.some(r => r.type === "min_experience" || r.type === "min_trekking_events" || r.type === "min_attended_events" || r.type === "min_activities");
  const hasFreq = rules.some(r => r.type === "min_activity_frequency");
  const hasInterests = rules.some(r => r.type === "interests");

  if (!hasLevel && !hasExp && !hasFreq && !hasInterests) return HIDDEN;
  if (!participantProfile) return { ...HIDDEN, hidden: false, profileIncomplete: true };

  const breakdown: FitScoreResult["breakdown"] = { level: null, experience: null, activity: null, interests: null };
  const reasons: FitScoreResult["reasons"] = [];
  const weights: { key: keyof typeof breakdown; weight: number }[] = [];

  if (hasLevel) {
    const levelRule = rules.find(r => r.type === "min_level");
    const req = levelRule ? Number(levelRule.value) || 1 : parseInt(difficulty || "0") || 0;
    if (req > 0) {
      const user = LEVEL_MAP[participantProfile.self_level || ""] || 0;
      const diff = user - req;
      const s = diff >= 0 ? 100 : diff === -1 ? 60 : 20;
      breakdown.level = s;
      weights.push({ key: "level", weight: 35 });
      reasons.push({ icon: s >= 60 ? "check" : "warning", text: s >= 60 ? "Livello adeguato" : "Livello inferiore" });
    }
  }

  if (hasExp) {
    const r = rules.find(r => r.type === "min_experience");
    const req = r ? Number(r.value) || 1 : 1;
    const user = EXPERIENCE_MAP[participantProfile.trekking_experience || ""] || 0;
    const diff = user - req;
    const s = diff >= 0 ? 100 : diff === -1 ? 70 : 30;
    breakdown.experience = s;
    weights.push({ key: "experience", weight: 20 });
    reasons.push({ icon: s >= 70 ? "check" : "warning", text: s >= 70 ? "Esperienza sufficiente" : "Esperienza bassa" });
  }

  if (hasFreq) {
    const r = rules.find(r => r.type === "min_activity_frequency");
    const req = r ? Number(r.value) || 1 : 1;
    const user = FREQUENCY_MAP[participantProfile.activity_frequency || ""] || 0;
    const diff = user - req;
    const s = diff >= 0 ? 100 : diff === -1 ? 70 : 40;
    breakdown.activity = s;
    weights.push({ key: "activity", weight: 20 });
    reasons.push({ icon: s >= 70 ? "check" : "warning", text: s >= 70 ? "Attività adeguata" : "Attività bassa" });
  }

  if (hasInterests) {
    const ir = rules.find(r => r.type === "interests");
    const eventI = ir?.interests || [];
    const userI = participantProfile.interests || [];
    if (eventI.length > 0 && userI.length > 0) {
      const m = eventI.filter((i: string) => userI.includes(i)).length;
      const s = Math.round((m / Math.max(userI.length, eventI.length)) * 100);
      breakdown.interests = s;
      weights.push({ key: "interests", weight: 25 });
    }
  }

  if (weights.length === 0) return HIDDEN;

  const tw = weights.reduce((s, w) => s + w.weight, 0);
  const score = Math.round(weights.reduce((s, w) => s + (breakdown[w.key] || 0) * (w.weight / tw), 0));

  return {
    score,
    breakdown,
    label: score >= 80 ? "alta" : score >= 50 ? "media" : "bassa",
    labelDisplay: score >= 80 ? "Ottima compatibilità" : score >= 50 ? "Buona compatibilità" : "Bassa compatibilità",
    color: score >= 80 ? "green" : score >= 50 ? "amber" : "red",
    reasons,
    profileIncomplete: false,
    hidden: false,
  };
}

const EventParticipants = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isOrganizer } = useAuth();
  const { data: event, isLoading: eventLoading } = useEvent(id!);
  const { data: participants, isLoading: participantsLoading } = useEventParticipants(id!);

  const isOrgOrAdmin = isAdmin || (isOrganizer && user?.id === event?.organizer_id);

  // Fetch full profiles for participants if organizer/admin (for fit score)
  const participantIds = useMemo(() => (participants || []).map((p: any) => p.user_id), [participants]);
  const { data: fullProfiles } = useQuery({
    queryKey: ["participant-full-profiles", id, participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, self_level, trekking_experience, activity_frequency, interests, total_points")
        .in("id", participantIds);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: participantIds.length > 0,
  });

  const { data: organizerProfile } = useQuery({
    queryKey: ["organizer-profile-public", event?.organizer_id],
    queryFn: async () => {
      if (!event?.organizer_id) return null;
      const { data } = await supabase.rpc("get_public_profile", { profile_id: event.organizer_id });
      return data?.[0] || null;
    },
    enabled: !!event?.organizer_id,
  });

  const accessRules = (event?.access_rules as AccessRulesConfig | null)?.rules || [];

  if (eventLoading || participantsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 bg-background z-10 border-b border-border px-4 py-3 flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="px-4 py-4 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Evento non trovato</p>
      </div>
    );
  }

  const myRegistration = participants?.find((p: any) => p.user_id === user?.id);
  const canView = !!user && (!!myRegistration || user.id === event.organizer_id || isAdmin);

  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 bg-background z-10 border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <h2 className="font-display text-lg font-bold text-foreground">Partecipanti</h2>
        </div>
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground font-body text-sm">Iscriviti all'evento per vedere i partecipanti</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="font-display text-lg font-bold text-foreground">Partecipanti</h2>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Organizer */}
        <div className="mb-6">
          <p className="text-sm font-body font-semibold text-muted-foreground mb-3">Organizzatore</p>
          <Link
            to={`/organizer/${event.organizer_id}`}
            className="flex items-center gap-3"
          >
            {organizerProfile?.avatar_url ? (
              <img src={organizerProfile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-body font-bold">
                {event.organizer_name?.[0] || "O"}
              </div>
            )}
            <p className="text-sm font-body font-semibold text-foreground">
              {organizerProfile?.first_name || event.organizer_name}
            </p>
          </Link>
        </div>

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Participants */}
        {participants && participants.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-body font-semibold text-muted-foreground mb-3">Chi c'è?</p>
            <div className="space-y-1">
              {participants.map((p: any) => {
                const pProfile = fullProfiles?.[p.user_id];
                const fitScore = isOrgOrAdmin && pProfile
                  ? calcFitScore(pProfile, accessRules, event.difficulty || null)
                  : null;

                return (
                  <div key={p.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                    <LevelAvatar
                      avatarUrl={p.profiles?.avatar_url}
                      firstName={p.profiles?.first_name}
                      points={pProfile?.total_points || 0}
                      size="md"
                      showBadge
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-semibold text-foreground">
                        {p.profiles?.first_name}{p.profiles?.last_name_initial ? ` ${p.profiles.last_name_initial}` : ''}
                      </p>
                      {p.badges && p.badges.length > 0 && (
                        <p className="text-xs font-body text-muted-foreground">
                          {p.badges.length} badge
                        </p>
                      )}
                    </div>
                    {/* Fit score for organizer/admin only */}
                    {fitScore && !fitScore.hidden && (
                      <div className="shrink-0">
                        <EventFitScoreCompact fitScore={fitScore} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-8 text-center">
            <UserIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-body text-muted-foreground">Nessun partecipante ancora</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventParticipants;
