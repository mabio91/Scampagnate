import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"verifying" | "success" | "spot_taken" | "error">("verifying");
  const [eventId, setEventId] = useState<string | null>(null);
  const [spotTakenMessage, setSpotTakenMessage] = useState("");

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
        const { data, error } = await supabase.functions.invoke("verify-event-payment", {
          body: { sessionId },
        });

        if (error) throw new Error(error.message || "Verification failed");

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
                  onClick={() => navigate(`/event/${eventId}`)}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  {t("backToEvent")}
                </Button>
              )}
              <Button
                onClick={() => navigate("/my-events")}
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
            <h1 className="font-display text-2xl font-bold text-foreground">Posto già assegnato</h1>
            <p className="text-sm font-body text-muted-foreground">{spotTakenMessage}</p>
            <p className="text-xs font-body text-muted-foreground">Resti in lista d'attesa e verrai notificato se si libera un altro posto.</p>
            <div className="space-y-3 pt-4">
              {eventId && (
                <Button
                  onClick={() => navigate(`/event/${eventId}`)}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  Torna all'evento
                </Button>
              )}
              <Button
                onClick={() => navigate("/my-events")}
                variant="outline"
                className="w-full font-body"
              >
                I miei eventi
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
                  onClick={() => navigate(`/event/${eventId}`)}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  {t("backToEvent")}
                </Button>
              )}
              <Button
                onClick={() => navigate("/")}
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
