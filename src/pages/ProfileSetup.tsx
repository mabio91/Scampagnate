import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
    className={`relative flex items-center gap-2.5 px-3.5 py-3 rounded-xl border-2 transition-all duration-200 ${
      selected
        ? "border-primary bg-primary/10"
        : disabled
        ? "border-border bg-muted opacity-50 cursor-not-allowed"
        : "border-border bg-card hover:border-primary/30"
    }`}
  >
    <span className="text-lg">{emoji}</span>
    <span className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>{label}</span>
    {selected && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="ml-auto shrink-0 w-4.5 h-4.5 rounded-full bg-primary flex items-center justify-center"
      >
        <Check className="h-3 w-3 text-primary-foreground" />
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

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Step 1
  const [phone, setPhone] = useState(profile?.phone || "");

  // Step 2
  const [trekkingExp, setTrekkingExp] = useState("");
  const [selfLevel, setSelfLevel] = useState("");
  const [activityFreq, setActivityFreq] = useState("");

  // Step 3
  const [hasCar, setHasCar] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [eventMotivation, setEventMotivation] = useState("");

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => s + 1);
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => s - 1);
  }, []);

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

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const grade = calculateExperienceGrade(trekkingExp, activityFreq);
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: phone.trim(),
          trekking_experience: trekkingExp,
          activity_frequency: activityFreq,
          experience_grade: grade,
          self_level: selfLevel,
          has_car: hasCar,
          interests,
          event_motivation: eventMotivation || null,
          onboarding_completed: true,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setShowSuccess(true);
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const step1Valid = phone.trim().length >= 5;
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
            <h1 className="font-display text-2xl font-bold text-foreground">Perfetto! 🎉</h1>
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

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
      {/* Progress header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <p className="text-sm font-semibold text-foreground font-body">Step {step} di 3</p>
          <p className="text-xs text-muted-foreground font-body">
            {step === 1 ? "Profilo base" : step === 2 ? "Esperienza" : "Preferenze"}
          </p>
        </div>
        <Progress value={(step / 3) * 100} className="h-1.5 max-w-md mx-auto" />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 overflow-hidden">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
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
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
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
                  <h1 className="font-display text-xl font-bold text-foreground">Esperienza e attività</h1>
                  <p className="text-sm text-muted-foreground font-body">
                    Per aiutarci a consigliarti eventi adatti e garantire la sicurezza durante le attività outdoor.
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
                      { val: "high", emoji: "💪", label: "Più di 2 volte a settimana" },
                      { val: "medium", emoji: "🙂", label: "1–2 volte a settimana" },
                      { val: "low", emoji: "🌿", label: "Raramente" },
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
                    Indietro
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
                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">Sei automunito?</Label>
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
                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">
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
