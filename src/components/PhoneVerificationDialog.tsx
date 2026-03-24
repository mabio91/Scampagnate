import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Smartphone, Loader2, CheckCircle2, ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";

// Analytics helper — tracks verification events
const trackVerificationEvent = (event: string, data?: Record<string, string>) => {
  try {
    // Use custom event tracking if available (e.g., Vercel Analytics)
    if (typeof window !== "undefined" && (window as any).va) {
      (window as any).va("event", { name: `phone_verification_${event}`, ...data });
    }
    // Also log to console for debugging
    console.log(`[Analytics] phone_verification_${event}`, data);
  } catch {}
};

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

type Step = "prompt" | "method" | "otp" | "success";

const PhoneVerificationDialog = ({ open, onOpenChange, onVerified }: PhoneVerificationDialogProps) => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("prompt");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setStep("prompt");
      setOtp("");
      setError("");
      setCooldown(0);
      setRemainingAttempts(null);
      trackVerificationEvent("started");
    }
  }, [open]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendOtp = useCallback(async (selectedChannel: "sms" | "whatsapp") => {
    if (!profile?.phone) {
      toast({ title: "Errore", description: "Numero di telefono non trovato nel profilo", variant: "destructive" });
      return;
    }

    setSending(true);
    setError("");
    setChannel(selectedChannel);
    trackVerificationEvent("method_selected", { channel: selectedChannel });

    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-otp", {
        body: { phone: profile.phone, channel: selectedChannel },
      });

      if (fnError) throw new Error(fnError.message);

      if (data?.error) {
        if (data.fallback === "sms") {
          // WhatsApp failed, auto-fallback to SMS
          toast({ title: "WhatsApp non disponibile", description: "Invio tramite SMS..." });
          await sendOtp("sms");
          return;
        }
        if (data.cooldown) {
          setCooldown(data.cooldown);
        }
        setError(data.error);
        return;
      }

      setStep("otp");
      setCooldown(30);
    } catch (err: any) {
      setError(err.message || "Errore nell'invio del codice");
    } finally {
      setSending(false);
    }
  }, [profile?.phone, toast]);

  const verifyOtp = useCallback(async () => {
    if (otp.length !== 6) return;
    setVerifying(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-otp", {
        body: { otp },
      });

      if (fnError) throw new Error(fnError.message);

      if (data?.error) {
        setError(data.error);
        if (data.remaining_attempts !== undefined) {
          setRemainingAttempts(data.remaining_attempts);
        }
        setOtp("");
        return;
      }

      if (data?.verified) {
        setStep("success");
        await refreshProfile();
        setTimeout(() => {
          onVerified();
          onOpenChange(false);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Errore nella verifica");
      setOtp("");
    } finally {
      setVerifying(false);
    }
  }, [otp, refreshProfile, onVerified, onOpenChange]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && step === "otp" && !verifying) {
      verifyOtp();
    }
  }, [otp, step, verifying, verifyOtp]);

  const handleResend = () => {
    if (cooldown > 0) return;
    setOtp("");
    setError("");
    sendOtp(channel);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* PROMPT: Must verify to join */}
          {step === "prompt" && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-5"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Verifica il tuo numero
                </h2>
                <p className="text-sm text-muted-foreground font-body max-w-xs">
                  Verifica il tuo numero per partecipare agli eventi
                </p>
              </div>
              <Button
                className="w-full h-12 font-body font-semibold text-base"
                onClick={() => setStep("method")}
              >
                Verifica ora
              </Button>
            </motion.div>
          )}

          {/* METHOD SELECTION */}
          {step === "method" && (
            <motion.div
              key="method"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="p-6 space-y-5"
            >
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-foreground">
                  Verifica il tuo numero
                </h2>
                <p className="text-sm text-muted-foreground font-body">
                  Scegli come vuoi ricevere il codice di verifica
                </p>
                {profile?.phone && (
                  <p className="text-sm font-semibold text-foreground font-body mt-2">
                    📱 {profile.phone}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => sendOtp("sms")}
                  disabled={sending}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-border bg-card hover:border-primary/40 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm text-foreground font-body">SMS</p>
                    <p className="text-xs text-muted-foreground font-body">Ricevi un codice via messaggio</p>
                  </div>
                  {sending && channel === "sms" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => sendOtp("whatsapp")}
                  disabled={sending}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-border bg-card hover:border-green-500/40 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm text-foreground font-body">WhatsApp</p>
                    <p className="text-xs text-muted-foreground font-body">Ricevi un codice su WhatsApp</p>
                  </div>
                  {sending && channel === "whatsapp" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </motion.button>
              </div>

              {error && (
                <p className="text-sm text-destructive font-body text-center">{error}</p>
              )}

              <button
                onClick={() => setStep("prompt")}
                className="flex items-center gap-1 text-sm text-muted-foreground font-body mx-auto hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
            </motion.div>
          )}

          {/* OTP INPUT */}
          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="p-6 space-y-5"
            >
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-foreground">
                  Inserisci il codice
                </h2>
                <p className="text-sm text-muted-foreground font-body">
                  Abbiamo inviato un codice a 6 cifre via {channel === "whatsapp" ? "WhatsApp" : "SMS"} al numero {profile?.phone}
                </p>
              </div>

              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={verifying}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {verifying && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-body">Verifica in corso...</span>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive font-body text-center">
                  {error}
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <span className="block text-xs mt-1">
                      {remainingAttempts} tentativ{remainingAttempts === 1 ? "o" : "i"} rimanent{remainingAttempts === 1 ? "e" : "i"}
                    </span>
                  )}
                </p>
              )}

              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground font-body">
                  Non hai ricevuto il codice?
                </p>
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || sending}
                  className="flex items-center gap-1.5 text-sm text-primary font-body font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {cooldown > 0 ? `Invia di nuovo (${cooldown}s)` : "Invia di nuovo"}
                </button>
              </div>

              <button
                onClick={() => { setStep("method"); setOtp(""); setError(""); }}
                className="flex items-center gap-1 text-sm text-muted-foreground font-body mx-auto hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Cambia metodo
              </button>
            </motion.div>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 flex flex-col items-center justify-center space-y-4 py-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
              >
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </motion.div>
              <h2 className="font-display text-xl font-bold text-foreground text-center">
                Numero verificato con successo ✅
              </h2>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneVerificationDialog;
