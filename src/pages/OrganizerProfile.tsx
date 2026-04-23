import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, CalendarDays, MessageCircle, Phone,
  User as UserIcon, Calendar, Star, Users, ChevronRight, Lock,
  Info, Clock
} from "lucide-react";

import { useOrganizerProfile } from "@/hooks/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import OptimizedImage from "@/components/OptimizedImage";
import { DifficultyBadge } from "@/components/events/DifficultyBadge";
import { CapacityWarning } from "@/components/events/CapacityWarning";

const OrganizerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: organizer, isLoading, error } = useOrganizerProfile(id);

  if (isLoading) {
    return (
      <>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="w-28 h-28 rounded-full" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        </div>
      </>
    );
  }

  if (error || !organizer) {
    return (
      <>
        <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <UserIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-body">Organizer not found</p>
          <Link to="/" className="text-primary font-body block">Back to Home</Link>
        </div>
      </>
    );
  }

  const { profile, eventCount, events } = organizer;
  const fullName = profile?.first_name || "Organizer";
  const upcomingEvents = events?.filter(e => new Date(e.date) >= new Date()) || [];
  const pastEvents = events?.filter(e => new Date(e.date) < new Date()) || [];

  return (
    <>
      <div className="bg-background pb-24">
        {/* Back button */}
        <div className="max-w-lg mx-auto px-4 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-muted transition-colors text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Profile Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg mx-auto px-4 mb-6"
        >
          <div className="relative p-6 rounded-3xl bg-card border border-border/60 shadow-sm overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col items-center text-center gap-4">
              {/* Avatar */}
              <div className="relative">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={fullName}
                    className="w-28 h-28 rounded-full object-cover border-4 border-background shadow-lg"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-4 border-background shadow-md">
                    <UserIcon className="h-12 w-12 text-primary" />
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 bg-secondary text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-background shadow">
                  Organizer
                </span>
              </div>

              {/* Name */}
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">{fullName || "Organizer"}</h1>

                {/* Stats row */}
                <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-body">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span><strong className="text-foreground font-semibold">{eventCount}</strong> events created</span>
                  </div>
                  {upcomingEvents.length > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-body">
                      <Star className="h-3.5 w-3.5 text-secondary" />
                      <span><strong className="text-foreground font-semibold">{upcomingEvents.length}</strong> upcoming</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              {profile?.bio && (
                <p className="text-sm font-body text-muted-foreground leading-relaxed max-w-sm border-t border-border/50 pt-3 w-full text-center whitespace-pre-line">
                  {profile.bio}
                </p>
              )}

              {/* Contact Buttons */}
              <div className="w-full">
                {!user ? (
                  <button
                    onClick={() => navigate("/auth")}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-muted hover:bg-muted/80 text-muted-foreground font-body text-sm font-semibold transition-colors border border-dashed border-border"
                  >
                    <Lock className="h-4 w-4" />
                    Sign in to contact organizer
                  </button>
                ) : profile?.phone ? (
                  <div className="flex gap-2 w-full">
                    <a
                      href={`https://wa.me/${profile.phone.replace(/[^0-9+]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 flex-1 justify-center px-4 py-3 rounded-2xl bg-[#25D366] text-white text-sm font-body font-bold hover:opacity-90 transition-all shadow-md active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary/10 text-primary font-body font-bold text-sm hover:bg-primary/20 transition-all shadow-sm active:scale-95"
                    >
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  </div>
                ) : (
                  <p className="text-xs font-body text-muted-foreground text-center py-2">
                    <Info className="inline h-3 w-3 mr-1" />
                    No contact information available
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Events Section */}
        <div className="max-w-lg mx-auto px-4 space-y-5">
          <h2 className="font-display text-xl font-bold text-foreground">
            Public Events {events && events.length > 0 && (
              <span className="text-muted-foreground font-body text-base font-normal ml-1">({events.length})</span>
            )}
          </h2>

          {!user ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 text-center bg-muted/30 rounded-3xl border border-dashed border-border/50 space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-foreground font-display font-bold">Members Only</p>
                <p className="text-muted-foreground font-body text-xs mt-1">
                  Sign in to see the organizer's upcoming events.
                </p>
              </div>
              <Button onClick={() => navigate("/auth")} variant="outline" className="mt-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5">
                Sign In Now
              </Button>
            </motion.div>
          ) : events && events.length > 0 ? (
            <div className="space-y-3">
              {/* Upcoming */}
              {upcomingEvents.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</p>
                  {upcomingEvents.map((event, index) => (
                    <EventRow key={event.id} event={event} index={index} navigate={navigate} />
                  ))}
                </div>
              )}
              {/* Past */}
              {pastEvents.length > 0 && (
                <div className="space-y-3 mt-4">
                  <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Past Events</p>
                  {pastEvents.map((event, index) => (
                    <EventRow key={event.id} event={event} index={index} navigate={navigate} past />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center bg-muted/20 rounded-3xl border border-dashed border-border/50">
              <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-body text-sm">No public events organized yet.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const EventRow = ({ event, index, navigate, past = false }: { event: any; index: number; navigate: any; past?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.04 }}
    onClick={() => navigate(`/event/${event.id}`)}
    className={`group flex gap-3 p-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
      past
        ? "bg-muted/20 border-border/30 hover:bg-muted/40 opacity-70"
        : "bg-card border-border/50 hover:bg-muted/30 hover:border-border shadow-sm"
    }`}
  >
    <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-muted">
      <OptimizedImage
        src={event.image_url}
        alt={event.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        width={80}
        height={80}
      />
      {event.difficulty && (
        <div className="absolute top-1 left-1 scale-[0.7] origin-top-left">
          <DifficultyBadge difficulty={event.difficulty} showLabel={false} />
        </div>
      )}
    </div>

    <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
      <div>
        <p className="text-[10px] font-body font-bold text-secondary uppercase tracking-wide">
          {event.category?.name || "Event"}
        </p>
        <h3 className="font-display font-bold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-body mt-0.5">
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span>{new Date(event.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
          <span className="text-border">·</span>
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-extrabold text-foreground">
            {Number(event.price) === 0 ? "Free" : `€${event.price}`}
          </span>
          {event.spots_taken !== undefined && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-body">
              <Users className="h-3 w-3" />
              <span>{event.spots_taken}/{event.spots_total}</span>
            </div>
          )}
        </div>
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
      {event.spots_taken !== undefined && (
        <CapacityWarning spotsTaken={event.spots_taken} spotsTotal={event.spots_total} className="mt-0.5" />
      )}
    </div>
  </motion.div>
);

export default OrganizerProfile;
