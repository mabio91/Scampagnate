import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

type BroadcastTemplate = {
  id: string;
  title: string;
  message: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const emptyForm = {
  title: "",
  message: "",
  sort_order: "0",
};

const BroadcastTemplatesPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BroadcastTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["broadcast-message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broadcast_message_templates")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as BroadcastTemplate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        sort_order: Number.parseInt(form.sort_order || "0", 10) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("broadcast_message_templates")
          .update(payload)
          .eq("id", editingTemplate.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("broadcast_message_templates").insert({
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-message-templates"] });
      toast({ title: editingTemplate ? "Template updated" : "Template created" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("broadcast_message_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-message-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setEditingTemplate(null);
    setForm(emptyForm);
    setShowForm(false);
  };

  const openEdit = (template: BroadcastTemplate) => {
    setEditingTemplate(template);
    setForm({
      title: template.title,
      message: template.message,
      sort_order: String(template.sort_order),
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">Broadcast Templates</h2>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !templates?.length ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground font-body">No broadcast templates yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <Card key={template.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body font-semibold text-sm text-foreground">{template.title}</p>
                  <p className="text-[11px] text-muted-foreground font-body mt-1">
                    Order: {template.sort_order}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(template)} className="text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(template.id)}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-body whitespace-pre-line">
                {template.message}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingTemplate ? "Edit Broadcast Template" : "New Broadcast Template"}
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              Configure reusable quick templates for the event broadcast modal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                placeholder="e.g. Time change"
              />
            </div>

            <div>
              <Label>Message</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
                rows={5}
                placeholder='Use {{event_title}} to inject the event name.'
                className="font-body"
              />
            </div>

            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((current) => ({ ...current, sort_order: e.target.value }))}
              />
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || !form.message.trim() || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BroadcastTemplatesPanel;
