import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Mail, Lock, Link2, Eye, EyeOff, Loader2, CheckCircle2, ChevronRight, Settings } from "lucide-react";
import LevelAvatar from "@/components/LevelAvatar";

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileEditSheet = ({ open, onOpenChange }: ProfileEditSheetProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Email dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Google
  const [googleLoading, setGoogleLoading] = useState(false);

  const isGoogleLinked = user?.app_metadata?.providers?.includes("google") ||
    user?.identities?.some((i) => i.provider === "google");
  const isEmailProvider = user?.app_metadata?.providers?.includes("email") ||
    user?.identities?.some((i) => i.provider === "email");

  const initFields = () => {
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
    setPhone(profile?.phone || "");
    setBio(profile?.bio || "");
    setHasChanges(false);
  };

  const handleOpenChange = (val: boolean) => {
    if (val) initFields();
    onOpenChange(val);
  };

  useEffect(() => {
    if (open && profile && !hasChanges) {
      initFields();
    }
  }, [open, profile?.first_name, profile?.last_name, profile?.phone, profile?.bio, hasChanges]);

  const markChanged = () => setHasChanges(true);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast({ title: "Foto profilo aggiornata" });
    } catch (err: any) {
      toast({ title: "Errore upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: firstName,
      last_name: lastName,
      phone,
      bio,
      updated_at: new Date().toISOString(),
    }).eq("id", user!.id);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profilo aggiornato" });
      setHasChanges(false);
    }
    setSaving(false);
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast({ title: "Email di conferma inviata", description: "Controlla la tua nuova casella email per confermare il cambio." });
      setShowEmailDialog(false);
      setNewEmail("");
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Errore", description: "La password deve avere almeno 6 caratteri.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Errore", description: "Le password non corrispondono.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password aggiornata", description: "La tua password è stata cambiata con successo." });
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: window.location.origin + "/profile" },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto pb-safe">
          <SheetHeader className="pb-4">
            <SheetTitle className="font-display text-lg">Modifica profilo</SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* PROFILE SECTION */}
            <div>
              <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-3">Profilo</p>

              {/* Avatar */}
              <div className="flex justify-center mb-4">
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
                  className="relative group"
                >
                  <LevelAvatar
                    avatarUrl={profile?.avatar_url}
                    firstName={profile?.first_name}
                    lastName={profile?.last_name}
                    points={profile?.total_points || 0}
                    size="lg"
                    showBadge
                  />
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-body text-xs">Nome</Label>
                    <Input value={firstName} onChange={(e) => { setFirstName(e.target.value); markChanged(); }} className="mt-1" />
                  </div>
                  <div>
                    <Label className="font-body text-xs">Cognome</Label>
                    <Input value={lastName} onChange={(e) => { setLastName(e.target.value); markChanged(); }} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="font-body text-xs">Telefono</Label>
                  <Input value={phone} onChange={(e) => { setPhone(e.target.value); markChanged(); }} className="mt-1" />
                </div>
                <div>
                  <Label className="font-body text-xs">Bio</Label>
                  <Textarea value={bio} onChange={(e) => { setBio(e.target.value); markChanged(); }} className="mt-1" rows={2} placeholder="Parlaci di te..." />
                </div>
                {hasChanges && (
                  <Button onClick={saveProfile} disabled={saving} className="w-full bg-primary text-primary-foreground font-body font-semibold">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Salva modifiche
                  </Button>
                )}
              </div>
            </div>

            {/* PREFERENCES SECTION */}
            <div>
              <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-3">Preferenze</p>
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate("/profile-setup?mode=edit");
                }}
                className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left"
              >
                <Settings className="h-[18px] w-[18px] text-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground">Modifica preferenze</p>
                  <p className="text-xs font-body text-muted-foreground">Livello, interessi, auto, frequenza</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </div>

            {/* ACCOUNT SECTION */}
            <div>
              <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-3">Account</p>
              <div className="space-y-1">
                {/* Change Email */}
                <button
                  onClick={() => setShowEmailDialog(true)}
                  className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left"
                >
                  <Mail className="h-[18px] w-[18px] text-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-semibold text-foreground">Cambia email</p>
                    <p className="text-xs font-body text-muted-foreground truncate">{user.email}</p>
                  </div>
                </button>

                {/* Change Password */}
                {isEmailProvider && (
                  <button
                    onClick={() => setShowPasswordDialog(true)}
                    className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left"
                  >
                    <Lock className="h-[18px] w-[18px] text-secondary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-semibold text-foreground">Cambia password</p>
                      <p className="text-xs font-body text-muted-foreground">Aggiorna la tua password di accesso</p>
                    </div>
                  </button>
                )}

                {/* Link Google */}
                <button
                  onClick={isGoogleLinked ? undefined : handleLinkGoogle}
                  disabled={isGoogleLinked || googleLoading}
                  className={`flex items-center gap-3 py-3 px-1 rounded-lg transition-colors group w-full text-left ${
                    isGoogleLinked ? "opacity-70 cursor-default" : "hover:bg-muted/50"
                  }`}
                >
                  <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24">
                    <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                    <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                    <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                    <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-semibold text-foreground">
                      {isGoogleLinked ? "Google collegato" : "Collega account Google"}
                    </p>
                    <p className="text-xs font-body text-muted-foreground">
                      {isGoogleLinked ? "Il tuo account Google è già collegato" : "Accedi anche con Google"}
                    </p>
                  </div>
                  {isGoogleLinked && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                  {googleLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Change Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Cambia email</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Inserisci il nuovo indirizzo email. Riceverai un'email di conferma su entrambi gli indirizzi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="font-body text-xs text-muted-foreground">Email attuale</Label>
              <p className="text-sm font-body font-medium text-foreground mt-0.5">{user.email}</p>
            </div>
            <div>
              <Label htmlFor="newEmail" className="font-body text-xs">Nuova email</Label>
              <Input id="newEmail" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nuova@email.com" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} className="font-body">Annulla</Button>
            <Button onClick={handleChangeEmail} disabled={emailLoading || !newEmail.trim()} className="bg-primary text-primary-foreground font-body">
              {emailLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Cambia password</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Inserisci una nuova password. Deve contenere almeno 6 caratteri.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="newPassword" className="font-body text-xs">Nuova password</Label>
              <div className="relative mt-1">
                <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="font-body text-xs">Conferma password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="mt-1" />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive font-body mt-1 flex items-center gap-1">
                  Le password non corrispondono
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} className="font-body">Annulla</Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading || !newPassword || newPassword !== confirmPassword} className="bg-primary text-primary-foreground font-body">
              {passwordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Aggiorna password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileEditSheet;
