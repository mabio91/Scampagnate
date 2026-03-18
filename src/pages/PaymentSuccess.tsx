import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [eventId, setEventId] = useState<string | null>(null);

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

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || "Verification failed");
        }

        await refreshProfile();
        setStatus("success");
        toast({ title: "Pagamento confermato!", description: "Il tuo pagamento è stato registrato con successo." });
      } catch (err: any) {
        console.error("Payment verification error:", err);
        setStatus("error");
        toast({ title: "Errore", description: err.message, variant: "destructive" });
      }
    };

    verify();
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {status === "verifying" && (
          <>
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
            <h1 className="font-display text-2xl font-bold text-foreground">Verifica pagamento...</h1>
            <p className="text-sm font-body text-muted-foreground">
              Stiamo verificando il tuo pagamento.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-success" />
            <h1 className="font-display text-2xl font-bold text-foreground">Pagamento Confermato! 🎉</h1>
            <p className="text-sm font-body text-muted-foreground">
              Il pagamento è stato registrato. Sei ufficialmente iscritto all'evento!
            </p>
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
            <h1 className="font-display text-2xl font-bold text-foreground">Errore di Verifica</h1>
            <p className="text-sm font-body text-muted-foreground">
              Non siamo riusciti a verificare il pagamento. Se hai già pagato, contatta il supporto.
            </p>
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
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full font-body"
              >
                Vai alla Home
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
