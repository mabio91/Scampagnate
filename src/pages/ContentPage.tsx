import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { ArrowLeft, Loader2 } from "lucide-react";

const ContentPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: page, isLoading } = useQuery({
    queryKey: ["content-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pages")
        .select("*")
        .eq("slug", slug!)
        .eq("is_published", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  return (
    <>
      <div className="px-4 pt-4 pb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Indietro
        </button>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : page ? (
          <>
            <h1 className="font-display text-2xl font-bold text-foreground mb-4">{page.title}</h1>
            <div
              className="prose prose-sm dark:prose-invert max-w-none font-body"
              dangerouslySetInnerHTML={{ __html: page.content_html }}
            />
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-body">Contenuto non disponibile</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ContentPage;
