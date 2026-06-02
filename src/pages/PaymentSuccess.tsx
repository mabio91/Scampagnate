import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const EDGE_GATEWAY_JWT =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_FUNCTIONS_URL = (
  import.meta.env.VITE_SUPABASE_URL || "https://istotjnoqtrtthnyreyv.supabase.co"
).replace(/\/$/, "");

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"verifying" | "success" | "spot_taken" | "error">("verifying");
  const [eventId, setEventId] = useState<string | null>(null);
  const [spotTakenMessage, setSpotTakenMessage] = useState("");
  const navigateToEvent = () => {
    if (eventId) {
      navigate(`/event/${eventId}`, { replace: true });
    }
  };

  const navigateToMyEvents = () => navigate("/my-events", { replace: true });
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
        if (!EDGE_GATEWAY_JWT) {
          throw new Error("Configurazione Supabase mancante per la verifica del pagamento.");
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (sessionError || !accessToken) {
          throw new Error("Sessione scaduta. Effettua di nuovo l'accesso per verificare il pagamento.");
        }

        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/functions/v1/verify-event-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EDGE_GATEWAY_JWT,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Verification failed");
        }

        // Handle spot taken / auto-refund
        if (data?.spot_taken && data?.auto_refunded) {
          await refreshProfile();
          setSpotTakenMessage(data.message || "Il posto è stato preso da un altro partecipante. Ti abbiamo rimborsato automaticamente.");
          setStatus("spot_taken");
          return;
        }

        if (data?.auto_refunded && !data?.success) {
          setSpotTakenMessage(data.error || data.message || "Rimborso automatico elaborato.");
          setStatus("spot_taken");
          return;
        }

        if (!data?.success) {
          throw new Error(data?.error || "Verification failed");
        }

        await refreshProfile();
        setStatus("success");
        toast({ title: t("paymentConfirmedToast"), description: t("paymentConfirmedToastDesc") });
      } catch (err: any) {
        console.error("Payment verification error:", err);
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
            <h1 className="font-display text-2xl font-bold text-foreground">{t("verifyingPayment")}</h1>
            <p className="text-sm font-body text-muted-foreground">{t("verifyingPaymentDesc")}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-success" />
            <h1 className="font-display text-2xl font-bold text-foreground">{t("paymentConfirmedTitle")}</h1>
            <p className="text-sm font-body text-muted-foreground">{t("paymentConfirmedDesc")}</p>
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
                onClick={navigateToMyEvents}
                variant="outline"
                className="w-full font-body"
              >
                {t("myEvents")}
              </Button>
            </div>
          </>
        )}

        {status === "spot_taken" && (
          <>
            <AlertTriangle className="h-16 w-16 mx-auto text-warning" />
            <h1 className="font-display text-2xl font-bold text-foreground">Posto non confermato</h1>
            <p className="text-sm font-body text-muted-foreground">{spotTakenMessage}</p>
            <p className="text-xs font-body text-muted-foreground">Resti in lista d'attesa e verrai notificato se si libera un altro posto.</p>
            <div className="space-y-3 pt-4">
              {eventId && (
                <Button
                  onClick={navigateToEvent}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  Torna all'evento
                </Button>
              )}
              <Button
                onClick={navigateToMyEvents}
                variant="outline"
                className="w-full font-body"
              >
                My events
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h1 className="font-display text-2xl font-bold text-foreground">{t("verificationError")}</h1>
            <p className="text-sm font-body text-muted-foreground">{t("verificationErrorDesc")}</p>
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
      </div>
    </div>
  );
};

export default PaymentSuccess;
