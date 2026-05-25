import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Instagram, User as UserIcon, LogIn, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { useEvent, useEventParticipants } from "@/hooks/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import LevelAvatar from "@/components/LevelAvatar";
import { BadgeIcon } from "@/components/BadgeIcon";
import { useCommunityLevel, type CommunityLevel } from "@/hooks/useCommunityLevel";
import type { FitScoreResult } from "@/hooks/useEventFitScore";
import type { AccessRulesConfig, AccessRule } from "@/hooks/useEventAccessRules";
import { useMemo } from "react";
import { countUniqueAttendedEvents, dedupeRegistrationsByEvent } from "@/lib/eventRegistrations";
import { instagramProfileUrl } from "@/lib/instagram";
import { formatHealthSafetyStatus } from "@/lib/healthSafety";

// --- Fit score calc (organizer/admin only) ---
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
    breakdown: { level: null, experience: null, activity: null, interests: null, goal: null },
    state: "medium",
    label: "",
    color: "amber",
    reasons: [],
    profileIncomplete: false,
    hidden: true,
  };

  const hasLevel = rules.some(r => r.type === "min_level") || !!difficulty;
  const hasExp = rules.some(r => r.type === "min_experience" || r.type === "min_trekking_events" || r.type === "min_attended_events" || r.type === "min_activities");
  const hasFreq = rules.some(r => r.type === "min_activity_frequency");
  const hasInterests = rules.some(r => r.type === "interests");

  if (!hasLevel && !hasExp && !hasFreq && !hasInterests) return HIDDEN;
  if (!participantProfile) return { ...HIDDEN, hidden: false, profileIncomplete: true };

  const breakdown: FitScoreResult["breakdown"] = { level: null, experience: null, activity: null, interests: null, goal: null };
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
      weights.push({ key: "level", weight: 40 });
      reasons.push({ icon: s >= 60 ? "check" : "warning", text: s >= 60 ? "Livello adeguato" : "Livello inferiore", component: "level" });
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
    reasons.push({ icon: s >= 70 ? "check" : "warning", text: s >= 70 ? "Esperienza sufficiente" : "Esperienza bassa", component: "experience" });
  }

  if (hasFreq) {
    const r = rules.find(r => r.type === "min_activity_frequency");
    const req = r ? Number(r.value) || 1 : 1;
    const user = FREQUENCY_MAP[participantProfile.activity_frequency || ""] || 0;
    const diff = user - req;
    const s = diff >= 0 ? 100 : diff === -1 ? 70 : 40;
    breakdown.activity = s;
    weights.push({ key: "activity", weight: 25 });
    reasons.push({ icon: s >= 70 ? "check" : "warning", text: s >= 70 ? "Attività adeguata" : "Attività bassa", component: "activity" });
  }

  if (hasInterests) {
    const ir = rules.find(r => r.type === "interests");
    const eventI = ir?.interests || [];
    const userI = participantProfile.interests || [];
    if (eventI.length > 0 && userI.length > 0) {
      const m = eventI.filter((i: string) => userI.includes(i)).length;
      const s = Math.round((m / Math.max(userI.length, eventI.length)) * 100);
      breakdown.interests = s;
      weights.push({ key: "interests", weight: 10 });
    }
  }

  if (weights.length === 0) return HIDDEN;

  const tw = weights.reduce((s, w) => s + w.weight, 0);
  const score = Math.round(weights.reduce((s, w) => s + (breakdown[w.key] || 0) * (w.weight / tw), 0));

  const state: FitScoreResult["state"] = score >= 70 ? "high" : score >= 50 ? "medium" : score >= 30 ? "low_medium" : "low";

  return {
    score,
    breakdown,
    state,
    label: score >= 70 ? "Perfetto" : score >= 50 ? "Ci sta — ma preparati" : score >= 30 ? "Valuta bene" : "Potrebbe essere tosto",
    color: score >= 70 ? "green" : score >= 50 ? "amber" : "red",
    reasons,
    profileIncomplete: false,
    hidden: false,
  };
}

