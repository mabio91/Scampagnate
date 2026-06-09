import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Info, Phone, MessageCircle, User as UserIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEvent, useEventStaff } from "@/hooks/useEvents";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StaffContact = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  profileId: string | null;
  phone: string | null;
  totalPoints: number;
  instagramHandle: string | null;
};

const normalizePhone = (phone: string) => phone.replace(/[^0-9+]/g, "");
const staffRowClass =
  "-mx-2 w-[calc(100%+1rem)] min-h-16 px-2 flex items-center gap-3 text-left rounded-lg transition-colors active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

const StaffAvatar = ({ avatarUrl, name, className = "w-12 h-12", textClassName = "text-sm" }: {
  avatarUrl?: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}) => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`${className} rounded-full object-cover`} />;
  }

  return (
    <span className={`${className} rounded-full bg-primary/15 flex items-center justify-center font-bold text-primary ${textClassName}`}>
      {name.trim()[0] || "?"}
    </span>
  );
};

const EventStaff = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: event, isLoading: eventLoading } = useEvent(id!);
  const { data: staff, isLoading: staffLoading } = useEventStaff(id!);
  const [selectedContact, setSelectedContact] = useState<StaffContact | null>(null);

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
        total_points: pub?.total_points ?? 0,
        instagram_handle: pub?.instagram_handle || null,
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
  const organizerContact: StaffContact = {
    id: event.organizer_id || "organizer",
    name: organizerName,
    role: "Organizzatore",
    avatarUrl: organizerProfile?.avatar_url || null,
    profileId: event.organizer_id || null,
    phone: organizerProfile?.phone || null,
    totalPoints: organizerProfile?.total_points ?? 0,
    instagramHandle: organizerProfile?.instagram_handle || null,
  };
  const normalizedStaff: StaffContact[] = (staff || []).map((member) => ({
    id: member.id,
    name: member.profile?.first_name || member.display_name,
    role: member.role_label || "Staff",
    avatarUrl: member.profile?.avatar_url || member.avatar_url || null,
    profileId: member.profile_id || null,
    phone: member.profile?.phone || null,
    totalPoints: member.profile?.total_points ?? 0,
    instagramHandle: member.profile?.instagram_handle || null,
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
        <button
          type="button"
          onClick={() => setSelectedContact(organizerContact)}
          className={staffRowClass}
        >
          <StaffAvatar avatarUrl={organizerProfile?.avatar_url} name={organizerName} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground truncate">{organizerName}</p>
            <p className="text-xs font-body text-muted-foreground">Organizzatore</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {normalizedStaff.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-body font-semibold text-primary uppercase tracking-wide mb-3">Staff presente</p>
            {normalizedStaff.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedContact(member)}
                className={`${staffRowClass} border-b border-border/50 last:border-b-0`}
              >
                <StaffAvatar avatarUrl={member.avatarUrl} name={member.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground truncate">{member.name}</p>
                  <p className="text-xs font-body text-muted-foreground">{member.role}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        {selectedContact && (
          <DialogContent className="max-w-[calc(100vw-2rem)] overflow-visible pt-6 sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="font-display text-center">{selectedContact.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <StaffAvatar
                avatarUrl={selectedContact.avatarUrl}
                name={selectedContact.name}
                className="w-24 h-24"
                textClassName="text-3xl"
              />
              <p className="text-xs font-body font-semibold uppercase tracking-wide text-muted-foreground">
                {selectedContact.role}
              </p>
            </div>
            <div className="space-y-2">
              {selectedContact.profileId && (
                <Button
                  variant="outline"
                  className="w-full justify-start font-body"
                  onClick={() => {
                    const profileId = selectedContact.profileId;
                    setSelectedContact(null);
                    navigate(`/organizer/${profileId}`, { state: { role: selectedContact.role } });
                  }}
                >
                  <UserIcon className="h-4 w-4 mr-3" /> Profilo
                </Button>
              )}

              {selectedContact.phone && (
                <>
                  <Button variant="outline" asChild className="w-full justify-start font-body">
                    <a
                      href={`https://wa.me/${normalizePhone(selectedContact.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4 mr-3" /> WhatsApp
                    </a>
                  </Button>
                  <Button variant="outline" asChild className="w-full justify-start font-body">
                    <a href={`tel:${selectedContact.phone}`}>
                      <Phone className="h-4 w-4 mr-3" /> Telefona
                    </a>
                  </Button>
                </>
              )}

              {!selectedContact.profileId && !selectedContact.phone && (
                <p className="flex items-center justify-center gap-2 rounded-xl bg-muted/50 px-3 py-3 text-center text-xs font-body text-muted-foreground">
                  <Info className="h-4 w-4" />
                  Nessuna azione disponibile per questo membro dello staff.
                </p>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default EventStaff;
