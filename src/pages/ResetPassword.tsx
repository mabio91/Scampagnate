import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password aggiornata!" });
      navigate("/");
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
          <p className="text-muted-foreground font-body">Link non valido.</p>
          <Button onClick={() => navigate("/auth")} className="mt-4">Torna al login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={logo} alt="Scampagnate" className="h-16 w-16 rounded-full mx-auto mb-3" />
          <h1 className="font-display text-2xl font-bold text-foreground">Nuova Password</h1>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <Label className="font-body text-sm">Nuova password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-body font-semibold">
            {loading ? "Aggiornamento..." : "Aggiorna Password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
