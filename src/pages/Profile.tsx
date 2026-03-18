import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive, isMembershipExpired, getMembershipExpiryDate } from "@/lib/membership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, LogOut, Award, Edit3, Check, Camera, CalendarDays, MapPin, Star, CreditCard, Copy } from "lucide-react";
import { BadgeIcon } from "@/components/BadgeIcon";
import { useQuery } from "@tanstack/react-query";
import OptimizedImage from "@/components/OptimizedImage";
import { useCategories } from "@/hooks/useEvents";
import ReportIssueDialog from "@/components/ReportIssueDialog";
import { DifficultyGuideDialog } from "@/components/events/DifficultyGuideDialog";
import { Info } from "lucide-react";
import { ActivityHistory } from "@/components/profile/ActivityHistory";

const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDifficultyGuide, setShowDifficultyGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useCategories();

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast({ title: "Profile photo updated!" });
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const { data: userBadges } = useQuery({
    queryKey: ["user-badges", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pastEvents } = useQuery({
    queryKey: ["past-events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("event_registrations")
        .select("*, events(*, event_categories(name, icon))")
        .eq("user_id", user.id)
        .in("status", ["registered", "paid"])
        .order("created_at", { ascending: false });

      const now = new Date();
      return (data || []).filter((r: any) => new Date(r.events?.date) < now);
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Profile</h1>
          <p className="text-muted-foreground font-body text-sm mb-4">Sign in to view your profile.</p>
          <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground font-body">Sign In</Button>
        </div>
      </AppLayout>
    );
  }

  const startEditing = () => {
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
    setPhone(profile?.phone || "");
    setBio(profile?.bio || "");
    const prefs = (profile as any)?.preferences;
    setSelectedPreferences(Array.isArray(prefs) ? prefs : []);
    setEditing(true);
  };

  const togglePreference = (categoryName: string) => {
    setSelectedPreferences((prev) =>
      prev.includes(categoryName) ? prev.filter((p) => p !== categoryName) : [...prev, categoryName]
    );
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: firstName,
      last_name: lastName,
      phone,
      bio,
      preferences: selectedPreferences as any,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profile updated!" });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const currentPreferences = Array.isArray((profile as any)?.preferences) ? (profile as any).preferences : [];

  return (
    <AppLayout>
      <div className="px-4 py-4">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAvatar(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden group"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" loading="eager" />
            ) : (
              <span className="text-2xl font-display font-bold text-primary">
                {profile?.first_name?.[0] || "?"}{profile?.last_name?.[0] || ""}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-5 w-5 text-white" />
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-foreground">
              {profile?.first_name} {profile?.last_name}
            </h1>
            <p className="text-sm font-body text-muted-foreground">{user.email}</p>
            <p className="text-xs font-body text-secondary mt-0.5">
              <Star className="h-3 w-3 inline mr-1" />{profile?.total_points || 0} points
            </p>
          </div>
          <button onClick={editing ? saveProfile : startEditing} disabled={saving} className="p-2 rounded-full hover:bg-muted transition-colors">
            {editing ? <Check className="h-5 w-5 text-success" /> : <Edit3 className="h-5 w-5 text-muted-foreground" />}
          </button>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="space-y-3 mb-6 p-4 rounded-xl bg-card">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="font-body text-xs">Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1" rows={2} />
            </div>

            {/* Category Preferences - category names stay Italian */}
            {categories && categories.length > 0 && (
              <div>
                <Label className="font-body text-xs">Category Preferences</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.map((cat: any) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => togglePreference(cat.name)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-colors ${
                        selectedPreferences.includes(cat.name)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preferences display (when not editing) */}
        {!editing && currentPreferences.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-lg font-bold text-foreground mb-2">Preferences</h2>
            <div className="flex flex-wrap gap-2">
              {currentPreferences.map((pref: string) => (
                <span key={pref} className="px-3 py-1.5 rounded-full text-xs font-body font-semibold bg-primary/10 text-primary">
                  {pref}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Membership Status Card */}
        <div className="mb-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-secondary" /> Membership
          </h2>
          <div className={`p-4 rounded-2xl border ${
            isMembershipActive(profile) 
              ? 'bg-primary/5 border-primary/20' 
              : isMembershipExpired(profile)
                ? 'bg-warning/5 border-warning/20'
                : 'bg-muted/50 border-border/50'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-body text-muted-foreground uppercase tracking-wider font-bold">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isMembershipActive(profile) ? 'bg-success animate-pulse' : isMembershipExpired(profile) ? 'bg-warning' : 'bg-muted-foreground'
                  }`} />
                  <span className={`text-sm font-display font-bold ${
                    isMembershipActive(profile) ? 'text-success' : isMembershipExpired(profile) ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    {isMembershipActive(profile) ? 'Active Member' : isMembershipExpired(profile) ? `Expired` : 'Inactive Member'}
                  </span>
                </div>
              </div>
              {profile?.membership_id && (
                <div className="text-right">
                  <p className="text-xs font-body text-muted-foreground uppercase tracking-wider font-bold">Member ID</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(profile.membership_id));
                      toast({ title: "Copied!", description: `Member ID #${profile.membership_id} copied to clipboard.` });
                    }}
                    className="flex items-center gap-1.5 mt-0.5 group cursor-pointer"
                    title="Copy Member ID"
                  >
                    <p className="text-lg font-display font-bold text-foreground">#{profile.membership_id}</p>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                </div>
              )}
            </div>

            {isMembershipActive(profile) ? (
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-primary/10">
                <div>
                  <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Member Since</p>
                  <p className="text-sm font-body font-semibold text-foreground">
                    {(() => {
                      const dateStr = profile.membership_registration_date || (profile as any).created_at;
                      return dateStr 
                        ? new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) 
                        : 'N/A';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Valid Until</p>
                  <p className="text-sm font-body font-semibold text-foreground">
                    {(() => {
                      const expiry = getMembershipExpiryDate(profile);
                      return expiry ? expiry.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A';
                    })()}
                  </p>
                </div>
              </div>
            ) : isMembershipExpired(profile) ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-body text-warning font-semibold">
                  Your membership has expired. Renew to continue joining events.
                </p>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-warning/10">
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Member Since</p>
                    <p className="text-sm font-body font-semibold text-foreground">
                      {(() => {
                        const dateStr = profile?.membership_registration_date || (profile as any)?.created_at;
                        return dateStr 
                          ? new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) 
                          : 'N/A';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Member ID</p>
                    <p className="text-sm font-body font-semibold text-foreground">#{profile?.membership_id}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs font-body text-muted-foreground mt-3">
                Join your first event to activate your annual membership and receive your unique ID!
              </p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="mb-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-secondary" /> Badges
          </h2>

          {/* Scampagnatore Ufficiale highlight */}
          {userBadges?.some((ub: any) => ub.badges?.name === "Scampagnatore Ufficiale") && (
            <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
              <BadgeIcon icon="🏅" className="h-7 w-7 text-primary" />
              <div>
                <p className="text-sm font-display font-bold text-primary">Scampagnatore Ufficiale</p>
                <p className="text-[10px] font-body text-muted-foreground">Membro ufficiale della community</p>
              </div>
            </div>
          )}

          {/* Badge progression */}
          <BadgeProgression attendedCount={profile?.total_points || 0} earnedBadges={userBadges || []} />

          {/* All earned badges */}
          {userBadges && userBadges.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {userBadges.filter((ub: any) => ub.badges?.name !== "Scampagnatore Ufficiale").map((ub: any) => (
                <div key={ub.id} className="p-3 rounded-xl bg-card text-center">
                  <BadgeIcon icon={ub.badges?.icon || ""} className="h-6 w-6 mx-auto text-primary" />
                  <p className="text-sm font-body font-semibold text-foreground mt-1">{ub.badges?.name}</p>
                  <p className="text-[10px] font-body text-muted-foreground">{ub.badges?.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-body text-muted-foreground mt-2">
              Join events to earn badges!
            </p>
          )}
        </div>

        {/* Activity History Dashboard */}
        <ActivityHistory />

        {/* Past Events */}
        <div className="mb-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-secondary" /> Past Events
          </h2>
          {pastEvents && pastEvents.length > 0 ? (
            <div className="space-y-2">
              {pastEvents.map((r: any) => (
                <PastEventCard key={r.id} registration={r} />
              ))}
            </div>
          ) : (
            <p className="text-sm font-body text-muted-foreground">
              No past events yet. Join your first event!
            </p>
          )}
        </div>

        {/* Help & Information */}
        <div className="mb-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">Help & Information</h2>
          <Button 
            variant="outline" 
            onClick={() => setShowDifficultyGuide(true)} 
            className="w-full justify-start font-body font-semibold h-12"
          >
            <Info className="h-5 w-5 mr-3 text-secondary" />
            Trekking Difficulty Guide
          </Button>
          <ReportIssueDialog />
        </div>

        {/* Sign out */}
        <Button onClick={handleSignOut} variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 font-body mb-8">
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>
      <DifficultyGuideDialog 
        open={showDifficultyGuide} 
        onOpenChange={setShowDifficultyGuide} 
      />
    </AppLayout>
  );
};

const PROGRESSION_BADGES = [
  { name: "Nuovo Arrivato", icon: "🌱", required: 1 },
  { name: "Scampagnatore", icon: "🥾", required: 3 },
  { name: "Esploratore", icon: "🗺", required: 5 },
  { name: "Avventuriero", icon: "⛰", required: 10 },
  { name: "Veterano delle Scampagnate", icon: "🏆", required: 20 },
  { name: "Leggenda delle Scampagnate", icon: "👑", required: 50 },
];

const BadgeProgression = ({ attendedCount, earnedBadges }: { attendedCount: number; earnedBadges: any[] }) => {
  const earnedNames = new Set(earnedBadges.map((ub: any) => ub.badges?.name));
  const nextBadge = PROGRESSION_BADGES.find((b) => !earnedNames.has(b.name));

  if (!nextBadge) return null;

  const prevRequired = PROGRESSION_BADGES.filter((b) => b.required < nextBadge.required).pop()?.required || 0;
  const progress = Math.min(100, Math.round(((attendedCount - prevRequired) / (nextBadge.required - prevRequired)) * 100));

  return (
    <div className="p-3 rounded-xl bg-muted/50 flex items-center gap-3">
      <BadgeIcon icon={nextBadge.icon} className="h-6 w-6 text-muted-foreground/40" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-body text-muted-foreground">Next badge</p>
        <p className="text-sm font-body font-semibold text-foreground">{nextBadge.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground font-body">{attendedCount}/{nextBadge.required}</span>
        </div>
      </div>
    </div>
  );
};

const PastEventCard = ({ registration }: { registration: any }) => {
  const event = registration.events;
  if (!event) return null;

  return (
    <Link to={`/event/${event.id}`} className="block">
      <div className="flex gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-colors">
        <OptimizedImage src={event.image_url} alt={event.title} width={64} height={64} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-muted" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm font-bold text-foreground truncate">{event.title}</h3>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-xs font-body">
            <CalendarDays className="h-3 w-3" />
            {new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground text-xs font-body">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default Profile;
