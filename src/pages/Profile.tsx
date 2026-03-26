import { useState, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive, isMembershipExpired, getMembershipExpiryDate } from "@/lib/membership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, LogOut, Edit3, Check, Camera, Star, CreditCard, Copy, Crown } from "lucide-react";
import ProfileBadges from "@/components/profile/ProfileBadges";
import ProfileCompleteness from "@/components/profile/ProfileCompleteness";
import { useCategories } from "@/hooks/useEvents";
import ReportIssueDialog from "@/components/ReportIssueDialog";
import { DifficultyGuideDialog } from "@/components/events/DifficultyGuideDialog";
import { Info } from "lucide-react";
import { ActivityHistory } from "@/components/profile/ActivityHistory";

const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();
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
      toast({ title: t("profilePhotoUpdated") });
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };


  if (!user) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("profile")}</h1>
          <p className="text-muted-foreground font-body text-sm mb-4">{t("signInToViewProfile")}</p>
          <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground font-body">{t("signIn")}</Button>
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
      toast({ title: t("profileUpdated") });
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
              <Star className="h-3 w-3 inline mr-1" />{profile?.total_points || 0} {t("points")}
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
                <Label className="font-body text-xs">{t("firstName")}</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">{t("lastName")}</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">{t("phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="font-body text-xs">{t("bio")}</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1" rows={2} />
            </div>

            {/* Category Preferences - category names stay Italian */}
            {categories && categories.length > 0 && (
              <div>
                <Label className="font-body text-xs">{t("categoryPreferences")}</Label>
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
            <h2 className="font-display text-lg font-bold text-foreground mb-2">{t("preferences")}</h2>
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
            <CreditCard className="h-5 w-5 text-secondary" /> Tessera
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
                <p className="text-xs font-body text-muted-foreground uppercase tracking-wider font-bold">Stato tessera</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isMembershipActive(profile) ? 'bg-success animate-pulse' : isMembershipExpired(profile) ? 'bg-warning' : 'bg-muted-foreground'
                  }`} />
                  <span className={`text-sm font-display font-bold ${
                    isMembershipActive(profile) ? 'text-success' : isMembershipExpired(profile) ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    {isMembershipActive(profile) ? 'Attiva' : isMembershipExpired(profile) ? 'Scaduta' : 'Non attiva'}
                  </span>
                  {(profile as any)?.is_founding_member && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold uppercase tracking-wider">
                      <Crown className="h-3 w-3" /> Fondatore
                    </span>
                  )}
                </div>
              </div>
              {profile?.membership_id && (
                <div className="text-right">
                  <p className="text-xs font-body text-muted-foreground uppercase tracking-wider font-bold">Tessera N°</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(profile.membership_id));
                      toast({ title: "Copiato!", description: `ID tessera #${profile.membership_id} copiato` });
                    }}
                    className="flex items-center gap-1.5 mt-0.5 group cursor-pointer"
                  >
                    <p className="text-lg font-display font-bold text-foreground">#{profile.membership_id}</p>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                </div>
              )}
            </div>

            {isMembershipActive(profile) ? (
              <>
                {/* Active: show expiry prominently + benefits */}
                <div className="mt-3 p-3 rounded-xl bg-success/10 border border-success/20">
                  <p className="text-sm font-body font-bold text-success">
                    Tessera attiva fino al {(() => {
                      const expiry = getMembershipExpiryDate(profile);
                      return expiry ? expiry.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '31/12/' + new Date().getFullYear();
                    })()}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-primary/10">
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Membro dal</p>
                    <p className="text-sm font-body font-semibold text-foreground">
                      {(() => {
                        const dateStr = profile.membership_registration_date || (profile as any).created_at;
                        return dateStr ? new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/D';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Scadenza</p>
                    <p className="text-sm font-body font-semibold text-foreground">
                      {(() => {
                        const expiry = getMembershipExpiryDate(profile);
                        return expiry ? expiry.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/D';
                      })()}
                    </p>
                  </div>
                </div>
                {/* Benefits */}
                <div className="mt-3 pt-3 border-t border-primary/10">
                  <p className="text-[10px] font-body text-muted-foreground uppercase font-bold mb-1.5">Benefici inclusi</p>
                  <ul className="space-y-1">
                    <li className="text-xs font-body text-foreground flex items-center gap-2">
                      <span className="text-success">✓</span> Copertura assicurativa base durante le attività
                    </li>
                    <li className="text-xs font-body text-foreground flex items-center gap-2">
                      <span className="text-success">✓</span> Accesso a tutti gli eventi della community
                    </li>
                    <li className="text-xs font-body text-foreground flex items-center gap-2">
                      <span className="text-success">✓</span> Prezzi riservati ai soci
                    </li>
                  </ul>
                </div>
              </>
            ) : isMembershipExpired(profile) ? (
              <div className="mt-3 space-y-3">
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <p className="text-sm font-body font-bold text-warning">
                    La tua tessera è scaduta il 31/12/{(profile as any)?.membership_year || new Date().getFullYear() - 1}
                  </p>
                  <p className="text-xs font-body text-muted-foreground mt-1">
                    Rinnova per continuare a partecipare agli eventi
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  Rinnova la tessera
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-body text-muted-foreground">
                  Attiva la tessera per partecipare agli eventi e ottenere la copertura assicurativa.
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  Attiva la tessera
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        <ProfileBadges />

        {/* Activity History Dashboard */}
        <ActivityHistory />


        {/* Help & Information */}
        <div className="mb-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">{t("helpAndInfo")}</h2>
          <Button 
            variant="outline" 
            onClick={() => setShowDifficultyGuide(true)} 
            className="w-full justify-start font-body font-semibold h-12"
          >
            <Info className="h-5 w-5 mr-3 text-secondary" />
            {t("trekkingDifficultyGuide")}
          </Button>
          <ReportIssueDialog />
        </div>

        {/* Sign out */}
        <Button onClick={handleSignOut} variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 font-body mb-8">
          <LogOut className="h-4 w-4 mr-2" /> {t("signOut")}
        </Button>
      </div>
      <DifficultyGuideDialog 
        open={showDifficultyGuide} 
        onOpenChange={setShowDifficultyGuide} 
      />
    </AppLayout>
  );
};


export default Profile;
