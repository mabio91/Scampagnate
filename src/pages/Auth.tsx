import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      if (!acceptPrivacy) {
        toast({ title: "Errore", description: "Devi accettare la privacy policy", variant: "destructive" });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, { first_name: firstName, last_name: lastName, phone });
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Registrazione completata!", description: "Controlla la tua email per confermare l'account." });
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

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
            {isLogin ? "Bentornato!" : "Unisciti a noi"}
          </h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            {isLogin ? "Accedi al tuo account" : "Crea il tuo account Scampagnate"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName" className="font-body text-sm">Nome</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Mario" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="lastName" className="font-body text-sm">Cognome</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Rossi" className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="font-body text-sm">Telefono</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+39 333 1234567" className="mt-1" />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email" className="font-body text-sm">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="mario@esempio.it" className="mt-1" />
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

          {!isLogin && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} className="mt-1 accent-primary" />
              <span className="text-xs font-body text-muted-foreground">
                Accetto la <a href="#" className="text-primary underline">Privacy Policy</a> e i <a href="#" className="text-primary underline">Termini di Servizio</a>
              </span>
            </label>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold">
            {loading ? "Caricamento..." : isLogin ? "Accedi" : "Registrati"}
          </Button>

          {isLogin && (
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  toast({ title: "Inserisci la tua email", description: "Inserisci l'email per reimpostare la password.", variant: "destructive" });
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) {
                  toast({ title: "Errore", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Email inviata!", description: "Controlla la tua email per reimpostare la password." });
                }
              }}
              className="w-full text-center text-sm text-primary font-body hover:underline"
            >
              Password dimenticata?
            </button>
          )}
        </form>

        <p className="text-center text-sm font-body text-muted-foreground mt-6">
          {isLogin ? "Non hai un account?" : "Hai già un account?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-semibold">
            {isLogin ? "Registrati" : "Accedi"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
