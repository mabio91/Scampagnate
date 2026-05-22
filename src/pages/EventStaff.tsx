import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Phone, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEvent, useEventStaff } from "@/hooks/useEvents";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const StaffAvatar = ({ avatarUrl, name }: { avatarUrl?: string | null; name: string }) => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />;
  }

  return (
    <span className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
      {name.trim()[0] || "?"}
    </span>
  );
};

const EventStaff = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: event, isLoading: eventLoading } = useEvent(id!);
  const { data: staff, isLoading: staffLoading } = useEventStaff(id!);

  const { data: organizerProfile } = useQuery({
    queryKey: ["event-staff-organizer-profile", event?.organizer_id],
    queryFn: async () => {
      if (!event?.organizer_id) return null;
      const { data: publicData } = await supabase.rpc("get_public_profile", { profile_id: event.organizer_id });
      const pub = publicData?.[0] || null;
      let phone: string | null = pub?.phone || null;
      if (!phone) {
        const { data: fullData } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", event.organizer_id)
          .single();
        phone = fullData?.phone || null;
      }
      return {
        first_name: pub?.first_name || "",
        avatar_url: pub?.avatar_url || null,
        phone,
      };
    },
    enabled: !!event?.organizer_id,
  });

  if (eventLoading || staffLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 bg-background z-10 px-4 py-3 header-safe-top [--header-safe-offset:0.75rem] min-h-[calc(56px+env(safe-area-inset-top,0px))] flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="px-4 py-4 space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-3">
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

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Evento non trovato</p>
      </div>
    );
  }

  const organizerName = organizerProfile?.first_name || event.organizer_name || "Organizzatore";
  const normalizedStaff = (staff || []).map((member) => ({
    id: member.id,
    name: member.profile?.first_name || member.display_name,
    role: member.role_label || "Staff",
    avatarUrl: member.profile?.avatar_url || member.avatar_url || null,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background z-10 px-4 py-3 header-safe-top [--header-safe-offset:0.75rem] min-h-[calc(56px+env(safe-area-inset-top,0px))] flex items-center gap-3 border-b border-border/60">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="font-display text-lg font-bold text-foreground">Staff evento</h2>
        <span className="ml-auto text-xs font-body text-muted-foreground">
          {normalizedStaff.length + 1} persone
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <p className="text-xs font-body font-semibold text-primary uppercase tracking-wide mb-3">Organizzatore</p>
        <div className="flex items-center gap-3 py-3">
          <StaffAvatar avatarUrl={organizerProfile?.avatar_url} name={organizerName} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground truncate">{organizerName}</p>
            <p className="text-xs font-body text-muted-foreground">Organizzatore</p>
          </div>
          {organizerProfile?.phone && (
            <div className="flex items-center gap-1">
              <a
                href={`https://wa.me/${organizerProfile.phone.replace(/[^0-9+]/g, "")}`}
                className="p-2 rounded-full bg-primary/10 text-primary"
                aria-label="Contatta su WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href={`tel:${organizerProfile.phone}`}
                className="p-2 rounded-full bg-muted text-foreground"
                aria-label="Chiama organizzatore"
              >
                <Phone className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>

        {normalizedStaff.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-body font-semibold text-primary uppercase tracking-wide mb-3">Staff presente</p>
            {normalizedStaff.map((member) => (
              <div key={member.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-b-0">
                <StaffAvatar avatarUrl={member.avatarUrl} name={member.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground truncate">{member.name}</p>
                  <p className="text-xs font-body text-muted-foreground">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventStaff;
