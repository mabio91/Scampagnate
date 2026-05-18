import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { Camera, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, ChevronRight, Settings, HelpCircle, Trash2, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LevelAvatar from "@/components/LevelAvatar";
import { AppleIcon, GoogleIcon } from "@/components/auth/OAuthProviderIcons";
import ImageCropDialog from "@/components/ImageCropDialog";
import { isValidInstagramHandle, normalizeInstagramHandle } from "@/lib/instagram";
import HealthSafetyForm from "@/components/profile/HealthSafetyForm";
import {
  buildHealthSafetyPayload,
  emptyHealthSafetyValue,
  getHealthSafetyValueFromProfile,
  type HealthSafetyErrors,
  type HealthSafetyValue,
  validateHealthSafety,
} from "@/lib/healthSafety";

const HIDE_SOCIAL_AUTH = true;
const DELETE_CONFIRMATION_PHRASE = "CANCELLA IL MIO ACCOUNT";
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Errore imprevisto";

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileEditSheet = ({ open, onOpenChange }: ProfileEditSheetProps) => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const membershipSectionRef = useRef<HTMLDivElement>(null);
  const healthSectionRef = useRef<HTMLDivElement>(null);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [provinceOfBirth, setProvinceOfBirth] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [cityOfResidence, setCityOfResidence] = useState("");
  const [provinceOfResidence, setProvinceOfResidence] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [healthSafety, setHealthSafety] = useState<HealthSafetyValue>(emptyHealthSafetyValue);
  const [healthErrors, setHealthErrors] = useState<HealthSafetyErrors>({});
  const [healthSafetyTouched, setHealthSafetyTouched] = useState(false);

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Social links
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const isGoogleLinked = user?.app_metadata?.providers?.includes("google") ||
    user?.identities?.some((i) => i.provider === "google");
  const isAppleLinked = user?.app_metadata?.providers?.includes("apple") ||
    user?.identities?.some((i) => i.provider === "apple");
  const isEmailProvider = user?.app_metadata?.providers?.includes("email") ||
    user?.identities?.some((i) => i.provider === "email");
  const shouldFocusMembershipSection = searchParams.get("section") === "membership";
  const shouldFocusHealthSection = searchParams.get("section") === "health";
  const returnTo = searchParams.get("returnTo");

  const initFields = () => {
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
    setPhone(profile?.phone || "");
    setInstagramHandle(profile?.instagram_handle || "");
    setDateOfBirth(profile?.birth_date || "");
    setBirthPlace(profile?.birth_place || "");
    setProvinceOfBirth(profile?.province_of_birth || "");
    setResidentialAddress(profile?.residential_address || "");
    setCityOfResidence(profile?.city_of_residence || "");
    setProvinceOfResidence(profile?.province_of_residence || "");
    setBio(profile?.bio || "");
    setHealthSafety(getHealthSafetyValueFromProfile(profile));
    setHealthErrors({});
    setHealthSafetyTouched(false);
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
	  }, [
	    open,
	    profile?.first_name,
	    profile?.last_name,
	    profile?.phone,
	    profile?.instagram_handle,
	    profile?.birth_date,
	    profile?.birth_place,
	    profile?.province_of_birth,
	    profile?.residential_address,
	    profile?.city_of_residence,
	    profile?.province_of_residence,
	    profile?.bio,
	    profile?.health_safety_status,
	    profile?.health_safety_notes,
	    profile?.emergency_medication_has,
	    profile?.emergency_medication_notes,
	    profile?.health_safety_help_notes,
	    hasChanges,
	  ]);

	  useEffect(() => {
	    if (!open || (!shouldFocusMembershipSection && !shouldFocusHealthSection)) return;
	    const timer = window.setTimeout(() => {
	      if (shouldFocusHealthSection) {
	        healthSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	      } else {
	        membershipSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	      }
	    }, 250);
	    return () => window.clearTimeout(timer);
	  }, [open, shouldFocusMembershipSection, shouldFocusHealthSection]);

	  const markChanged = () => setHasChanges(true);

	  const handleHealthSafetyChange = (value: HealthSafetyValue) => {
	    setHealthSafety(value);
	    setHealthSafetyTouched(true);
	    markChanged();
	  };

	  useEffect(() => {
	    if (healthSafety.status && healthErrors.status) setHealthErrors(prev => ({ ...prev, status: false }));
	    if (healthSafety.notes.trim() && healthErrors.notes) setHealthErrors(prev => ({ ...prev, notes: false }));
	    if (healthSafety.emergencyMedicationHas && healthErrors.emergencyMedicationHas) {
	      setHealthErrors(prev => ({ ...prev, emergencyMedicationHas: false }));
	    }
	    if (healthSafety.emergencyMedicationNotes.trim() && healthErrors.emergencyMedicationNotes) {
	      setHealthErrors(prev => ({ ...prev, emergencyMedicationNotes: false }));
	    }
	  }, [healthSafety, healthErrors]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
        cacheControl: "31536000",
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast({ title: "Foto profilo aggiornata" });
    } catch (err: unknown) {
      toast({ title: "Errore upload", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

	  const saveProfile = async () => {
	    setSaving(true);
	    const normalizedInstagramHandle = normalizeInstagramHandle(instagramHandle);
	    if (!isValidInstagramHandle(normalizedInstagramHandle)) {
      toast({
        title: "Instagram non valido",
        description: "Inserisci solo username, @username o link instagram.com/username.",
        variant: "destructive",
      });
	      setSaving(false);
	      return;
	    }

	    const updateData: Record<string, unknown> = {
	      first_name: firstName,
	      last_name: lastName,
	      phone,
	      instagram_handle: normalizedInstagramHandle,
      birth_date: dateOfBirth || null,
      birth_place: birthPlace.trim() || null,
      province_of_birth: provinceOfBirth.trim().toUpperCase() || null,
      residential_address: residentialAddress.trim() || null,
      city_of_residence: cityOfResidence.trim() || null,
	      province_of_residence: provinceOfResidence.trim().toUpperCase() || null,
	      bio,
	      updated_at: new Date().toISOString(),
	    };

	    if (healthSafetyTouched) {
	      const validation = validateHealthSafety(healthSafety);
	      setHealthErrors(validation.errors);
	      if (!validation.isValid) {
	        healthSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	        toast({
	          title: "Completa salute e sicurezza",
	          description: "Controlla i campi obbligatori prima di salvare.",
	          variant: "destructive",
	        });
	        setSaving(false);
	        return;
	      }
	      Object.assign(updateData, buildHealthSafetyPayload(healthSafety));
	    }

	    const { error } = await supabase.from("profiles").update(updateData as any).eq("id", user!.id);
	    if (error) {
	      toast({ title: "Errore", description: error.message, variant: "destructive" });
	    } else {
      await refreshProfile();
      toast({ title: "Profilo aggiornato" });
      setHasChanges(false);
      if (returnTo) {
        onOpenChange(false);
        navigate(returnTo, { replace: true });
	      } else if (shouldFocusMembershipSection || shouldFocusHealthSection) {
	        const params = new URLSearchParams(location.search);
	        params.delete("section");
	        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
      }
    }
    setSaving(false);
  };

  const MembershipLabel = ({ children, tooltip }: { children: string; tooltip?: string }) => (
    <div className="flex items-center gap-1.5">
      <Label className="font-body text-xs">{children}</Label>
      {tooltip && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Aiuto: ${children}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            className="w-[min(18rem,calc(100vw-2rem))] p-3 text-xs leading-relaxed"
          >
            {tooltip}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast({ title: "Email di conferma inviata", description: "Controlla la tua nuova casella email per confermare il cambio." });
      setShowEmailDialog(false);
      setNewEmail("");
    } catch (err: unknown) {
      toast({ title: "Errore", description: getErrorMessage(err), variant: "destructive" });
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
    } catch (err: unknown) {
      toast({ title: "Errore", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim() !== DELETE_CONFIRMATION_PHRASE) {
      toast({
        title: "Conferma non valida",
        description: `Scrivi esattamente: ${DELETE_CONFIRMATION_PHRASE}`,
        variant: "destructive",
      });
      return;
    }

    setDeletingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: DELETE_CONFIRMATION_PHRASE },
      });
      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || "Cancellazione account non riuscita");
      }
      await signOut();
      setDeleteDialogOpen(false);
      onOpenChange(false);
      toast({ title: "Account cancellato", description: "La sessione e stata chiusa." });
      navigate("/");
    } catch (err: unknown) {
      toast({ title: "Errore cancellazione", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDeletingAccount(false);
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
    } catch (err: unknown) {
      toast({ title: "Errore", description: getErrorMessage(err), variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  const handleLinkApple = async () => {
    setAppleLoading(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "apple",
        options: { redirectTo: window.location.origin + "/profile" },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast({ title: "Errore", description: getErrorMessage(err), variant: "destructive" });
      setAppleLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <ImageCropDialog
        open={!!avatarCropFile}
        file={avatarCropFile}
        title="Ritaglia foto profilo"
        aspect={{ width: 1, height: 1 }}
        outputWidth={900}
        outputHeight={900}
        onCancel={() => setAvatarCropFile(null)}
        onCropped={(croppedFile) => {
          setAvatarCropFile(null);
          void uploadAvatar(croppedFile);
        }}
      />
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
                    if (file) setAvatarCropFile(file);
                    e.target.value = "";
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
                  <Label className="font-body text-xs">Instagram</Label>
                  <Input
                    value={instagramHandle}
                    onChange={(e) => { setInstagramHandle(e.target.value); markChanged(); }}
                    className="mt-1"
                    placeholder="@nomeutente"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <p className="mt-1 text-[11px] font-body text-muted-foreground">
                    Visibile solo allo staff e all'organizzatore degli eventi a cui partecipi.
                  </p>
                </div>
                <div>
                  <Label className="font-body text-xs">Bio</Label>
                  <Textarea value={bio} onChange={(e) => { setBio(e.target.value); markChanged(); }} className="mt-1" rows={2} placeholder="Parlaci di te..." />
                </div>
              </div>
            </div>

            {/* MEMBERSHIP DATA SECTION */}
            <div
              ref={membershipSectionRef}
              className={`rounded-xl border p-4 transition-colors ${
                shouldFocusMembershipSection ? "border-primary bg-primary/5" : "border-border bg-muted/20"
              }`}
            >
              <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2">Dati per tesseramento</p>
              <p className="text-xs font-body text-muted-foreground mb-4">
                Questi dati sono richiesti solo per la gestione della tessera associativa della ASD Gruppo Scampagnate.
              </p>
              <div className="space-y-3">
                <div className="min-w-0">
                  <MembershipLabel>Data di nascita</MembershipLabel>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => { setDateOfBirth(e.target.value); markChanged(); }}
                    className="mt-1 max-w-full [min-inline-size:0]"
                  />
                </div>
                <div>
                  <MembershipLabel tooltip={'Inserisci il comune di nascita. Se sei nato/a all\'estero, inserisci il nome della nazione (es. "Francia", "Romania").'}>
                    Luogo di nascita
                  </MembershipLabel>
                  <Input value={birthPlace} onChange={(e) => { setBirthPlace(e.target.value); markChanged(); }} className="mt-1" />
                </div>
                <div>
                  <MembershipLabel tooltip={'Inserisci la sigla della provincia (es. "RM", "MI"). Se sei nato/a all\'estero, scrivi EE.'}>
                    Provincia di nascita
                  </MembershipLabel>
                  <Input value={provinceOfBirth} onChange={(e) => { setProvinceOfBirth(e.target.value); markChanged(); }} className="mt-1 uppercase" maxLength={2} />
                </div>
                <div>
                  <MembershipLabel tooltip={'Inserisci via e numero civico (es. "Via Roma 12").'}>
                    Indirizzo di residenza
                  </MembershipLabel>
                  <Input value={residentialAddress} onChange={(e) => { setResidentialAddress(e.target.value); markChanged(); }} className="mt-1" />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <div className="min-w-0">
                    <MembershipLabel>Città di residenza</MembershipLabel>
                    <Input value={cityOfResidence} onChange={(e) => { setCityOfResidence(e.target.value); markChanged(); }} className="mt-1" />
                  </div>
                  <div className="min-w-0">
                    <MembershipLabel tooltip={'Inserisci la sigla della provincia (es. "RM", "MI"). Se sei residente all\'estero, scrivi EE.'}>
                      Provincia di residenza
                    </MembershipLabel>
                    <Input value={provinceOfResidence} onChange={(e) => { setProvinceOfResidence(e.target.value); markChanged(); }} className="mt-1 uppercase" maxLength={2} />
                  </div>
                </div>
              </div>
	            </div>

	            {/* HEALTH SAFETY SECTION */}
	            <div
	              ref={healthSectionRef}
	              className={`rounded-xl border p-4 transition-colors ${
	                shouldFocusHealthSection ? "border-primary bg-primary/5" : "border-border bg-muted/20"
	              }`}
	            >
	              <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2">Salute e sicurezza</p>
	              <p className="text-xs font-body text-muted-foreground mb-4">
	                Questi dati sono opzionali per il profilo pubblico, ma utili allo staff durante le attività.
	              </p>
	              <HealthSafetyForm
	                value={healthSafety}
	                onChange={handleHealthSafetyChange}
	                errors={healthErrors}
	              />
	            </div>

	            {hasChanges && (
	              <Button onClick={saveProfile} disabled={saving} className="w-full bg-primary text-primary-foreground font-body font-semibold">
	                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salva modifiche
              </Button>
            )}

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
	                  <p className="text-xs font-body text-muted-foreground">Livello, interessi, frequenza</p>
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

                {/* Delete Account */}
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-destructive/5 transition-colors group w-full text-left"
                >
                  <Trash2 className="h-[18px] w-[18px] text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-semibold text-destructive">Cancella account</p>
                    <p className="text-xs font-body text-muted-foreground">Rimuove accesso, dati personali e sessione</p>
                  </div>
                </button>

                {/* Link Google */}
                <button
                  hidden={HIDE_SOCIAL_AUTH}
                  onClick={isGoogleLinked ? undefined : handleLinkGoogle}
                  disabled={isGoogleLinked || googleLoading}
                  className={`flex items-center gap-3 py-3 px-1 rounded-lg transition-colors group w-full text-left ${
                    isGoogleLinked ? "opacity-70 cursor-default" : "hover:bg-muted/50"
                  }`}
                >
                  <GoogleIcon className="h-[18px] w-[18px] shrink-0" />
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

                {/* Link Apple */}
                <button
                  hidden={HIDE_SOCIAL_AUTH}
                  onClick={isAppleLinked ? undefined : handleLinkApple}
                  disabled={isAppleLinked || appleLoading}
                  className={`flex items-center gap-3 py-3 px-1 rounded-lg transition-colors group w-full text-left ${
                    isAppleLinked ? "opacity-70 cursor-default" : "hover:bg-muted/50"
                  }`}
                >
                  <AppleIcon className="h-[18px] w-[18px] shrink-0 text-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-semibold text-foreground">
                      {isAppleLinked ? "Apple collegato" : "Collega account Apple"}
                    </p>
                    <p className="text-xs font-body text-muted-foreground">
                      {isAppleLinked ? "Il tuo account Apple è già collegato" : "Accedi anche con Apple"}
                    </p>
                  </div>
                  {isAppleLinked && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                  {appleLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
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

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Cancella account
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              Questa azione cancella l'accesso e anonimizza i dati personali collegati al profilo. Non puo essere annullata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs font-body text-foreground">
              Per confermare scrivi <span className="font-bold">{DELETE_CONFIRMATION_PHRASE}</span>.
            </div>
            <Input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={DELETE_CONFIRMATION_PHRASE}
              disabled={deletingAccount}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deletingAccount}
              >
                Annulla
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmation.trim() !== DELETE_CONFIRMATION_PHRASE}
              >
                {deletingAccount ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Attendi...</> : "Cancella"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileEditSheet;
