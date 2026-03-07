import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, LogOut, Award, Edit3, Check, Camera } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast({ title: "Foto profilo aggiornata!" });
    } catch (err: any) {
      toast({ title: "Errore upload", description: err.message, variant: "destructive" });
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

  if (!user) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Profilo</h1>
          <p className="text-muted-foreground font-body text-sm mb-4">Accedi per visualizzare il tuo profilo.</p>
          <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground font-body">Accedi</Button>
        </div>
      </AppLayout>
    );
  }

  const startEditing = () => {
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
    setPhone(profile?.phone || "");
    setBio(profile?.bio || "");
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: firstName,
      last_name: lastName,
      phone,
      bio,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profilo aggiornato!" });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
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
              {profile?.total_points || 0} punti
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
                <Label className="font-body text-xs">Nome</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="font-body text-xs">Cognome</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Telefono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="font-body text-xs">Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1" rows={2} />
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="mb-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-secondary" /> Badge
          </h2>
          {userBadges && userBadges.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {userBadges.map((ub: any) => (
                <div key={ub.id} className="p-3 rounded-xl bg-card text-center">
                  <span className="text-2xl">{ub.badges?.icon}</span>
                  <p className="text-sm font-body font-semibold text-foreground mt-1">{ub.badges?.name}</p>
                  <p className="text-[10px] font-body text-muted-foreground">{ub.badges?.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-body text-muted-foreground">
              Partecipa agli eventi per guadagnare badge! 🏆
            </p>
          )}
        </div>

        {/* Sign out */}
        <Button onClick={handleSignOut} variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10 font-body">
          <LogOut className="h-4 w-4 mr-2" /> Esci
        </Button>
      </div>
    </AppLayout>
  );
};

export default Profile;
