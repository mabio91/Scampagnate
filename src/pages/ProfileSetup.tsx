import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Info, Check, ChevronLeft, ArrowRight, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const calculateExperienceGrade = (trekking: string, activity: string) => {
  const map: Record<string, Record<string, number>> = {
    "0_2": { low: 1, medium: 1, high: 2 },
    "3_5": { low: 2, medium: 3, high: 4 },
    "5_plus": { low: 3, medium: 4, high: 5 },
  };
  return map[trekking]?.[activity] ?? 1;
};

interface SelectionCardProps {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  description?: string;
}

const SelectionCard = ({ selected, onClick, emoji, label, description }: SelectionCardProps) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`relative flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-200 ${
      selected
        ? "border-primary bg-primary/10 shadow-sm"
        : "border-border bg-card hover:border-primary/30"
    }`}
  >
    <span className="text-xl shrink-0">{emoji}</span>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{label}</p>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <AnimatePresence>
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <Check className="h-3 w-3 text-primary-foreground" />
        </motion.div>
      )}
    </AnimatePresence>
  </motion.button>
);

interface InterestCardProps {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  disabled: boolean;
}

const InterestCard = ({ selected, onClick, emoji, label, disabled }: InterestCardProps) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    disabled={disabled && !selected}
    className={`relative flex flex-col items-center justify-center text-center gap-1.5 px-3 py-3.5 rounded-xl border-2 transition-all duration-200 ${
      selected
        ? "border-primary bg-primary/10"
        : disabled
        ? "border-border bg-muted opacity-50 cursor-not-allowed"
        : "border-border bg-card hover:border-primary/30"
    }`}
  >
    <span className="text-lg">{emoji}</span>
    <span className={`text-xs font-medium leading-tight w-full text-center ${selected ? "text-primary" : "text-foreground"}`}>{label}</span>
    {selected && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute top-1.5 right-1.5 shrink-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
      >
        <Check className="h-2.5 w-2.5 text-primary-foreground" />
      </motion.div>
    )}
  </motion.button>
);

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

