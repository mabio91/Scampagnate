import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, MapPin, CalendarDays, MessageCircle, Phone, 
  User as UserIcon, Calendar, Route, Mountain, Clock, ChevronRight,
  Lock
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useOrganizerProfile } from "@/hooks/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import OptimizedImage from "@/components/OptimizedImage";
import { DifficultyBadge } from "@/components/events/DifficultyBadge";

const OrganizerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: organizer, isLoading } = useOrganizerProfile(id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="w-24 h-24 rounded-full" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!organizer) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground font-body">Organizer not found</p>
          <Link to="/" className="text-primary font-body mt-2 block">Back to Home</Link>
        </div>
      </AppLayout>
    );
  }

  const { profile, eventCount, events } = organizer;

  return (
    <AppLayout>
      <div className="bg-background pb-20">
        {/* Header/Back Button */}
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors text-foreground"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="max-w-lg mx-auto px-4 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center space-y-4 p-6 rounded-3xl bg-secondary/5 border border-secondary/10 shadow-sm relative overflow-hidden"
          >
            {/* Decoration */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={`${profile.first_name} ${profile.last_name}`} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background shadow-md">
                  <UserIcon className="h-10 w-10 text-primary" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-secondary text-white p-1.5 rounded-full shadow-lg border-2 border-background">
                <Calendar className="h-3 w-3" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {profile?.first_name} {profile?.last_name}
              </h1>
              <div className="flex items-center justify-center gap-1.5 text-secondary font-body font-semibold text-sm">
                <span className="px-2 py-0.5 rounded-full bg-secondary/10 uppercase tracking-wider text-[10px]">
                  Organizer
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span>{eventCount} Events Created</span>
              </div>
            </div>

            {profile?.bio && (
              <p className="text-sm font-body text-muted-foreground leading-relaxed max-w-xs">
                {profile.bio}
              </p>
            )}

            {/* Contact Toggle/Buttons - Only for registered users */}
            <div className="flex gap-3 w-full mt-2">
              {!user ? (
                <Button 
                  onClick={() => navigate("/auth")}
                  className="w-full py-6 rounded-2xl font-bold bg-primary/10 text-primary border-none hover:bg-primary/20"
                >
                  <Lock className="h-4 w-4 mr-2" /> Sign in to contact organizer
                </Button>
              ) : profile?.phone && (
                <>
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
                    className="flex items-center justify-center p-3 rounded-2xl bg-muted text-foreground hover:bg-muted/80 transition-all shadow-sm active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Events List - Only for registered users */}
        <div className="max-w-lg mx-auto px-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-foreground">Organizer's Events</h2>
          </div>

          {!user ? (
            <div className="p-8 text-center bg-muted/30 rounded-3xl border border-dashed border-border/50 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-foreground font-display font-bold">Member-only Content</p>
                <p className="text-muted-foreground font-body text-xs mt-1">Please sign in to view the organizer's upcoming public events.</p>
              </div>
              <Button onClick={() => navigate("/auth")} variant="outline" className="mt-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5">
                Sign In Now
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {events && events.length > 0 ? (
                events.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/event/${event.id}`)}
                    className="group relative flex gap-4 p-3 rounded-2xl bg-muted/40 border border-border/50 hover:bg-muted/60 hover:border-border transition-all cursor-pointer overflow-hidden active:scale-[0.98]"
                  >
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-muted">
                      <OptimizedImage 
                        src={event.image_url} 
                        alt={event.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        width={96} 
                        height={96} 
                      />
                      {event.difficulty && (
                        <div className="absolute top-1 left-1 scale-75 origin-top-left">
                          <DifficultyBadge difficulty={event.difficulty} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 py-1 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <p className="text-[10px] font-body font-bold text-secondary uppercase tracking-tight">
                          {event.category?.name || "Event"}
                        </p>
                        <h3 className="font-display font-bold text-foreground line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-body">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span>{new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
                          <span className="text-muted-foreground/30">•</span>
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <p className="text-sm font-display font-extrabold text-foreground">
                          {Number(event.price) === 0 ? "FREE" : `€${event.price}`}
                        </p>
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-12 text-center bg-muted/20 rounded-3xl border border-dashed border-border/50">
                  <p className="text-muted-foreground font-body text-sm">No public events organized yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default OrganizerProfile;
