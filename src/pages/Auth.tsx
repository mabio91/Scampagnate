import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { useLanguage } from "@/contexts/LanguageContext";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [showDifficultyGuide, setShowDifficultyGuide] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);

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
      if (!acceptPrivacy) {
        setPrivacyError(true);
        setLoading(false);
        return;
      }
      const { error, session } = await signUp(email, password, { first_name: firstName, last_name: lastName, phone: "" });
      if (error) {
        toast({ title: t("error"), description: error.message, variant: "destructive" });
      } else {
        // No email verification required - user can access immediately
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

        <div className="flex flex-col gap-3 mb-6">
          <Button type="button" variant="outline" className="w-full h-11 bg-white text-gray-900 border border-gray-200 shadow-sm font-body font-semibold flex items-center justify-center gap-2" onClick={() => handleOAuthLogin('google')}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
              <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
              <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
              <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
            </svg>
            {t("continueWithGoogle")}
          </Button>
        </div>

        <div className="relative mb-6">
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
            <div className="space-y-1.5">
              <motion.div
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition-colors duration-200 ${
                  acceptPrivacy
                    ? "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                    : privacyError
                    ? "border-destructive bg-destructive/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => {
                  setAcceptPrivacy(!acceptPrivacy);
                  if (!acceptPrivacy) setPrivacyError(false);
                }}
                animate={acceptPrivacy ? { scale: [0.97, 1] } : {}}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <motion.div
                  className={`flex items-center justify-center h-5 w-5 rounded border-2 shrink-0 transition-colors duration-200 ${
                    acceptPrivacy
                      ? "bg-green-600 border-green-600"
                      : privacyError
                      ? "border-destructive"
                      : "border-muted-foreground/40"
                  }`}
                  animate={acceptPrivacy ? { scale: [0.8, 1.1, 1] } : {}}
                  transition={{ duration: 0.25 }}
                >
                  <AnimatePresence>
                    {acceptPrivacy && (
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
                <span className="text-xs font-body text-muted-foreground leading-snug">
                  Accetto la{" "}
                  <Link to="/privacy" className="text-primary underline font-medium" onClick={(e) => e.stopPropagation()}>
                    Privacy Policy
                  </Link>{" "}
                  e i{" "}
                  <Link to="/terms" className="text-primary underline font-medium" onClick={(e) => e.stopPropagation()}>
                    Termini di Servizio
                  </Link>
                </span>
              </motion.div>

              <AnimatePresence>
                {privacyError && !acceptPrivacy && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-destructive font-body flex items-center gap-1 pl-1"
                  >
                    ⚠️ Devi accettare i Termini e la Privacy per continuare
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
