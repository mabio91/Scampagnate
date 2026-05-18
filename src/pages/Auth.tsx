import { useState, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Eye, EyeOff, ArrowLeft, Check, X, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DifficultyGuideDialog } from "@/components/events/DifficultyGuideDialog";
import { saveRegistrationConsents } from "@/hooks/useUserConsents";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppleIcon, GoogleIcon } from "@/components/auth/OAuthProviderIcons";

const HIDE_SOCIAL_AUTH = true;

/** Reusable consent checkbox for registration */
const ConsentCheckbox = ({
  checked, onChange, label, description, error, required,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  description?: string;
  error?: boolean;
  required?: boolean;
}) => (
  <motion.div
    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition-colors duration-200 ${
      checked
        ? "border-success/50 bg-success/5"
        : error
        ? "border-destructive bg-destructive/5"
        : "border-border hover:bg-muted/50"
    }`}
    onClick={() => onChange(!checked)}
    animate={checked ? { scale: [0.97, 1] } : {}}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    <motion.div
      className={`flex items-center justify-center h-5 w-5 rounded border-2 shrink-0 transition-colors duration-200 ${
        checked
          ? "bg-success border-success"
          : error
          ? "border-destructive"
          : "border-muted-foreground/40"
      }`}
      animate={checked ? { scale: [0.8, 1.1, 1] } : {}}
      transition={{ duration: 0.25 }}
    >
      <AnimatePresence>
        {checked && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="h-3.5 w-3.5 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    <div className="flex-1 min-w-0">
      <span className="text-xs font-body text-foreground leading-snug block">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {description && (
        <span className="text-[11px] font-body text-muted-foreground leading-snug mt-0.5 block">
          {description}
        </span>
      )}
    </div>
  </motion.div>
);

const Auth = () => {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("mode") !== "register";
  });
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [acceptMedia, setAcceptMedia] = useState(false);
  const [showDifficultyGuide, setShowDifficultyGuide] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const getPasswordStrength = (pw: string) => {
    const checks = {
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      lowercase: /[a-z]/.test(pw),
      number: /\d/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
    const score = Object.values(checks).filter(Boolean).length;
    const label = score <= 1 ? t("passwordStrengthWeak") : score <= 3 ? t("passwordStrengthFair") : score === 4 ? t("passwordStrengthGood") : t("passwordStrengthStrong");
    const color = score <= 1 ? "bg-destructive" : score <= 3 ? "bg-yellow-500" : score === 4 ? "bg-blue-500" : "bg-green-600";
    return { checks, score, label, color, percent: (score / 5) * 100 };
  };

  const strength = useMemo(() => getPasswordStrength(password), [password, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: t("error"), description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      if (!acceptTerms || !acceptAge) {
        setConsentError(true);
        setLoading(false);
        return;
      }
      const { error, session } = await signUp(email, password, { first_name: firstName, last_name: lastName, phone: "" });
      if (error) {
        toast({ title: t("error"), description: error.message, variant: "destructive" });
      } else {
        // Save consents after successful signup
        try {
          const { data: { user: newUser } } = await supabase.auth.getUser();
          if (newUser) {
            await saveRegistrationConsents(newUser.id, {
              terms: true,
              age: true,
              marketing: acceptMarketing,
              media: acceptMedia,
            });
          }
        } catch (e) {
          // Non-blocking — consents will be saved but don't block registration
          console.warn("Failed to save consents:", e);
        }
        toast({ title: t("welcomeBack"), description: t("accountCreated") });
        navigate("/");
      }
    }
    setLoading(false);
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: t("enterYourEmail"), description: t("pleaseEnterEmail"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("emailSent"), description: t("checkEmailReset") });
    }
    setLoading(false);
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
            <h1 className="font-display text-3xl font-bold text-foreground">{t("resetPassword")}</h1>
            <p className="text-muted-foreground font-body text-sm mt-1">{t("resetPasswordDesc")}</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label htmlFor="resetEmail" className="font-body text-sm">{t("email")}</Label>
              <Input id="resetEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="mario@example.com" className="mt-1" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("sending")}</> : t("sendResetLink")}
            </Button>
          </form>
          <button onClick={() => setIsForgotPassword(false)} className="flex items-center gap-1 text-sm text-primary font-body hover:underline mt-6 mx-auto">
            <ArrowLeft className="h-4 w-4" /> {t("backToSignIn")}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
          <h1 className="font-display text-3xl font-bold text-foreground">
            {isLogin ? t("welcomeBack") : t("joinUs")}
          </h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            {isLogin ? t("signInToAccount") : t("createAccount")}
          </p>
        </div>

        <div className={`flex flex-col gap-3 mb-6 ${HIDE_SOCIAL_AUTH ? "hidden" : ""}`}>
          <Button type="button" variant="outline" className="w-full h-11 bg-white text-gray-900 border border-gray-200 shadow-sm font-body font-semibold flex items-center justify-center gap-2" onClick={() => handleOAuthLogin('google')}>
            <GoogleIcon />
            {t("continueWithGoogle")}
          </Button>
          <Button type="button" variant="outline" className="w-full h-11 bg-black text-white border border-black shadow-sm font-body font-semibold flex items-center justify-center gap-2 hover:bg-black/90 hover:text-white" onClick={() => handleOAuthLogin('apple')}>
            <AppleIcon />
            {t("continueWithApple")}
          </Button>
        </div>

        <div className={`relative mb-6 ${HIDE_SOCIAL_AUTH ? "hidden" : ""}`}>
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-body">{t("orContinueWithEmail")}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName" className="font-body text-sm">{t("firstName")}</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Mario" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="lastName" className="font-body text-sm">{t("lastName")}</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Rossi" className="mt-1" />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="email" className="font-body text-sm">{t("email")}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="mario@example.com" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="password" className="font-body text-sm">{t("password")}</Label>
            <div className="relative mt-1">
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {!isLogin && password && (
            <div className="space-y-2 -mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.percent}%` }} />
                </div>
                <span className="text-xs font-body font-medium text-muted-foreground w-12">{strength.label}</span>
              </div>
              <ul className="space-y-0.5">
                {([
                  ["length", t("atLeast8Chars")],
                  ["uppercase", t("uppercaseLetter")],
                  ["lowercase", t("lowercaseLetter")],
                  ["number", t("number")],
                  ["special", t("specialCharacter")],
                ] as const).map(([key, text]) => (
                  <li key={key} className="flex items-center gap-1.5 text-xs font-body">
                    {strength.checks[key] ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-muted-foreground/50" />}
                    <span className={strength.checks[key] ? "text-foreground" : "text-muted-foreground"}>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isLogin && (
            <div className="space-y-3">
              {/* Checkbox 1: Terms & Privacy (mandatory) */}
              <ConsentCheckbox
                checked={acceptTerms}
                onChange={(v) => { setAcceptTerms(v); if (v) setConsentError(false); }}
                error={consentError && !acceptTerms}
                label={
                  <span>
                    Ho letto e accetto i{" "}
                    <Link to="/terms?from=register" className="text-primary underline font-medium" onClick={(e) => e.stopPropagation()}>
                      Termini di Utilizzo
                    </Link>{" "}
                    e l'{" "}
                    <Link to="/privacy?from=register" className="text-primary underline font-medium" onClick={(e) => e.stopPropagation()}>
                      Informativa Privacy
                    </Link>
                  </span>
                }
                required
              />

              {/* Checkbox 2: Age confirmation (mandatory) */}
              <ConsentCheckbox
                checked={acceptAge}
                onChange={(v) => { setAcceptAge(v); if (v) setConsentError(false); }}
                error={consentError && !acceptAge}
                label="Confermo di avere almeno 18 anni e di partecipare alle attività sotto la mia responsabilità"
                required
              />

              {/* Checkbox 3: Marketing (optional) */}
              <ConsentCheckbox
                checked={acceptMarketing}
                onChange={setAcceptMarketing}
                label="Comunicazioni e novità"
                description="Ti terremo aggiornato su nuove iniziative, promozioni, eventi speciali e contenuti della community"
              />

              {/* Checkbox 4: Media (optional) */}
              <ConsentCheckbox
                checked={acceptMedia}
                onChange={setAcceptMedia}
                label="Fai parte dei nostri racconti"
                description="Possiamo condividere foto e momenti delle esperienze sui canali Scampagnate"
              />

              <AnimatePresence>
                {consentError && (!acceptTerms || !acceptAge) && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-destructive font-body flex items-center gap-1 pl-1"
                  >
                    ⚠️ Devi accettare i campi obbligatori per continuare
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          {isLogin && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="rememberMe" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
                <Label htmlFor="rememberMe" className="text-sm font-body text-muted-foreground cursor-pointer">{t("rememberMe")}</Label>
              </div>
              <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-primary font-body hover:underline">{t("forgotPassword")}</button>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isLogin ? t("signingIn") : t("signingUp")}</> : isLogin ? t("signIn") : t("signUp")}
          </Button>
        </form>

        <p className="text-center text-sm font-body text-muted-foreground mt-6">
          {isLogin ? t("dontHaveAccount") : t("alreadyHaveAccount")}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-semibold">
            {isLogin ? t("signUp") : t("signIn")}
          </button>
        </p>

        {!isLogin && (
          <div className="mt-8 pt-6 border-t border-border flex flex-col items-center">
            <button onClick={() => setShowDifficultyGuide(true)} className="flex items-center gap-1.5 text-sm text-secondary hover:underline font-body font-semibold">
              <Info className="h-4 w-4" /> Che livello sei?
            </button>
            <p className="text-xs text-muted-foreground mt-1.5 text-center px-4">Scopri quale esperienza è giusta per te</p>
          </div>
        )}
      </motion.div>

      <DifficultyGuideDialog open={showDifficultyGuide} onOpenChange={setShowDifficultyGuide} />
    </div>
  );
};

export default Auth;
