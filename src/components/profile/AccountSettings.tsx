import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppleIcon, GoogleIcon } from "@/components/auth/OAuthProviderIcons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Lock, Link2, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const HIDE_SOCIAL_AUTH = true;

const AccountSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Change Email
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Change Password
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Social links
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const isGoogleLinked = user?.app_metadata?.providers?.includes("google") ||
    user?.identities?.some((i) => i.provider === "google");
  const isAppleLinked = user?.app_metadata?.providers?.includes("apple") ||
    user?.identities?.some((i) => i.provider === "apple");

  const isEmailProvider = user?.app_metadata?.providers?.includes("email") ||
    user?.identities?.some((i) => i.provider === "email");

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });
      if (error) throw error;
      toast({
        title: "Email di conferma inviata",
        description: "Controlla la tua nuova casella email per confermare il cambio.",
      });
      setShowEmailDialog(false);
      setNewEmail("");
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Errore", description: "La password deve avere almeno 6 caratteri.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Errore", description: "Le password non corrispondono.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      toast({ title: "Password aggiornata", description: "La tua password è stata cambiata con successo." });
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/profile",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  const handleLinkApple = async () => {
    setAppleLoading(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "apple",
        options: {
          redirectTo: window.location.origin + "/profile",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setAppleLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="space-y-1">
        {/* Change Email */}
        <button
          onClick={() => setShowEmailDialog(true)}
          className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left"
        >
          <Mail className="h-[18px] w-[18px] text-secondary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">Cambia email</p>
            <p className="text-xs font-body text-muted-foreground truncate">{user.email}</p>
          </div>
        </button>

        {/* Change Password */}
        {isEmailProvider && (
          <button
            onClick={() => setShowPasswordDialog(true)}
            className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left"
          >
            <Lock className="h-[18px] w-[18px] text-secondary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body font-semibold text-foreground">Cambia password</p>
              <p className="text-xs font-body text-muted-foreground">Aggiorna la tua password di accesso</p>
            </div>
          </button>
        )}

        {/* Link Google */}
        <button
          hidden={HIDE_SOCIAL_AUTH}
          onClick={isGoogleLinked ? undefined : handleLinkGoogle}
          disabled={isGoogleLinked || googleLoading}
          className={`flex items-center gap-3 py-3 px-1 rounded-lg transition-colors group w-full text-left ${
            isGoogleLinked ? "opacity-70 cursor-default" : "hover:bg-muted/50"
          }`}
        >
          <GoogleIcon className="h-[18px] w-[18px] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">
              {isGoogleLinked ? "Google collegato" : "Collega account Google"}
            </p>
            <p className="text-xs font-body text-muted-foreground">
              {isGoogleLinked ? "Il tuo account Google è già collegato" : "Accedi anche con Google"}
            </p>
          </div>
          {isGoogleLinked && (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          )}
          {googleLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Link Apple */}
        <button
          hidden={HIDE_SOCIAL_AUTH}
          onClick={isAppleLinked ? undefined : handleLinkApple}
          disabled={isAppleLinked || appleLoading}
          className={`flex items-center gap-3 py-3 px-1 rounded-lg transition-colors group w-full text-left ${
            isAppleLinked ? "opacity-70 cursor-default" : "hover:bg-muted/50"
          }`}
        >
          <AppleIcon className="h-[18px] w-[18px] shrink-0 text-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">
              {isAppleLinked ? "Apple collegato" : "Collega account Apple"}
            </p>
            <p className="text-xs font-body text-muted-foreground">
              {isAppleLinked ? "Il tuo account Apple è già collegato" : "Accedi anche con Apple"}
            </p>
          </div>
          {isAppleLinked && (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          )}
          {appleLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          )}
        </button>
      </div>

      {/* Change Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Cambia email</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Inserisci il nuovo indirizzo email. Riceverai un'email di conferma su entrambi gli indirizzi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="font-body text-xs text-muted-foreground">Email attuale</Label>
              <p className="text-sm font-body font-medium text-foreground mt-0.5">{user.email}</p>
            </div>
            <div>
              <Label htmlFor="newEmail" className="font-body text-xs">Nuova email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nuova@email.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} className="font-body">
              Annulla
            </Button>
            <Button
              onClick={handleChangeEmail}
              disabled={emailLoading || !newEmail.trim()}
              className="bg-primary text-primary-foreground font-body"
            >
              {emailLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Cambia password</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Inserisci una nuova password. Deve contenere almeno 6 caratteri.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="newPassword" className="font-body text-xs">Nuova password</Label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="font-body text-xs">Conferma password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive font-body mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Le password non corrispondono
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} className="font-body">
              Annulla
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={passwordLoading || !newPassword || newPassword !== confirmPassword}
              className="bg-primary text-primary-foreground font-body"
            >
              {passwordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Aggiorna password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountSettings;