const ProfileSetup = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carSectionRef = useRef<HTMLDivElement>(null);
  const interestsSectionRef = useRef<HTMLDivElement>(null);
  const [step3Errors, setStep3Errors] = useState<{ car?: boolean; interests?: boolean }>({});
  const [searchParams] = useSearchParams();

  // Edit mode: when user already completed onboarding and is editing preferences
  const isEditMode = searchParams.get("mode") === "edit";

  // In edit mode, start at step 2 (skip profile basics) and skip step 1
  const startStep = isEditMode ? 2 : 1;
  const totalSteps = isEditMode ? 2 : 3; // steps 2-3 in edit mode

  const [step, setStep] = useState(startStep);
  const [direction, setDirection] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Step 1 (only in first-time mode)
  const [phone, setPhone] = useState(profile?.phone || "");

  // Step 2 - prefill from profile in edit mode
  const [trekkingExp, setTrekkingExp] = useState(isEditMode ? (profile?.trekking_experience || "") : "");
  const [selfLevel, setSelfLevel] = useState(isEditMode ? (profile?.self_level || "") : "");
  const [activityFreq, setActivityFreq] = useState(isEditMode ? (profile?.activity_frequency || "") : "");

  // Step 3 - prefill from profile in edit mode
  const [hasCar, setHasCar] = useState(isEditMode ? (profile?.has_car || "") : "");
  const [interests, setInterests] = useState<string[]>(
    isEditMode && profile?.interests ? (profile.interests as string[]) : []
  );
  const [eventMotivation, setEventMotivation] = useState(
    isEditMode ? (profile?.event_motivation || "") : ""
  );

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // BUG 1 fix: Always scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [step]);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => s + 1);
    setTimeout(scrollToTop, 50);
  }, [scrollToTop]);

  const goBack = useCallback(() => {
    if (isEditMode && step === 2) {
      navigate(-1);
      return;
    }
    setDirection(-1);
    setStep((s) => s - 1);
    setTimeout(scrollToTop, 50);
  }, [isEditMode, step, navigate, scrollToTop]);

  const toggleInterest = (val: string) => {
    setInterests((prev) =>
      prev.includes(val) ? prev.filter((i) => i !== val) : prev.length < 3 ? [...prev, val] : prev
    );
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file || !user) return;
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast({ title: "Foto aggiornata!" });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const validateStep3 = useCallback(() => {
    const errors: { car?: boolean; interests?: boolean } = {};
    if (!hasCar) errors.car = true;
    if (interests.length < 1) errors.interests = true;
    setStep3Errors(errors);
    if (errors.car) {
      carSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (errors.interests) {
      interestsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }, [hasCar, interests]);

  // Clear errors when user selects values
  useEffect(() => {
    if (hasCar && step3Errors.car) setStep3Errors(prev => ({ ...prev, car: false }));
  }, [hasCar]);
  useEffect(() => {
    if (interests.length >= 1 && step3Errors.interests) setStep3Errors(prev => ({ ...prev, interests: false }));
  }, [interests]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep3()) return;
    setSaving(true);
    try {
      const grade = calculateExperienceGrade(trekkingExp, activityFreq);
      const updateData: Record<string, any> = {
        trekking_experience: trekkingExp,
        activity_frequency: activityFreq,
        experience_grade: grade,
        self_level: selfLevel,
        has_car: hasCar,
        interests,
        event_motivation: eventMotivation || null,
        onboarding_completed: true,
      };

      // Only update phone in first-time mode
      if (!isEditMode) {
        updateData.phone = phone.trim();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData as any)
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();

      if (isEditMode) {
        toast({ title: "Preferenze aggiornate!" });
        navigate("/profile", { replace: true });
      } else {
        setShowSuccess(true);
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isValidPhone = (p: string) => {
    const cleaned = p.trim();
    if (cleaned.length < 5) return false;
    if (/[a-zA-Z]/.test(cleaned)) return false;
    return /^\+?[\d\s\-().]{5,20}$/.test(cleaned);
  };
  const step1Valid = isValidPhone(phone);
  const step2Valid = !!trekkingExp && !!selfLevel && !!activityFreq;
  const step3Valid = !!hasCar && interests.length >= 1;

  if (!user || !profile) return null;

  if (showSuccess) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-center space-y-6 max-w-sm"
        >
          <motion.div
            initial={{ rotate: -20 }}
            animate={{ rotate: 0 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <PartyPopper className="h-16 w-16 mx-auto text-primary" />
          </motion.div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">Perfetto!</h1>
            <p className="text-muted-foreground font-body">
              Abbiamo selezionato alcuni eventi in base al tuo profilo.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full h-12 font-body font-semibold text-base"
            onClick={() => navigate("/", { replace: true })}
          >
            Scoprili
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  const currentStepLabel = step === 1 ? "Profilo base" : step === 2 ? "Esperienza" : "Preferenze";
  const progressValue = isEditMode
    ? ((step - 1) / totalSteps) * 100
    : (step / totalSteps) * 100;
  const stepDisplay = isEditMode ? `Step ${step - 1} di ${totalSteps}` : `Step ${step} di ${totalSteps}`;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
      {/* Progress header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <p className="text-sm font-semibold text-foreground font-body">{stepDisplay}</p>
          <p className="text-xs text-muted-foreground font-body">
            {isEditMode ? "Modifica preferenze" : currentStepLabel}
          </p>
        </div>
        <Progress value={progressValue} className="h-1.5 max-w-md mx-auto" />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 overflow-hidden">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && !isEditMode && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "tween", duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h1 className="font-display text-2xl font-bold text-foreground">Partiamo da te</h1>
                  <p className="text-sm text-muted-foreground font-body">
                    Ci servono 30 secondi per consigliarti gli eventi giusti e garantirti esperienze sicure.
                  </p>
                </div>

                {/* Avatar */}
                <div className="flex flex-col items-center py-2">
                  <div className="relative mb-2">
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold overflow-hidden border-2 border-background shadow-md">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        profile.first_name?.[0] || "?"
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                  <p className="text-xs text-muted-foreground font-body">Carica una foto profilo (opzionale)</p>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="font-body text-sm font-semibold">
                    Numero di telefono <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/[a-zA-Z]/.test(val)) return;
                      setPhone(val);
                    }}
                    placeholder="+39 333 1234567"
                  />
                  <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-secondary" />
                    <p>
                      Serve per coordinamento eventi e comunicazioni importanti. Non sarà visibile agli altri
                      partecipanti, ma potrà essere utilizzato dagli organizzatori per la gestione dell'evento.
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full h-12 font-body font-semibold text-base"
                  disabled={!step1Valid}
                  onClick={goNext}
                >
                  Continua
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "tween", duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h1 className="font-display text-xl font-bold text-foreground">
                    {isEditMode ? "Esperienza e attività" : "Esperienza e attività"}
                  </h1>
                  <p className="text-sm text-muted-foreground font-body">
                    {isEditMode
                      ? "Aggiorna le tue informazioni per ricevere suggerimenti più accurati."
                      : "Per aiutarci a consigliarti eventi adatti e garantire la sicurezza durante le attività outdoor."}
                  </p>
                </div>

                {/* Hiking experience */}
                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">
                    Quante esperienze di trekking o escursioni hai completato?
                  </Label>
                  <div className="space-y-2">
                    {[
                      { val: "0_2", emoji: "🟢", label: "0–2", desc: "Sto iniziando" },
                      { val: "3_5", emoji: "🟡", label: "3–5", desc: "Ho già fatto qualche uscita" },
                      { val: "5_plus", emoji: "🔵", label: "5+", desc: "Ho esperienza" },
                    ].map((opt) => (
                      <SelectionCard
                        key={opt.val}
                        selected={trekkingExp === opt.val}
                        onClick={() => setTrekkingExp(opt.val)}
                        emoji={opt.emoji}
                        label={opt.label}
                        description={opt.desc}
                      />
                    ))}
                  </div>
                </div>

                {/* Self-perceived level */}
                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">Come ti definiresti?</Label>
                  <div className="space-y-2">
                    {[
                      { val: "beginner", emoji: "🌱", label: "Principiante" },
                      { val: "intermediate", emoji: "🥾", label: "Intermedio" },
                      { val: "advanced", emoji: "💪", label: "Avanzato" },
                    ].map((opt) => (
                      <SelectionCard
                        key={opt.val}
                        selected={selfLevel === opt.val}
                        onClick={() => setSelfLevel(opt.val)}
                        emoji={opt.emoji}
                        label={opt.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Activity frequency */}
                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">Con che frequenza pratichi attività fisica?</Label>
                  <div className="space-y-2">
                    {[
                      { val: "low", emoji: "🌿", label: "Raramente" },
                      { val: "medium", emoji: "🙂", label: "1–2 volte a settimana" },
                      { val: "high", emoji: "💪", label: "Più di 2 volte a settimana" },
                    ].map((opt) => (
                      <SelectionCard
                        key={opt.val}
                        selected={activityFreq === opt.val}
                        onClick={() => setActivityFreq(opt.val)}
                        emoji={opt.emoji}
                        label={opt.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 font-body font-semibold" onClick={goBack}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {isEditMode ? "Annulla" : "Indietro"}
                  </Button>
                  <Button className="flex-1 h-12 font-body font-semibold" disabled={!step2Valid} onClick={goNext}>
                    Continua
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "tween", duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h1 className="font-display text-xl font-bold text-foreground">Le tue preferenze</h1>
                </div>

                {/* Car availability */}
                <div ref={carSectionRef} className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${step3Errors.car ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
                  <Label className={`font-body text-sm font-semibold ${step3Errors.car ? "text-destructive" : ""}`}>Sei automunito? <span className="text-destructive">*</span> {step3Errors.car && <span className="text-destructive text-xs font-normal">— Seleziona un'opzione</span>}</Label>
                  <div className="space-y-2">
                    {[
                      { val: "yes", emoji: "🚗", label: "Sì" },
                      { val: "prefer_not_to_drive", emoji: "🤷", label: "Preferisco non guidare" },
                      { val: "no", emoji: "🚫", label: "No" },
                    ].map((opt) => (
                      <SelectionCard
                        key={opt.val}
                        selected={hasCar === opt.val}
                        onClick={() => setHasCar(opt.val)}
                        emoji={opt.emoji}
                        label={opt.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Interests */}
                <div ref={interestsSectionRef} className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${step3Errors.interests ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
                  <Label className={`font-body text-sm font-semibold ${step3Errors.interests ? "text-destructive" : ""}`}>
                    Quali esperienze ti attirano di più?
                  </Label>
                  <p className="text-xs text-muted-foreground font-body">Seleziona fino a 3 opzioni.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: "trekking", emoji: "🥾", label: "Trekking e camminate" },
                      { val: "aperitivi", emoji: "🌅", label: "Aperitivi e tramonti" },
                      { val: "cene", emoji: "🍷", label: "Cene e momenti conviviali" },
                      { val: "social", emoji: "🎉", label: "Eventi social" },
                      { val: "outdoor", emoji: "🏕️", label: "Esperienze outdoor particolari" },
                      { val: "sport", emoji: "🏃", label: "Sport e movimento" },
                      { val: "serali", emoji: "🌌", label: "Eventi serali" },
                      { val: "avventura", emoji: "🔥", label: "Avventura e sfida" },
                    ].map((opt) => (
                      <InterestCard
                        key={opt.val}
                        selected={interests.includes(opt.val)}
                        onClick={() => toggleInterest(opt.val)}
                        emoji={opt.emoji}
                        label={opt.label}
                        disabled={interests.length >= 3}
                      />
                    ))}
                  </div>
                </div>

                {/* Motivation (optional) */}
                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">
                    Cosa cerchi di più in un evento? <span className="text-muted-foreground font-normal">(opzionale)</span>
                  </Label>
                  <div className="space-y-2">
                    {[
                      { val: "relax", emoji: "😌", label: "Relax" },
                      { val: "socializing", emoji: "🤝", label: "Conoscere persone" },
                      { val: "exercise", emoji: "🏃", label: "Fare movimento" },
                      { val: "explore", emoji: "🗺️", label: "Scoprire posti nuovi" },
                      { val: "challenge", emoji: "🏔️", label: "Mettermi alla prova" },
                    ].map((opt) => (
                      <SelectionCard
                        key={opt.val}
                        selected={eventMotivation === opt.val}
                        onClick={() => setEventMotivation((prev) => (prev === opt.val ? "" : opt.val))}
                        emoji={opt.emoji}
                        label={opt.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pb-4">
                  <Button variant="outline" className="flex-1 h-12 font-body font-semibold" onClick={goBack}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Indietro
                  </Button>
                  <Button
                    className="flex-1 h-12 font-body font-semibold"
                    disabled={!step3Valid || saving}
                    onClick={handleSubmit}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvataggio...
                      </>
                    ) : isEditMode ? (
                      "Salva preferenze"
                    ) : (
                      "Scopri gli eventi per te"
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
