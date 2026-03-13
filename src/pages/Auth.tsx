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
import { Eye, EyeOff, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
      </motion.div>
    </div>
  );
};

export default Auth;
