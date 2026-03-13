import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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

const getPasswordStrength = (pw: string) => {
  const checks = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label = score <= 1 ? "Weak" : score <= 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const color = score <= 1 ? "bg-destructive" : score <= 3 ? "bg-yellow-500" : score === 4 ? "bg-blue-500" : "bg-green-600";
  return { checks, score, label, color, percent: (score / 5) * 100 };
};

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

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      if (!acceptPrivacy) {
        toast({ title: "Error", description: "You must accept the privacy policy", variant: "destructive" });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, { first_name: firstName, last_name: lastName, phone: "" });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Registration complete!", description: "Check your email to confirm your account." });
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Enter your email", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent!", description: "Check your email to reset your password." });
    }
    setLoading(false);
  };

  // Forgot Password view
  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
            <h1 className="font-display text-3xl font-bold text-foreground">Reset Password</h1>
            <p className="text-muted-foreground font-body text-sm mt-1">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label htmlFor="resetEmail" className="font-body text-sm">Email</Label>
              <Input
                id="resetEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="mario@example.com"
                className="mt-1"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : "Send Reset Link"}
            </Button>
          </form>

          <button
            onClick={() => setIsForgotPassword(false)}
            className="flex items-center gap-1 text-sm text-primary font-body hover:underline mt-6 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
          <h1 className="font-display text-3xl font-bold text-foreground">
            {isLogin ? "Welcome Back!" : "Join Us"}
          </h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            {isLogin ? "Sign in to your account" : "Create your Scampagnate account"}
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 bg-white text-gray-900 border border-gray-200 shadow-sm font-body font-semibold flex items-center justify-center gap-2"
            onClick={() => handleOAuthLogin('google')}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
              <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
              <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
              <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
            </svg>
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 bg-black hover:bg-gray-900 text-white shadow-sm font-body font-semibold flex items-center justify-center gap-2"
            onClick={() => handleOAuthLogin('apple')}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
              <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.62-1.48 3.608-2.935 1.156-1.688 1.631-3.324 1.657-3.415-.026-.013-3.181-1.22-3.207-4.856-.026-3.051 2.493-4.506 2.61-4.584-1.428-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.844-1.012 1.415-2.427 1.259-3.83-1.194.052-2.674.805-3.545 1.818-.78.896-1.454 2.338-1.272 3.714 1.337.104 2.713-.688 3.558-1.701z" />
            </svg>
            Continue with Apple
          </Button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-body">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName" className="font-body text-sm">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Mario" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="lastName" className="font-body text-sm">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Rossi" className="mt-1" />
                </div>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email" className="font-body text-sm">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="mario@example.com" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="password" className="font-body text-sm">Password</Label>
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
                  ["length", "At least 8 characters"],
                  ["uppercase", "Uppercase letter"],
                  ["lowercase", "Lowercase letter"],
                  ["number", "Number"],
                  ["special", "Special character"],
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
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} className="mt-1 accent-primary" />
              <span className="text-xs font-body text-muted-foreground">
                I accept the <a href="#" className="text-primary underline">Privacy Policy</a> and <a href="#" className="text-primary underline">Terms of Service</a>
              </span>
            </label>
          )}

          {isLogin && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="rememberMe" className="text-sm font-body text-muted-foreground cursor-pointer">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-sm text-primary font-body hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isLogin ? "Signing In..." : "Signing Up..."}</> : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <p className="text-center text-sm font-body text-muted-foreground mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-semibold">
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>

        {!isLogin && (
          <div className="mt-8 pt-6 border-t border-border flex flex-col items-center">
            <button
              onClick={() => setShowDifficultyGuide(true)}
              className="flex items-center gap-1.5 text-sm text-secondary hover:underline font-body font-semibold"
            >
              <Info className="h-4 w-4" />
              View Trekking Difficulty Guide
            </button>
            <p className="text-xs text-muted-foreground mt-1.5 text-center px-4">
              Learn our 5-level standardized criteria for joining events safely.
            </p>
          </div>
        )}
      </motion.div>

      <DifficultyGuideDialog
        open={showDifficultyGuide}
        onOpenChange={setShowDifficultyGuide}
      />
    </div>
  );
};

export default Auth;
