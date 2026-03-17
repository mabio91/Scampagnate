import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Percent, Hash, Ticket, Copy, Pencil, Loader2, User, Calendar, Search, X } from "lucide-react";
import { format } from "date-fns";

interface UserSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

const UserSearchInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (userId: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load selected user info when value is set (e.g. editing)
  useEffect(() => {
    if (value && !selectedUser) {
      supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("id", value)
        .single()
        .then(({ data }) => {
          if (data) setSelectedUser(data as UserSearchResult);
        });
    }
    if (!value) setSelectedUser(null);
  }, [value]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["user-search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8);
      if (error) throw error;
      return data as UserSearchResult[];
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedUser) {
    return (
      <div className="flex items-center gap-2 border rounded-md p-2 bg-muted/30">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {selectedUser.first_name} {selectedUser.last_name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {selectedUser.email || selectedUser.id.slice(0, 8) + "..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSelectedUser(null); onChange(""); setQuery(""); }}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Search by name or email..."
          className="pl-8 text-xs"
        />
        {isFetching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {isOpen && results && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
              onClick={() => {
                setSelectedUser(u);
                onChange(u.id);
                setIsOpen(false);
                setQuery("");
              }}
            >
              <p className="text-xs font-medium">{u.first_name} {u.last_name}</p>
              <p className="text-[10px] text-muted-foreground">{u.email || u.id.slice(0, 8) + "..."}</p>
            </button>
          ))}
        </div>
      )}
      {isOpen && query.length >= 2 && !isFetching && results?.length === 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-md p-3">
          <p className="text-xs text-muted-foreground text-center">No users found</p>
        </div>
      )}
    </div>
  );
};

interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  event_ids: string[] | null;
  applies_to_all: boolean;
  max_uses: number | null;
  times_used: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  is_single_use: boolean;
  assigned_user_id: string | null;
  created_by: string | null;
  created_at: string;
}

