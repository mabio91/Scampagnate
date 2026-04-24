import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const MembershipSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [eventId, setEventId] = useState<string | null>(null);
  const navigateToEvent = () => {
    if (eventId) {
      navigate(`/event/${eventId}`, { replace: true });
    }
  };

  const navigateToHome = () => navigate("/", { replace: true });

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const evtId = searchParams.get("event_id");
    setEventId(evtId);

    if (!sessionId) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-membership-payment", {
          body: { sessionId },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || "Verification failed");
        }

        await refreshProfile();
        setStatus("success");
        toast({ title: t("membershipActivatedToast"), description: t("membershipActivatedToastDesc") });
      } catch (err: any) {
        console.error("Verification error:", err);
        setStatus("error");
        toast({ title: t("error"), description: err.message, variant: "destructive" });
      }
    };

    verify();
  }, [searchParams, refreshProfile, toast]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {status === "verifying" && (
          <>
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
            <h1 className="font-display text-2xl font-bold text-foreground">{t("verifyingMembership")}</h1>
            <p className="text-sm font-body text-muted-foreground">{t("verifyingMembershipDesc")}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-success" />
            <h1 className="font-display text-2xl font-bold text-foreground">{t("membershipActivatedTitle")}</h1>
            <p className="text-sm font-body text-muted-foreground">{t("membershipActivatedDesc")}</p>
            <div className="space-y-3 pt-4">
              {eventId && (
                <Button
                  onClick={navigateToEvent}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  {t("backToEvent")}
                </Button>
              )}
              <Button
                onClick={navigateToHome}
                variant="outline"
                className="w-full font-body"
              >
                {t("goToHome")}
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h1 className="font-display text-2xl font-bold text-foreground">{t("verificationError")}</h1>
            <p className="text-sm font-body text-muted-foreground">{t("verificationErrorDesc")}</p>
            <Button
              onClick={navigateToHome}
              className="w-full bg-primary text-primary-foreground font-body font-semibold"
            >
              {t("goToHome")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default MembershipSuccess;
