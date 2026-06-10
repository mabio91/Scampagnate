import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSelfCheckInErrorMessage, invokeEventSelfCheckIn } from "@/lib/eventSelfCheckIn";

type CheckInState = "idle" | "checking" | "success" | "already" | "error";

export default function EventSelfCheckIn() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") || "";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<CheckInState>("idle");
  const [message, setMessage] = useState("");

  const { data: event } = useQuery({
    queryKey: ["self-checkin-event", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,date,time,location,image_url")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const loginPath = useMemo(
    () => `/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
    [location.pathname, location.search],
  );

  useEffect(() => {
    if (!id || !token || authLoading || !user || state !== "idle") return;

    const runCheckIn = async () => {
      setState("checking");
      try {
        const result = await invokeEventSelfCheckIn({
          action: "checkin",
          eventId: id,
          token,
        });
        setMessage(result.eventTitle || event?.title || "");
        setState(result.alreadyCheckedIn ? "already" : "success");
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : null;
        setMessage(getSelfCheckInErrorMessage(rawMessage));
        setState("error");
      }
    };

    void runCheckIn();
  }, [authLoading, event?.title, id, state, token, user]);

  const title = event?.title || "Check-in evento";

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <Button type="button" variant="ghost" className="mb-4 w-fit gap-2 px-0" onClick={() => navigate(id ? `/event/${id}` : "/")}>
          <ArrowLeft className="h-4 w-4" />
          Evento
        </Button>

        <Card className="overflow-hidden">
          {event?.image_url && (
            <img src={event.image_url} alt="" className="h-44 w-full object-cover" />
          )}
          <div className="space-y-5 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Check-in</p>
              <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-foreground">{title}</h1>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                {event?.date && (
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(event.date).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    {event.time ? ` · ${event.time}` : ""}
                  </p>
                )}
                {event?.location && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </p>
                )}
              </div>
            </div>

            {!token ? (
              <StatusBlock
                icon={<AlertCircle className="h-8 w-8 text-destructive" />}
                title="QR non valido"
                description="Apri il QR mostrato dallo staff all'ingresso."
              />
            ) : authLoading ? (
              <StatusBlock
                icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />}
                title="Preparazione check-in"
                description="Stiamo verificando il tuo accesso."
              />
            ) : !user ? (
              <div className="space-y-4">
                <StatusBlock
                  icon={<AlertCircle className="h-8 w-8 text-primary" />}
                  title="Accedi per confermare"
                  description="Usa l'account con cui ti sei registrato all'evento."
                />
                <Button type="button" className="w-full" onClick={() => navigate(loginPath)}>
                  Accedi
                </Button>
              </div>
            ) : state === "checking" || state === "idle" ? (
              <StatusBlock
                icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />}
                title="Check-in in corso"
                description="Tieni aperta questa schermata."
              />
            ) : state === "success" || state === "already" ? (
              <div className="space-y-4">
                <StatusBlock
                  icon={<CheckCircle2 className="h-9 w-9 text-success" />}
                  title={state === "already" ? "Check-in gia registrato" : "Check-in confermato"}
                  description={message || "La tua presenza e stata registrata."}
                />
                <Button asChild className="w-full">
                  <Link to={id ? `/event/${id}` : "/"}>Torna all'evento</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <StatusBlock
                  icon={<AlertCircle className="h-9 w-9 text-destructive" />}
                  title="Check-in non completato"
                  description={message}
                />
                <Button asChild variant="outline" className="w-full">
                  <Link to={id ? `/event/${id}` : "/"}>Torna all'evento</Link>
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusBlock({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm">
        {icon}
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
