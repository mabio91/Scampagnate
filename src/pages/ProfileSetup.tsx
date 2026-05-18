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
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import {
  FIT_SCORE_INTEREST_MIN,
  FIT_SCORE_INTEREST_MAX,
  FIT_SCORE_INTEREST_VALIDATION_MESSAGE,
} from "@/lib/fitScoreAffinityTables";
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
    className={`relative flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-200 ${selected
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
    className={`relative flex flex-col items-center justify-center text-center gap-1.5 px-3 py-3.5 rounded-xl border-2 transition-all duration-200 ${selected
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

const beautifulConfettiColors = [
  "#FF6B6B", // Vibrant Soft Coral
  "#4ECDC4", // Electric Teal
  "#FFE66D", // Champagne Yellow
  "#FF9F1C", // Vibrant Orange
  "#CB9CF2", // Bright Lavender
  "#FF99C8", // Bubblegum Pink
  "#A3CEF1", // Sky Blue
  "#80ED99", // Vivid Mint
];

const successConfettiPieces = Array.from({ length: 32 }, (_, index) => {
  const delay = (index % 8) * 1.2;
  const duration = 7 + (index % 5) * 2;
  const left = 3 + ((index * 23) % 94);
  const driftX = (index % 2 === 0 ? 1 : -1) * (15 + (index % 4) * 12);

  return {
    id: index,
    left,
    delay,
    duration,
    drift: [`0px`, `${driftX}px`, `${-driftX}px`, `0px`],
    rotate: (index % 2 === 0 ? 1 : -1) * (360 + (index % 4) * 180),
    size: 5 + (index % 4) * 2.5,
    color: beautifulConfettiColors[index % beautifulConfettiColors.length],
  };
});

const successBurstPieces = Array.from({ length: 12 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 12;
  const radius = 45 + (index % 3) * 15;

  return {
    id: index,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    delay: index * 0.08,
    color: beautifulConfettiColors[index % beautifulConfettiColors.length],
  };
});

const ProfileSetup = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const interestsSectionRef = useRef<HTMLDivElement>(null);
  const motivationSectionRef = useRef<HTMLDivElement>(null);
  const [healthErrors, setHealthErrors] = useState<HealthSafetyErrors>({});
  const [preferenceErrors, setPreferenceErrors] = useState<{ interests?: boolean; motivation?: boolean }>({});
  const [searchParams] = useSearchParams();

  // Edit mode: when user already completed onboarding and is editing preferences
  const isEditMode = searchParams.get("mode") === "edit";

  // In edit mode, start at step 2 (skip profile basics) and skip step 1
  const startStep = isEditMode ? 2 : 1;
  const totalSteps = isEditMode ? 3 : 4; // steps 2-4 in edit mode

  const [step, setStep] = useState(startStep);
  const [direction, setDirection] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [initParticles, setInitParticles] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInitParticles(true);
    });
  }, []);

  // Step 1 (only in first-time mode)
  const [phone, setPhone] = useState(profile?.phone || "");
  const [dateOfBirth, setDateOfBirth] = useState(profile?.birth_date || "");
  const [instagramHandle, setInstagramHandle] = useState(profile?.instagram_handle || "");

  // Step 2 - prefill from profile in edit mode
  const [trekkingExp, setTrekkingExp] = useState(isEditMode ? (profile?.trekking_experience || "") : "");
  const [selfLevel, setSelfLevel] = useState(isEditMode ? (profile?.self_level || "") : "");
  const [activityFreq, setActivityFreq] = useState(isEditMode ? (profile?.activity_frequency || "") : "");

  // Step 3 - health and safety
  const [healthSafety, setHealthSafety] = useState<HealthSafetyValue>(
    isEditMode ? getHealthSafetyValueFromProfile(profile) : emptyHealthSafetyValue
  );

  // Step 4 - prefill from profile in edit mode
  const [interests, setInterests] = useState<string[]>(
    isEditMode && profile?.interests ? (profile.interests as string[]) : []
  );
  const [eventMotivation, setEventMotivation] = useState(
    isEditMode ? (profile?.event_motivation || "") : ""
  );

  // Sync fields when profile loads (fixes blank fields when navigating in edit mode)
  useEffect(() => {
    if (isEditMode && profile) {
      setPhone(profile.phone || "");
      setDateOfBirth(profile.birth_date || "");
      setInstagramHandle(profile.instagram_handle || "");
      setTrekkingExp(profile.trekking_experience || "");
      setSelfLevel(profile.self_level || "");
      setActivityFreq(profile.activity_frequency || "");
      setHealthSafety(getHealthSafetyValueFromProfile(profile));
      setInterests(profile.interests ? (profile.interests as string[]) : []);
      setEventMotivation(profile.event_motivation || "");
    }
  }, [isEditMode, profile]);

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
    setInterests((prev) => {
      if (prev.includes(val)) {
        return prev.filter((interest) => interest !== val);
      }

      if (prev.length >= FIT_SCORE_INTEREST_MAX) {
        return prev;
      }

      return [...prev, val];
    });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file || !user) return;
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
        cacheControl: "31536000",
      });
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
    const result = validateHealthSafety(healthSafety);
    setHealthErrors(result.errors);
    return result.isValid;
  }, [healthSafety]);

  const validateStep4 = useCallback(() => {
    const errors: { interests?: boolean; motivation?: boolean } = {};
    if (interests.length < FIT_SCORE_INTEREST_MIN || interests.length > FIT_SCORE_INTEREST_MAX) {
      errors.interests = true;
    }
    if (!eventMotivation) errors.motivation = true;
    setPreferenceErrors(errors);
    if (errors.interests) {
      interestsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (errors.motivation) {
      motivationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }, [interests, eventMotivation]);

  // Clear errors when user selects values
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
  useEffect(() => {
    if (
      interests.length >= FIT_SCORE_INTEREST_MIN &&
      interests.length <= FIT_SCORE_INTEREST_MAX &&
      preferenceErrors.interests
    ) {
      setPreferenceErrors(prev => ({ ...prev, interests: false }));
    }
  }, [interests, preferenceErrors.interests]);
  useEffect(() => {
    if (eventMotivation && preferenceErrors.motivation) setPreferenceErrors(prev => ({ ...prev, motivation: false }));
  }, [eventMotivation, preferenceErrors.motivation]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep3() || !validateStep4()) return;
    setSaving(true);
    try {
      const grade = calculateExperienceGrade(trekkingExp, activityFreq);
      const updateData: Record<string, any> = {
        trekking_experience: trekkingExp,
        activity_frequency: activityFreq,
        experience_grade: grade,
        self_level: selfLevel,
        interests,
        event_motivation: eventMotivation || null,
        onboarding_completed: true,
        ...buildHealthSafetyPayload(healthSafety),
      };

      // Only update phone and birth_date in first-time mode
      if (!isEditMode) {
        const normalizedInstagramHandle = normalizeInstagramHandle(instagramHandle);
        if (!isValidInstagramHandle(normalizedInstagramHandle)) {
          toast({
            title: "Instagram non valido",
            description: "Inserisci solo username, @username o link instagram.com/username.",
            variant: "destructive",
          });
          return;
        }
        updateData.phone = phone.trim();
        updateData.birth_date = dateOfBirth || null;
        updateData.instagram_handle = normalizedInstagramHandle;
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
  const step1Valid = isValidPhone(phone) && !!dateOfBirth && isValidInstagramHandle(normalizeInstagramHandle(instagramHandle));
  const step2Valid = !!trekkingExp && !!selfLevel && !!activityFreq;
  const step3Valid = validateHealthSafety(healthSafety).isValid;
  const step4Valid =
    interests.length >= FIT_SCORE_INTEREST_MIN &&
    interests.length <= FIT_SCORE_INTEREST_MAX &&
    !!eventMotivation;

  if (!user || !profile) return null;

  if (showSuccess) {
    return (
      <div className="relative min-h-screen min-h-[100dvh] overflow-hidden bg-background px-4 flex flex-col items-center justify-center isolate">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {initParticles && (
            <Particles
              id="tsparticles"
              options={{
                fullScreen: { zIndex: 1 },
                particles: {
                  number: { value: 0 },
                  color: { value: ["#00FFFC", "#FC00FF", "#fffc00"] },
                  shape: { type: ["circle", "square", "triangle"], options: {} },
                  opacity: {
                    value: { min: 0, max: 1 },
                    animation: { enable: true, speed: 2, startValue: "max", destroy: "min" }
                  },
                  size: { value: { min: 2, max: 4 } },
                  links: { enable: false },
                  life: { duration: { sync: true, value: 5 }, count: 1 },
                  move: {
                    enable: true,
                    gravity: { enable: true, acceleration: 10 },
                    speed: { min: 10, max: 20 },
                    decay: 0.1,
                    direction: "none",
                    straight: false,
                    outModes: { default: "destroy", top: "none" }
                  },
                  rotate: {
                    value: { min: 0, max: 360 },
                    direction: "random",
                    move: true,
                    animation: { enable: true, speed: 60 }
                  },
                  tilt: {
                    direction: "random",
                    enable: true,
                    move: true,
                    value: { min: 0, max: 360 },
                    animation: { enable: true, speed: 60 }
                  },
                  roll: {
                    darken: { enable: true, value: 25 },
                    enable: true,
                    speed: { min: 15, max: 25 }
                  },
                  wobble: {
                    distance: 30,
                    enable: true,
                    move: true,
                    speed: { min: -15, max: 15 }
                  }
                },
                emitters: {
                  life: { count: 0, duration: 0.1, delay: 0.4 },
                  rate: { delay: 0.1, quantity: 150 },
                  size: { width: 0, height: 0 }
                }
              }}
            />
          )}
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-center space-y-6 max-w-sm relative z-10"
        >
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
            <motion.div
              aria-hidden="true"
              animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-accent/15"
            />
            <motion.div
              aria-hidden="true"
              animate={{ scale: [0.8, 1.25], opacity: [0.45, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-2 rounded-full border border-primary/25"
            />

            {successBurstPieces.map((piece) => (
              <motion.div
                key={piece.id}
                aria-hidden="true"
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: [0, piece.x],
                  y: [0, piece.y],
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.4],
                }}
                transition={{
                  duration: 1.8,
                  delay: piece.delay,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeOut",
                }}
                className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: piece.color }}
              />
            ))}

            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: [0, -8, 5, 0], scale: [1, 1.05, 1.05, 1] }}
              transition={{
                delay: 0.2,
                rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              }}
              className="relative flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card shadow-sm"
            >
              <motion.div
                animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
              >
                <PartyPopper className="h-14 w-14 text-primary" />
              </motion.div>
            </motion.div>
          </div>
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

  const currentStepLabel = step === 1
    ? "Profilo base"
    : step === 2
      ? "Esperienza"
      : step === 3
        ? "Salute e sicurezza"
        : "Preferenze";
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
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="instagram_handle" className="font-body text-sm font-semibold">
                    Profilo Instagram <span className="text-muted-foreground font-normal">(opzionale)</span>
                  </Label>
                  <Input
                    id="instagram_handle"
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="@nomeutente"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="text"
                  />
                  <p className="text-xs text-muted-foreground font-body">
                    Visibile solo allo staff e all'organizzatore degli eventi a cui partecipi.
                  </p>
                </div>

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <Label htmlFor="birth_date" className="font-body text-sm font-semibold">
                    Data di nascita <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                  <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-secondary" />
                    <p>
                      La tua data di nascita sarà visibile solo agli organizzatori per scopi di sicurezza e assicurativi.
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
                  <h1 className="font-display text-xl font-bold text-foreground">Salute e sicurezza</h1>
                  <p className="text-sm text-muted-foreground font-body">
                    Solo ciò che può essere utile allo staff in caso di necessità durante un'attività.
                  </p>
                </div>

                <HealthSafetyForm
                  value={healthSafety}
                  onChange={setHealthSafety}
                  errors={healthErrors}
                />

                <div className="flex gap-3 pb-4">
                  <Button variant="outline" className="flex-1 h-12 font-body font-semibold" onClick={goBack}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Indietro
                  </Button>
                  <Button
                    className="flex-1 h-12 font-body font-semibold"
                    disabled={!step3Valid}
                    onClick={() => {
                      if (validateStep3()) goNext();
                    }}
                  >
                    Continua
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
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
                  <p className="text-sm text-muted-foreground font-body">
                    Useremo queste risposte per suggerirti eventi più affini, senza cambiare la logica del fit score.
                  </p>
                </div>

                {/* Interests */}
                <div ref={interestsSectionRef} className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${preferenceErrors.interests ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
                  <Label className={`font-body text-sm font-semibold ${preferenceErrors.interests ? "text-destructive" : ""}`}>
                    Quali esperienze ti attirano di più? <span className="text-destructive">*</span> {preferenceErrors.interests && <span className="text-destructive text-xs font-normal">— Seleziona da 2 a 4 opzioni</span>}
                  </Label>
                  <p className="text-xs text-muted-foreground font-body">Seleziona da 2 a 4 attività.</p>
                  {preferenceErrors.interests && (
                    <p className="text-xs font-body text-destructive">{FIT_SCORE_INTEREST_VALIDATION_MESSAGE}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: "trekking_giornalieri", emoji: "🥾", label: "Trekking giornalieri" },
                      { val: "cammini_plurigiornalieri", emoji: "🎒", label: "Cammini plurigiornalieri" },
                      { val: "notti_tenda", emoji: "⛺", label: "Notti in tenda" },
                      { val: "trekking_notturni", emoji: "🌌", label: "Trekking notturni" },
                      { val: "aperitivi_cene", emoji: "🍷", label: "Aperitivi e cene" },
                      { val: "sport_movimento", emoji: "🏃", label: "Sport e movimento" },
                      { val: "giochi_sfide", emoji: "🎯", label: "Giochi e sfide" },
                      { val: "weekend_fuori_porta", emoji: "🚗", label: "Weekend fuori porta" },
                      { val: "degustazioni_cantine", emoji: "🍇", label: "Degustazioni e cantine" },
                      { val: "mare_spiaggia", emoji: "🏖️", label: "Mare e spiaggia" },
                    ].map((opt) => (
                      <InterestCard
                        key={opt.val}
                        selected={interests.includes(opt.val)}
                        onClick={() => toggleInterest(opt.val)}
                        emoji={opt.emoji}
                        label={opt.label}
                        disabled={interests.length >= FIT_SCORE_INTEREST_MAX}
                      />
                    ))}
                  </div>
                </div>

                {/* Motivation (mandatory) */}
                <div ref={motivationSectionRef} className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${preferenceErrors.motivation ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
                  <Label className={`font-body text-sm font-semibold ${preferenceErrors.motivation ? "text-destructive" : ""}`}>
                    Cosa cerchi di più in un evento? <span className="text-destructive">*</span> {preferenceErrors.motivation && <span className="text-destructive text-xs font-normal">— Seleziona un'opzione</span>}
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
                        onClick={() => setEventMotivation(opt.val)}
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
                    disabled={!step4Valid || saving}
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