const DiscountCodesPanel = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);

  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: 10,
    applies_to_all: false,
    event_ids_text: "",
    max_uses: "",
    starts_at: "",
    expires_at: "",
    is_single_use: false,
    assigned_user_id: "",
  });

  const { data: codes, isLoading } = useQuery({
    queryKey: ["discount-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DiscountCode[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["all-events-for-discount"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date")
        .in("status", ["available", "published", "full"])
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (isEdit: boolean) => {
      const payload: any = {
        code: form.code.toUpperCase().trim(),
        description: form.description,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        applies_to_all: isAdmin ? form.applies_to_all : false,
        event_ids: form.event_ids_text
          ? form.event_ids_text.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
        is_single_use: form.is_single_use,
        assigned_user_id: form.assigned_user_id.trim() || null,
        created_by: user?.id,
      };

      if (isEdit && editingCode) {
        const { error } = await supabase
          .from("discount_codes")
          .update(payload)
          .eq("id", editingCode.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discount_codes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
      queryClient.invalidateQueries({ queryKey: ["active-discounts"] });
      toast({ title: editingCode ? "Code updated" : "Code created" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("discount_codes")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
      queryClient.invalidateQueries({ queryKey: ["active-discounts"] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingCode(null);
    setForm({
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      applies_to_all: false,
      event_ids_text: "",
      max_uses: "",
      starts_at: "",
      expires_at: "",
      is_single_use: false,
      assigned_user_id: "",
    });
  };

  const openEdit = (code: DiscountCode) => {
    setEditingCode(code);
    setForm({
      code: code.code,
      description: code.description,
      discount_type: code.discount_type as "percentage" | "fixed",
      discount_value: code.discount_value,
      applies_to_all: code.applies_to_all,
      event_ids_text: code.event_ids?.join(", ") || "",
      max_uses: code.max_uses?.toString() || "",
      starts_at: code.starts_at ? code.starts_at.split("T")[0] : "",
      expires_at: code.expires_at ? code.expires_at.split("T")[0] : "",
      is_single_use: code.is_single_use,
      assigned_user_id: code.assigned_user_id || "",
    });
    setShowForm(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copied!" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">Discount Codes</h2>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Code
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !codes?.length ? (
        <Card className="p-6 text-center">
          <Ticket className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground font-body">No discount codes yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => (
            <Card key={code.id} className={`p-4 space-y-2 ${!code.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => copyCode(code.code)} className="flex items-center gap-1.5 font-mono text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                    {code.code}
                    <Copy className="h-3 w-3" />
                  </button>
                  <Badge variant={code.is_active ? "default" : "secondary"} className="text-[10px]">
                    {code.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {code.is_single_use && (
                    <Badge variant="outline" className="text-[10px]">Single-use</Badge>
                  )}
                  {code.assigned_user_id && (
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      <User className="h-2.5 w-2.5" /> Personal
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(code)} className="text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <Switch
                    checked={code.is_active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: code.id, is_active: checked })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-body">{code.description || "No description"}</p>
              <div className="flex flex-wrap gap-2 text-[10px] font-body text-muted-foreground">
                <span className="flex items-center gap-1">
                  {code.discount_type === "percentage" ? <Percent className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                  {code.discount_type === "percentage" ? `${code.discount_value}%` : `€${code.discount_value}`} off
                </span>
                <span>• Used {code.times_used}{code.max_uses ? `/${code.max_uses}` : ""} times</span>
                {code.applies_to_all && <span>• All events</span>}
                {code.event_ids && !code.applies_to_all && <span>• {code.event_ids.length} event(s)</span>}
                {code.starts_at && (
                  <span>• From {format(new Date(code.starts_at), "dd MMM yyyy")}</span>
                )}
                {code.expires_at && (
                  <span>• Until {format(new Date(code.expires_at), "dd MMM yyyy")}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingCode ? "Edit Discount Code" : "New Discount Code"}</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Create a promotional discount code for events.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. SCAMPAGNA10"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Early bird discount, referral code, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v: any) => setForm((f) => ({ ...f, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.discount_value}
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: Number(e.target.value) }))}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between">
                <Label>Applies to all events</Label>
                <Switch
                  checked={form.applies_to_all}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, applies_to_all: checked }))}
                />
              </div>
            )}

            {!form.applies_to_all && (
              <div>
                <Label>Applicable Events</Label>
                <div className="mt-1 max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                  {events?.map((evt) => {
                    const selected = form.event_ids_text.split(",").map((s) => s.trim()).includes(evt.id);
                    return (
                      <label key={evt.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const ids = form.event_ids_text.split(",").map((s) => s.trim()).filter(Boolean);
                            const newIds = selected ? ids.filter((i) => i !== evt.id) : [...ids, evt.id];
                            setForm((f) => ({ ...f, event_ids_text: newIds.join(", ") }));
                          }}
                          className="rounded"
                        />
                        <span className="text-xs font-body truncate">{evt.title}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(evt.date), "dd/MM")}</span>
                      </label>
                    );
                  })}
                  {!events?.length && <p className="text-xs text-muted-foreground p-2">No events available</p>}
                </div>
              </div>
            )}

            {/* Validity Period */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Validity Period
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Starts</Label>
                  <Input
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expires</Label>
                  <Input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Max Uses</Label>
              <Input
                type="number"
                min={1}
                value={form.max_uses}
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                placeholder="Unlimited"
              />
            </div>

            {/* Advanced: Single-use & User Assignment */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-foreground">Advanced Options</p>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Single-use per user</Label>
                  <p className="text-[11px] text-muted-foreground">Each user can use this code only once across all events</p>
                </div>
                <Switch
                  checked={form.is_single_use}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, is_single_use: checked }))}
                />
              </div>

              <div>
                <Label className="text-sm">Assign to specific user (UUID)</Label>
                <p className="text-[11px] text-muted-foreground mb-1">Leave empty for public codes. Paste user ID for personalized codes.</p>
                <Input
                  value={form.assigned_user_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_user_id: e.target.value.trim() }))}
                  placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <Button
              onClick={() => saveMutation.mutate(!!editingCode)}
              disabled={!form.code.trim() || form.discount_value <= 0 || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : editingCode ? "Update Code" : "Create Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscountCodesPanel;