// --- Reliability calc helper ---
function calcReliabilityLabel(registrations: any[]): string {
  const uniqueRegistrations = dedupeRegistrationsByEvent(registrations || []);
  if (uniqueRegistrations.length === 0) return "Ottima";
  const noShows = uniqueRegistrations.filter((r: any) => r.status === "no_show").length;
  const cancellations = uniqueRegistrations.filter((r: any) => r.status === "cancelled").length;
  const score = Math.max(0, Math.min(100, 100 - (noShows * 10) - (cancellations * 3)));
  if (score >= 80) return "Ottima";
  if (score >= 60) return "Buona";
  return "Da migliorare";
}

// --- Age calc helper ---
function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birthDateObj = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const m = today.getMonth() - birthDateObj.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }
  return age;
}

// --- Level badge pill ---
const LevelBadgePill = ({ level }: { level: CommunityLevel | null | undefined }) => {
  if (!level) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-body font-medium"
      style={{
        backgroundColor: `${level.color}18`,
        color: level.color,
      }}
    >
      <BadgeIcon icon={level.icon} className="h-3 w-3" />
      {level.name}
    </span>
  );
};

// --- Standard participant row ---
const ParticipantRow = ({
  avatarUrl,
  firstName,
  points,
  level,
  age,
}: {
  avatarUrl?: string | null;
  firstName?: string;
  points: number;
  level?: CommunityLevel | null;
  age?: number | null;
}) => {
  return (
    <div className="flex items-center gap-3 py-3">
      <LevelAvatar
        avatarUrl={avatarUrl}
        firstName={firstName}
        points={points}
        level={level}
        size="md"
        showBadge
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <p className="text-sm font-body font-semibold text-foreground truncate">
          {firstName || "Utente"}{age != null ? `, ${age}` : ""}
        </p>
        <LevelBadgePill level={level} />
      </div>
    </div>
  );
};

