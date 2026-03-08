import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import logo from "@/assets/logo.png";

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

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated!" });
      navigate("/");
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
          <p className="text-muted-foreground font-body">Invalid link.</p>
          <Button onClick={() => navigate("/auth")} className="mt-4">Back to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
          <h1 className="font-display text-2xl font-bold text-foreground">New Password</h1>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <Label className="font-body text-sm">New password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Confirm password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="mt-1" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-body font-semibold">
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
