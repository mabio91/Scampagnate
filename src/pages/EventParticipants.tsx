import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarCheck, Star, User as UserIcon, ZoomIn } from "lucide-react";
import { useEvent, useEventParticipants } from "@/hooks/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LevelAvatar from "@/components/LevelAvatar";
import { BadgeIcon } from "@/components/BadgeIcon";
import { useCommunityLevel, type CommunityLevel } from "@/hooks/useCommunityLevel";
import { useMemo, useState } from "react";

type PublicParticipantBadge = {
  icon?: string | null;
  name?: string | null;
};

function formatLastNameInitial(lastNameInitial: string | null | undefined): string | null {
  const initial = lastNameInitial?.trim().replace(/\.$/, "").charAt(0);
  return initial ? `${initial.toUpperCase()}.` : null;
}

function formatParticipantDisplayName(firstName: string | null | undefined, lastNameInitial: string | null | undefined) {
  const baseName = firstName?.trim() || "Utente";
  const formattedInitial = formatLastNameInitial(lastNameInitial);
  return formattedInitial ? `${baseName} ${formattedInitial}` : baseName;
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
  lastNameInitial,
  points,
  level,
  age,
  onOpen,
}: {
  avatarUrl?: string | null;
  firstName?: string;
  lastNameInitial?: string | null;
  points: number;
  level?: CommunityLevel | null;
  age?: number | null;
  onOpen?: () => void;
}) => {
  const displayName = formatParticipantDisplayName(firstName, lastNameInitial);

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`flex items-center gap-3 rounded-xl py-3 ${onOpen ? "cursor-pointer px-2 -mx-2 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
    >
      <LevelAvatar
        avatarUrl={avatarUrl}
        firstName={firstName}
        lastName={lastNameInitial || undefined}
        points={points}
        level={level}
        size="md"
        showBadge
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <p className="text-sm font-body font-semibold text-foreground truncate">
          {displayName}{age != null ? `, ${age}` : ""}
        </p>
        <LevelBadgePill level={level} />
      </div>
    </div>
  );
};

const PublicParticipantProfileDialog = ({
  participant,
  onOpenChange,
}: {
  participant: any | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const profile = participant?.profiles || {};
  const firstName = profile.first_name || participant?.first_name || "Partecipante";
  const displayName = formatParticipantDisplayName(firstName, profile.last_name_initial);
  const age = profile.age ?? null;
  const points = profile.total_points ?? participant?.total_points ?? 0;
  const attendedEventsCount = profile.attended_events_count ?? participant?.attended_events_count ?? 0;
  const badges = ((participant?.badges || profile.badges || []) as PublicParticipantBadge[])
    .filter((badge) => badge?.name || badge?.icon);
  const bio = profile.bio || participant?.bio || null;
  const avatarUrl = profile.avatar_url || participant?.avatar_url || null;
  const { data: levelData } = useCommunityLevel(points);

  return (
    <Dialog
      open={!!participant}
      onOpenChange={(open) => {
        if (!open) setAvatarExpanded(false);
        onOpenChange(open);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <div className="px-5 pb-5 pt-6">
          <DialogHeader className="items-center text-center">
            <div className="relative">
              {avatarUrl ? (
                <button
                  type="button"
                  onClick={() => setAvatarExpanded((expanded) => !expanded)}
                  className="group relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={avatarExpanded ? "Riduci avatar" : "Ingrandisci avatar"}
                >
                  <img
                    src={avatarUrl}
                    alt=""
                    className={`${avatarExpanded ? "h-72 w-72 max-w-[72vw]" : "h-28 w-28"} rounded-full object-cover border-4 border-background shadow-md transition-all duration-200`}
                  />
                  <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-border">
                    <ZoomIn className="h-4 w-4" />
                  </span>
                </button>
              ) : (
                <LevelAvatar
                  avatarUrl={null}
                  firstName={firstName}
                  lastName={profile.last_name_initial || undefined}
                  points={points}
                  level={levelData}
                  size="lg"
                  showBadge
                  className="scale-125"
                />
              )}
            </div>
            <div className="space-y-2 pt-2">
              <DialogTitle className="font-display text-2xl">
                {displayName}{age != null ? `, ${age}` : ""}
              </DialogTitle>
              <div className="flex flex-wrap justify-center gap-2">
                <LevelBadgePill level={levelData} />
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-muted/35 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span className="text-[11px] font-body font-semibold">Eventi</span>
              </div>
              <p className="font-display text-xl font-bold text-foreground">{attendedEventsCount}</p>
              <p className="text-[11px] font-body text-muted-foreground">partecipati</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/35 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                <Star className="h-3.5 w-3.5" />
                <span className="text-[11px] font-body font-semibold">Punti</span>
              </div>
              <p className="font-display text-xl font-bold text-foreground">{points}</p>
              <p className="text-[11px] font-body text-muted-foreground">community</p>
            </div>
          </div>

          {bio && (
            <section className="mt-5 space-y-2">
              <h3 className="font-body text-xs font-bold uppercase tracking-wide text-muted-foreground">Bio</h3>
              <p className="whitespace-pre-line text-sm font-body leading-relaxed text-foreground/90">{bio}</p>
            </section>
          )}

          {badges.length > 0 && (
            <section className="mt-5 space-y-2">
              <h3 className="font-body text-xs font-bold uppercase tracking-wide text-muted-foreground">Badge</h3>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge, index) => (
                  <span
                    key={`${badge.name || badge.icon}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-body font-semibold text-primary"
                  >
                    <BadgeIcon icon={badge.icon || "Sparkles"} className="h-3.5 w-3.5" />
                    {badge.name || "Badge"}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Main page ---
const EventParticipants = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: event, isLoading: eventLoading } = useEvent(id!);
  const { data: participants, isLoading: participantsLoading } = useEventParticipants(id!);
  const [selectedParticipant, setSelectedParticipant] = useState<any | null>(null);

  const visibleParticipants = useMemo(() => {
    return participants || [];
  }, [participants]);

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
    return ((publicAvatars || []) as any[]);
  }, [publicAvatars]);

  const totalParticipants = Math.max(
    event?.spots_taken || 0,
    visibleParticipants.length,
    visiblePublicAvatars.length
  );

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
    const renderList = [
      ...visiblePublicAvatars,
      ...Array.from({ length: Math.max(totalParticipants - visiblePublicAvatars.length, 0) }),
    ];

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

  // --- Logged in: ALL users can see the same public list (no registration gate) ---

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
                const points = p.profiles?.total_points ?? 0;

                return (
                  <ParticipantRowWithLevel
                    key={p.id}
                    avatarUrl={p.profiles?.avatar_url}
                    firstName={p.profiles?.first_name}
                    lastNameInitial={p.profiles?.last_name_initial}
                    points={points}
                    isManual={p.is_manual}
                    manualLevel={p.manual_level}
                    age={p.profiles?.age ?? null}
                    onOpen={() => setSelectedParticipant(p)}
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

      <PublicParticipantProfileDialog
        participant={selectedParticipant}
        onOpenChange={(open) => {
          if (!open) setSelectedParticipant(null);
        }}
      />
    </div>
  );
};

// Wrapper that fetches level for standard user view
const ParticipantRowWithLevel = ({
  avatarUrl,
  firstName,
  lastNameInitial,
  points,
  isManual,
  manualLevel,
  age,
  onOpen,
}: {
  avatarUrl?: string | null;
  firstName?: string;
  lastNameInitial?: string | null;
  points: number;
  isManual?: boolean;
  manualLevel?: string | null;
  age?: number | null;
  onOpen?: () => void;
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
      lastNameInitial={isManual ? null : lastNameInitial}
      points={points}
      level={finalLevel}
      age={age ?? null}
      onOpen={onOpen}
    />
  );
};

export default EventParticipants;
