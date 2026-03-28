
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  const { data: page, isLoading } = useQuery({
    queryKey: ["content-page", "termini-di-servizio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pages")
        .select("*")
        .eq("slug", "termini-di-servizio")
        .eq("is_published", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground text-sm">
          <ArrowLeft className="h-4 w-4" /> Indietro
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Termini di Servizio</h1>
            <p className="text-sm text-muted-foreground">Le condizioni per utilizzare la piattaforma</p>
          </div>
        </div>

        <Separator />

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : page ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none font-body"
            dangerouslySetInnerHTML={{ __html: page.content_html }}
          />
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-body">Contenuto non disponibile</p>
          </div>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Scampagnate — Tutti i diritti riservati
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Terms;
