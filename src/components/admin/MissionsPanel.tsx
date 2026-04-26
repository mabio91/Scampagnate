import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit3, Trash2, Target, Gift, Trophy, Ticket } from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";

interface MissionFormData {
  title: string;
  description: string;
  type: string;
  target_action: string;
  target_value: number;
  reward_points: number;
  reward_type: string;
  reward_value: string;
  reward_badge_id: string;
  category: string;
  icon: string;
  is_active: boolean;
  reset_on_failure: boolean;
  streak_count: number | null;
  expires_at: string;
}

const EMPTY_FORM: MissionFormData = {
  title: "",
  description: "",
  type: "one_time",
  target_action: "event_attended",
  target_value: 1,
  reward_points: 10,
  reward_type: "points",
  reward_value: "",
  reward_badge_id: "",
  category: "",
  icon: "🎯",
  is_active: true,
  reset_on_failure: false,
  streak_count: null,
  expires_at: "",
};

const TYPE_LABELS: Record<string, string> = {
  one_time: "Una tantum",
  weekly: "Settimanale",
  monthly: "Mensile",
  progressive: "Progressiva",
  streak: "Streak",
  category: "Per categoria",
};

const ACTION_LABELS: Record<string, string> = {
  event_attended: "Evento completato",
  event_registered: "Iscrizione evento",
  category_attended: "Categoria completata",
  streak_weekly: "Streak settimanale",
  limited_spots: "Evento ultimi posti",
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  points: "Solo punti",
  coupon: "Coupon sconto",
  badge: "Badge",
  physical: "Premio fisico",
};

const MissionsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MissionFormData>(EMPTY_FORM);

  const { data: missions, isLoading } = useQuery({
    queryKey: ["admin-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: badges } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("id, name, icon");
      return data || [];
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      title: m.title,
      description: m.description,
      type: m.type,
      target_action: m.target_action,
      target_value: m.target_value,
      reward_points: m.reward_points,
      reward_type: m.reward_type || "points",
      reward_value: m.reward_value || "",
      reward_badge_id: m.reward_badge_id || "",
      category: m.category || "",
      icon: m.icon || "🎯",
      is_active: m.is_active,
      reset_on_failure: m.reset_on_failure,
      streak_count: m.streak_count,
      expires_at: m.expires_at ? m.expires_at.split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        type: form.type,
        target_action: form.target_action,
        target_value: form.target_value,
        reward_points: form.reward_points,
        reward_type: form.reward_type,
        reward_value: form.reward_value || null,
        reward_badge_id: form.reward_badge_id || null,
        category: form.category || null,
        icon: form.icon,
        is_active: form.is_active,
        reset_on_failure: form.reset_on_failure,
        streak_count: form.streak_count,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from("missions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("missions").insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      queryClient.invalidateQueries({ queryKey: ["active-missions"] });
      toast({ title: editingId ? "Missione aggiornata" : "Missione creata" });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const deleteMission = async (id: string) => {
    try {
      const { error } = await supabase.from("missions").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      toast({ title: "Missione eliminata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("missions").update({ is_active: !current, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground font-body">{missions?.length || 0} missioni</p>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuova missione
        </Button>
      </div>

      <div className="space-y-3">
        {missions?.map((m: any) => (
          <Card key={m.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <DynamicIcon value={m.icon} size={18} className="text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-display font-bold text-sm text-foreground truncate">{m.title}</h4>
                  <p className="text-xs font-body text-muted-foreground line-clamp-1">{m.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={m.is_active ? "default" : "outline"} className="text-[10px]">
                  {m.is_active ? "Attiva" : "Inattiva"}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {TYPE_LABELS[m.type] || m.type}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-body text-muted-foreground">
              <span className="flex items-center gap-1"><Target className="h-3 w-3" />{ACTION_LABELS[m.target_action] || m.target_action} × {m.target_value}</span>
              <span className="flex items-center gap-1"><Gift className="h-3 w-3" />+{m.reward_points} pt</span>
              {m.reward_type !== "points" && (
                <span className="flex items-center gap-1">
                  {m.reward_type === "coupon" ? <Ticket className="h-3 w-3" /> : m.reward_type === "badge" ? <Trophy className="h-3 w-3" /> : <Gift className="h-3 w-3" />}
                  {REWARD_TYPE_LABELS[m.reward_type] || m.reward_type}
                </span>
              )}
              {m.category && <span>Categoria: {m.category}</span>}
              {m.expires_at && <span>Scade: {new Date(m.expires_at).toLocaleDateString("it-IT")}</span>}
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openEdit(m)}>
                <Edit3 className="h-3 w-3 mr-1" /> Modifica
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => toggleActive(m.id, m.is_active)}>
                {m.is_active ? "Disattiva" : "Attiva"}
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 text-destructive" onClick={() => deleteMission(m.id)}>
                <Trash2 className="h-3 w-3 mr-1" /> Elimina
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? "Modifica missione" : "Nuova missione"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div>
                <Label className="text-xs font-body">Icona</Label>
                <Input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} className="mt-1 text-center text-lg" />
              </div>
              <div>
                <Label className="text-xs font-body">Titolo</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-body">Descrizione</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-body">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-body">Azione target</Label>
                <Select value={form.target_action} onValueChange={v => setForm(p => ({ ...p, target_action: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-body">Obiettivo (n. eventi)</Label>
                <Input type="number" min={1} value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: parseInt(e.target.value) || 1 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-body">Punti ricompensa</Label>
                <Input type="number" min={0} value={form.reward_points} onChange={e => setForm(p => ({ ...p, reward_points: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-body">Tipo ricompensa</Label>
              <Select value={form.reward_type} onValueChange={v => setForm(p => ({ ...p, reward_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REWARD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.reward_type === "coupon" && (
              <div>
                <Label className="text-xs font-body">Valore coupon (es. -10%, -€5)</Label>
                <Input value={form.reward_value} onChange={e => setForm(p => ({ ...p, reward_value: e.target.value }))} className="mt-1" placeholder="es. -10%" />
              </div>
            )}

            {form.reward_type === "physical" && (
              <div>
                <Label className="text-xs font-body">Descrizione premio fisico</Label>
                <Input value={form.reward_value} onChange={e => setForm(p => ({ ...p, reward_value: e.target.value }))} className="mt-1" placeholder="es. Drink gratuito" />
              </div>
            )}

            {form.reward_type === "badge" && (
              <div>
                <Label className="text-xs font-body">Badge da assegnare</Label>
                <Select value={form.reward_badge_id} onValueChange={v => setForm(p => ({ ...p, reward_badge_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona badge" /></SelectTrigger>
                  <SelectContent>
                    {badges?.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-body">Categoria evento (opzionale)</Label>
              <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="mt-1" placeholder="es. Trekking & Outdoor" />
            </div>

            {(form.type === "streak") && (
              <div>
                <Label className="text-xs font-body">Streak richiesto (settimane)</Label>
                <Input type="number" min={1} value={form.streak_count || ""} onChange={e => setForm(p => ({ ...p, streak_count: parseInt(e.target.value) || null }))} className="mt-1" />
              </div>
            )}

            <div>
              <Label className="text-xs font-body">Scadenza (opzionale)</Label>
              <Input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} className="mt-1" />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-body">Attiva</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-body">Reset progresso su no-show</Label>
              <Switch checked={form.reset_on_failure} onCheckedChange={v => setForm(p => ({ ...p, reset_on_failure: v }))} />
            </div>

            <Button onClick={save} className="w-full">{editingId ? "Salva modifiche" : "Crea missione"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MissionsPanel;
