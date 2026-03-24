import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, User as UserIcon } from "lucide-react";
import { useEvent, useEventParticipants } from "@/hooks/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const EventParticipants = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { data: event, isLoading: eventLoading } = useEvent(id!);
  const { data: participants, isLoading: participantsLoading } = useEventParticipants(id!);

  const { data: organizerProfile } = useQuery({
    queryKey: ["organizer-profile-public", event?.organizer_id],
    queryFn: async () => {
      if (!event?.organizer_id) return null;
      const { data } = await supabase.rpc("get_public_profile", { profile_id: event.organizer_id });
      return data?.[0] || null;
    },
    enabled: !!event?.organizer_id,
  });

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
              {participants.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                      {p.profiles?.first_name?.[0] || "?"}
                    </span>
                  )}
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
                </div>
              ))}
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
