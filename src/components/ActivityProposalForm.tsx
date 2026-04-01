import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Lightbulb, Rocket } from "lucide-react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { useQuery } from "@tanstack/react-query";

interface ActivityProposalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ActivityProposalForm = ({ open, onOpenChange }: ActivityProposalFormProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";

  const { data: categories } = useQuery({
    queryKey: ["event-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_categories").select("id, name, icon").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [activityTitle, setActivityTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [suggestedTime, setSuggestedTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setActivityTitle("");
    setDescription("");
    setLocation("");
    setLocationLabel("");
    setSuggestedDate("");
    setSuggestedTime("");
    setMaxParticipants("");
    setCategoryId("");
    setSubmitted(false);
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, boolean> = {};
    if (!activityTitle.trim()) newErrors.title = true;
    if (!description.trim()) newErrors.description = true;
    if (!location.trim()) newErrors.location = true;
    if (!categoryId) newErrors.category = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast({ title: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const selectedCat = categories?.find(c => c.id === categoryId);
      const { error } = await supabase.from("activity_proposals" as any).insert({
        proposer_name: userName,
        proposer_id: user?.id || null,
        activity_title: activityTitle.trim(),
        description: description.trim(),
        location: location.trim(),
        location_label: locationLabel.trim() || null,
        suggested_date: suggestedDate || null,
        suggested_time: suggestedTime || null,
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        category: selectedCat?.name || null,
        category_id: categoryId || null,
      } as any);
      if (error) throw error;
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  const handleSuccessClose = () => {
    handleClose();
    navigate("/");
  };

  // Success state
  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lightbulb className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              Grande idea! 💡
            </h3>
            <p className="text-sm font-body text-muted-foreground leading-relaxed">
              Abbiamo ricevuto la tua proposta.
              <br />
              Se verrà approvata, potremmo trasformarla in un evento ufficiale.
            </p>
            <Button onClick={handleSuccessClose} className="w-full">
              Torna agli eventi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Proponi un'attività</DialogTitle>
          <DialogDescription className="font-body text-sm">
            Suggerisci una nuova attività alla community. Il team valuterà la tua proposta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* User name (read-only) */}
          <div>
            <Label className="font-body text-xs text-muted-foreground">Il tuo nome</Label>
            <Input value={userName} disabled className="mt-1 bg-muted/50" />
          </div>

          {/* SECTION 1 – Idea */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-foreground border-b border-border pb-1">
              Raccontaci la tua idea
            </h3>

            <div>
              <Label className="font-body text-sm font-semibold">
                Titolo attività <span className="text-destructive">*</span>
              </Label>
              <Input
                value={activityTitle}
                onChange={e => { setActivityTitle(e.target.value); setErrors(p => ({ ...p, title: false })); }}
                placeholder="Es. Trekking al tramonto sul Circeo"
                className={`mt-1 ${errors.title ? "border-destructive" : ""}`}
              />
              {errors.title && <p className="text-xs text-destructive mt-1">Campo obbligatorio</p>}
            </div>

            <div>
              <Label className="font-body text-sm font-semibold">
                Descrizione <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={description}
                onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: false })); }}
                placeholder="Spiega cosa si fa, perché è interessante e che tipo di esperienza è"
                rows={5}
                className={`mt-1 min-h-[120px] ${errors.description ? "border-destructive" : ""}`}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Più dettagli dai, più è facile approvarla</p>
              {errors.description && <p className="text-xs text-destructive mt-0.5">Campo obbligatorio</p>}
            </div>
          </div>

          {/* SECTION 2 – Quando e dove */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-foreground border-b border-border pb-1">
              Quando e dove
            </h3>

            <div>
              <Label className="font-body text-sm font-semibold">
                Luogo <span className="text-destructive">*</span>
              </Label>
              <LocationAutocomplete
                value={location}
                onChange={(val) => { setLocation(val); setErrors(p => ({ ...p, location: false })); }}
                placeholder="Cerca luogo…"
                error={errors.location}
              />
              {errors.location && <p className="text-xs text-destructive mt-1">Campo obbligatorio</p>}
            </div>

            <div>
              <Label className="font-body text-sm font-semibold">Nome del luogo (facoltativo)</Label>
              <Input
                value={locationLabel}
                onChange={e => setLocationLabel(e.target.value)}
                placeholder="es. Metro La Rustica"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Se vuoto, verrà mostrato l'indirizzo completo</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm font-semibold">Data (opzionale)</Label>
                <Input type="date" value={suggestedDate} onChange={e => setSuggestedDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="font-body text-sm font-semibold">Orario (opzionale)</Label>
                <Input type="time" value={suggestedTime} onChange={e => setSuggestedTime(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>

          {/* SECTION 3 – Dettagli */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-foreground border-b border-border pb-1">
              Dettagli utili
            </h3>

            <div>
              <Label className="font-body text-sm font-semibold">Numero indicativo partecipanti</Label>
              <Input
                value={maxParticipants}
                onChange={e => setMaxParticipants(e.target.value)}
                placeholder="Es. 10–15 persone"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="font-body text-sm font-semibold">
                Che tipo di esperienza è? <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(categories || []).map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setCategoryId(cat.id); setErrors(p => ({ ...p, category: false })); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all active:scale-95 ${
                      categoryId === cat.id
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    } ${errors.category && !categoryId ? "ring-1 ring-destructive" : ""}`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
              {errors.category && <p className="text-xs text-destructive mt-1">Seleziona una categoria</p>}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Invio in corso...</>
            ) : (
              <>Invia proposta <Rocket className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityProposalForm;