// --- Enhanced participant row (organizer/admin only) ---
const AdminParticipantRow = ({
  avatarUrl,
  firstName,
  points,
  level,
  fitScore,
  reliabilityLabel,
  completedEvents,
  age,
  instagramHandle,
  healthStatus,
  healthNotes,
  emergencyMedicationHas,
  emergencyMedicationNotes,
  healthHelpNotes,
}: {
  avatarUrl?: string | null;
  firstName?: string;
  points: number;
  level?: CommunityLevel | null;
  fitScore: FitScoreResult | null;
  reliabilityLabel: string;
  completedEvents: number;
  age: number | null;
  instagramHandle?: string | null;
  healthStatus?: string | null;
  healthNotes?: string | null;
  emergencyMedicationHas?: boolean | null;
  emergencyMedicationNotes?: string | null;
  healthHelpNotes?: string | null;
}) => {
  return (
    <div className="flex items-center gap-3 py-3">
      <LevelAvatar
        avatarUrl={avatarUrl}
        firstName={firstName}
        points={points}
        level={level}
        size="md"
        showBadge
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-body font-semibold text-foreground truncate">
            {firstName || "Utente"}
          </p>
          <LevelBadgePill level={level} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {fitScore && !fitScore.hidden && (
            <span className={`text-[11px] font-body ${
              fitScore.color === "green" ? "text-green-600 dark:text-green-400" :
              fitScore.color === "red" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
            }`}>
              {fitScore.score >= 80 ? "✔️" : fitScore.score >= 50 ? "✔️" : "⚠️"} Compatibilità: {fitScore.score}%
            </span>
          )}
          <span className={`text-[11px] font-body ${
            reliabilityLabel === "Ottima" ? "text-green-600 dark:text-green-400" :
            reliabilityLabel === "Buona" ? "text-amber-600 dark:text-amber-400" : "text-destructive"
          }`}>
            {reliabilityLabel === "Da migliorare" ? "⚠️" : "✔️"} Affidabilità: {reliabilityLabel}
          </span>
          <span className="text-[11px] font-body text-muted-foreground">
            ✔️ {completedEvents} eventi completati
          </span>
          {age !== null && (
            <span className="text-[11px] font-body text-muted-foreground">
              🎂 {age} anni
            </span>
          )}
	          {instagramHandle && (
	            <a
              href={instagramProfileUrl(instagramHandle)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-body text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              <Instagram className="h-3 w-3" />
              @{instagramHandle}
	            </a>
	          )}
	        </div>
	        {healthStatus && (
	          <div className={`mt-2 rounded-xl border p-2.5 ${
	            healthStatus === "has_info" ? "border-warning/30 bg-warning/10" : "border-success/20 bg-success/10"
	          }`}>
	            <div className="flex items-start gap-2">
	              {healthStatus === "has_info" ? (
	                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
	              ) : (
	                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
	              )}
	              <div className="min-w-0 space-y-1">
	                <p className="text-[11px] font-body font-bold text-foreground">
	                  Salute e sicurezza: {formatHealthSafetyStatus(healthStatus)}
	                </p>
	                {healthStatus === "has_info" && healthNotes && (
	                  <p className="text-[11px] font-body leading-relaxed text-muted-foreground">{healthNotes}</p>
	                )}
	                {healthStatus === "has_info" && emergencyMedicationHas && emergencyMedicationNotes && (
	                  <p className="text-[11px] font-body leading-relaxed text-muted-foreground">
	                    Farmaci/dispositivi: {emergencyMedicationNotes}
	                  </p>
	                )}
	                {healthStatus === "has_info" && healthHelpNotes && (
	                  <p className="text-[11px] font-body leading-relaxed text-muted-foreground">
	                    Indicazioni: {healthHelpNotes}
	                  </p>
	                )}
	              </div>
	            </div>
	          </div>
	        )}
	      </div>
	    </div>
	  );
};

// --- Main page ---
const EventParticipants = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isOrganizer } = useAuth();
  const { data: event, isLoading: eventLoading } = useEvent(id!);
  const { data: participants, isLoading: participantsLoading } = useEventParticipants(id!);

  const isOrgOrAdmin = isAdmin || (isOrganizer && user?.id === event?.organizer_id);

  const visibleParticipants = useMemo(() => {
    const organizerId = event?.organizer_id;
    return (participants || []).filter((p: any) => !organizerId || p.user_id !== organizerId);
  }, [event?.organizer_id, participants]);

  const participantIds = useMemo(() => (
    [...new Set(visibleParticipants
      .filter((p: any) => !p.is_manual && p.user_id)
      .map((p: any) => p.user_id))]
  ), [visibleParticipants]);

  const { data: publicParticipantProfiles } = useQuery({
    queryKey: ["participant-public-profiles", participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return {};
      const { data } = await supabase.rpc("get_public_profiles", { profile_ids: participantIds });
      const map: Record<string, any> = {};
      ((data as any[]) || []).forEach((profile: any) => {
        map[profile.id] = profile;
      });
      return map;
    },
    enabled: participantIds.length > 0,
  });
  
  // Fetch full profiles (for fit score calc + points)
  const { data: fullProfiles } = useQuery({
    queryKey: ["participant-full-profiles", id, participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
	        .select("id, self_level, trekking_experience, activity_frequency, interests, total_points, birth_date, instagram_handle, health_safety_status, health_safety_notes, emergency_medication_has, emergency_medication_notes, health_safety_help_notes")
	        .in("id", participantIds);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
	    enabled: isOrgOrAdmin && participantIds.length > 0,
  });

  // Fetch all registrations for reliability + completed events (org/admin only)
  const { data: allRegistrations } = useQuery({
    queryKey: ["participant-registrations-admin", participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return {};
      const { data } = await supabase
        .from("event_registrations")
        .select("user_id, event_id, status, checked_in, created_at")
        .in("user_id", participantIds);
      const map: Record<string, any[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.user_id]) map[r.user_id] = [];
        map[r.user_id].push(r);
      });
      return map;
    },
    enabled: isOrgOrAdmin && participantIds.length > 0,
  });

  const accessRules = (event?.access_rules as AccessRulesConfig | null)?.rules || [];

  // Fetch public avatars for blurred guest view
  const { data: publicAvatars } = useQuery({
    queryKey: ["public-avatars", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_event_participant_avatars", { p_event_id: id! });
      return data || [];
    },
    enabled: !user && !!id,
  });

  const visiblePublicAvatars = useMemo(() => {
    const organizerId = event?.organizer_id;
    return ((publicAvatars || []) as any[]).filter((p: any) => !organizerId || p.user_id !== organizerId);
  }, [event?.organizer_id, publicAvatars]);

  const totalParticipants = user && participants
    ? visibleParticipants.length
    : visiblePublicAvatars.length > 0
      ? visiblePublicAvatars.length
      : event?.spots_taken || 0;

  // --- Loading ---
  if (eventLoading || participantsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 bg-background z-10 px-4 py-3 header-safe-top [--header-safe-offset:0.75rem] min-h-[calc(56px+env(safe-area-inset-top,0px))] flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="px-4 py-4 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Not found ---
  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Evento non trovato</p>
      </div>
    );
  }

  // --- Guest / not logged in ---
  if (!user) {
    const renderList = visiblePublicAvatars.length > 0
      ? visiblePublicAvatars
      : Array.from({ length: totalParticipants });

    return (
      <div className="min-h-screen bg-background relative">
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 px-4 py-3 header-safe-top [--header-safe-offset:0.75rem] min-h-[calc(56px+env(safe-area-inset-top,0px))] flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <h2 className="font-display text-lg font-bold text-foreground">Partecipanti</h2>
          {totalParticipants > 0 && (
            <span className="ml-auto text-xs font-body text-muted-foreground">
              {totalParticipants} {totalParticipants === 1 ? "persona sta partecipando" : "persone stanno partecipando"}
            </span>
          )}
        </div>

        <div className="max-w-lg mx-auto px-4 py-4 pb-64">
          {/* Blurred participants */}
          {totalParticipants > 0 && (
            <div>
              <div className="select-none">
                {renderList.map((p: any, index) => (
                  <div key={p?.user_id || index} className="flex items-center gap-3 py-3">
                    <div className="blur-[6px] pointer-events-none">
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <span className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                          {p?.first_name?.[0] || "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 blur-[6px] pointer-events-none">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-body font-semibold text-foreground truncate">
                          {p?.first_name || "Utente"}
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-body font-medium bg-muted text-muted-foreground">
                          Membro
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-6 text-center z-20">
          <p className="text-base font-body font-semibold text-foreground mb-1">
            Ti stai perdendo qualcosa!
          </p>
          <p className="text-sm font-body text-muted-foreground mb-4">
            Accedi e completa il profilo per scoprire chi partecipa.
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full gap-2" size="lg">
            Accedi
          </Button>
        </div>
      </div>
    );
  }

  // --- Logged in: ALL users can see the list (no registration gate) ---

  // Helper: get completed events count from registrations
  const getCompletedEvents = (userId: string) => {
    const regs = allRegistrations?.[userId] || [];
    return countUniqueAttendedEvents(regs);
  };

  const getReliabilityLabel = (userId: string) => {
    return calcReliabilityLabel(allRegistrations?.[userId] || []);
  };

  // --- Full participant list ---
  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 px-4 py-3 header-safe-top [--header-safe-offset:0.75rem] min-h-[calc(56px+env(safe-area-inset-top,0px))] flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="font-display text-lg font-bold text-foreground">Partecipanti</h2>
        {totalParticipants > 0 && (
          <span className="ml-auto text-xs font-body text-muted-foreground">
            {totalParticipants} {totalParticipants === 1 ? "persona sta partecipando" : "persone stanno partecipando"}
          </span>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Participants */}
        {visibleParticipants.length > 0 ? (
          <div>
            <div>
              {visibleParticipants.map((p: any) => {
                const pProfile = fullProfiles?.[p.user_id];
                const points = pProfile?.total_points ?? publicParticipantProfiles?.[p.user_id]?.total_points ?? 0;

                if (isOrgOrAdmin) {
                  const fitScore = pProfile
                    ? calcFitScore(pProfile, accessRules, event.difficulty || null)
                    : null;

                  return (
                    <AdminParticipantRowWithLevel
                      key={p.id}
                      avatarUrl={p.profiles?.avatar_url}
                      firstName={p.profiles?.first_name}
                      points={points}
                      fitScore={fitScore}
                      reliabilityLabel={getReliabilityLabel(p.user_id)}
                      completedEvents={getCompletedEvents(p.user_id)}
                      isManual={p.is_manual}
	                      manualLevel={p.manual_level}
	                      birthDate={pProfile?.birth_date}
	                      instagramHandle={pProfile?.instagram_handle}
	                      healthStatus={pProfile?.health_safety_status}
	                      healthNotes={pProfile?.health_safety_notes}
	                      emergencyMedicationHas={pProfile?.emergency_medication_has}
	                      emergencyMedicationNotes={pProfile?.emergency_medication_notes}
	                      healthHelpNotes={pProfile?.health_safety_help_notes}
	                    />
                  );
                }

                return (
                  <ParticipantRowWithLevel
                    key={p.id}
                    avatarUrl={p.profiles?.avatar_url}
                    firstName={p.profiles?.first_name}
                    points={points}
                    isManual={p.is_manual}
                    manualLevel={p.manual_level}
                    birthDate={p.is_manual ? null : pProfile?.birth_date}
                  />
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

// Wrapper that fetches level for standard user view
const ParticipantRowWithLevel = ({
  avatarUrl,
  firstName,
  points,
  isManual,
  manualLevel,
  birthDate,
}: {
  avatarUrl?: string | null;
  firstName?: string;
  points: number;
  isManual?: boolean;
  manualLevel?: string | null;
  birthDate?: string | null;
}) => {
  const { data: levelData } = useCommunityLevel(points);
  
  let finalLevel = levelData;
  if (isManual && manualLevel) {
    const levelNameMap: Record<string, string> = { "beginner": "Principiante", "intermediate": "Intermedio", "advanced": "Esperto" };
    finalLevel = {
      level_number: 0,
      name: levelNameMap[manualLevel] || manualLevel,
      icon: "Star",
      color: "#64748b",
      min_points: 0
    };
  }

  return (
    <ParticipantRow
      avatarUrl={avatarUrl}
      firstName={firstName}
      points={points}
      level={finalLevel}
      age={calculateAge(birthDate)}
    />
  );
};

// Wrapper that fetches level for admin view
const AdminParticipantRowWithLevel = ({
  avatarUrl,
  firstName,
  points,
  fitScore,
  reliabilityLabel,
  completedEvents,
  isManual,
	  manualLevel,
	  birthDate,
	  instagramHandle,
	  healthStatus,
	  healthNotes,
	  emergencyMedicationHas,
	  emergencyMedicationNotes,
	  healthHelpNotes,
	}: {
  avatarUrl?: string | null;
  firstName?: string;
  points: number;
  fitScore: FitScoreResult | null;
  reliabilityLabel: string;
  completedEvents: number;
  isManual?: boolean;
	  manualLevel?: string | null;
	  birthDate?: string | null;
	  instagramHandle?: string | null;
	  healthStatus?: string | null;
	  healthNotes?: string | null;
	  emergencyMedicationHas?: boolean | null;
	  emergencyMedicationNotes?: string | null;
	  healthHelpNotes?: string | null;
	}) => {
  const { data: levelData } = useCommunityLevel(points);

  let finalLevel = levelData;
  if (isManual && manualLevel) {
    const levelNameMap: Record<string, string> = { "beginner": "Principiante", "intermediate": "Intermedio", "advanced": "Esperto" };
    finalLevel = {
      level_number: 0,
      name: levelNameMap[manualLevel] || manualLevel,
      icon: "Star",
      color: "#64748b",
      min_points: 0
    };
  }

  return (
    <AdminParticipantRow
      avatarUrl={avatarUrl}
      firstName={firstName}
      points={points}
      level={finalLevel}
      fitScore={fitScore}
      reliabilityLabel={reliabilityLabel}
	      completedEvents={completedEvents}
	      age={calculateAge(birthDate)}
	      instagramHandle={isManual ? null : instagramHandle}
	      healthStatus={isManual ? null : healthStatus}
	      healthNotes={isManual ? null : healthNotes}
	      emergencyMedicationHas={isManual ? null : emergencyMedicationHas}
	      emergencyMedicationNotes={isManual ? null : emergencyMedicationNotes}
	      healthHelpNotes={isManual ? null : healthHelpNotes}
	    />
  );
};

export default EventParticipants;
