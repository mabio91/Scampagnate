import { useState } from "react";
import { useParams, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEventRegistrations, useEventMeetingPoints } from "@/hooks/useOrganizerEvents";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDepositPaymentLabel, isDepositRegistration } from "@/lib/eventPayments";
import {
  getOptionBalancePaymentMode,
  getOptionPaymentSummary,
  getOptionPaymentType,
  getOptionRemainingSpots,
  isWaitlistEnabledForEvent,
  type PriceOptionLike,
} from "@/lib/priceOptions";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Edit, Users, CheckCircle2, Download, UserPlus, UserMinus,
  Loader2, Zap, BarChart3, Trash2, Send, Search, Copy,
  MessageCircle, Bell, AlertTriangle, History,
  FileEdit, Eye, CircleOff, Lock, XCircle, Archive, UserCog, Instagram,
  MoreVertical
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import EventAnalytics from "@/components/events/EventAnalytics";
import { instagramProfileUrl } from "@/lib/instagram";

const NO_PRICE_OPTION = "__none__";
const NO_MEETING_POINT = "__no_meeting_point__";
const ALL_PRICE_OPTIONS = "__all_price_options__";

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "In attesa pagamento" },
  { value: "deposit_paid", label: "Acconto effettuato" },
  { value: "paid", label: "Pagamento effettuato" },
  { value: "pay_on_location", label: "Pagamento in loco" },
  { value: "not_required", label: "Pagamento non richiesto" },
];

const REGISTRATION_STATUS_OPTIONS = [
  { value: "registered", label: "Iscritto" },
  { value: "waitlist", label: "In lista d'attesa" },
  { value: "pending_approval", label: "In attesa di approvazione" },
];

const EVENT_STATUS_OPTIONS = [
  { value: "draft", label: "Non pubblicato", icon: FileEdit, iconClassName: "text-muted-foreground" },
  { value: "upcoming", label: "In arrivo", icon: Archive, iconClassName: "text-warning" },
  { value: "open", label: "Aperto", icon: Eye, iconClassName: "text-success" },
  { value: "closed", label: "Iscrizioni chiuse", icon: Lock, iconClassName: "text-muted-foreground" },
  { value: "full", label: "Sold out", icon: CircleOff, iconClassName: "text-destructive" },
  { value: "rescheduled", label: "Riprogrammato", icon: Archive, iconClassName: "text-warning" },
  { value: "cancelled", label: "Annullato", icon: XCircle, iconClassName: "text-destructive" },
];

const CONFIRMED_PARTICIPANT_STATUSES = ["registered", "deposit_paid", "paid", "attended", "no_show"];

const isConfirmedEffectiveRegistration = (registration: {
  status?: string | null;
  payment_status?: string | null;
}) =>
  CONFIRMED_PARTICIPANT_STATUSES.includes(registration.status || "") &&
  registration.payment_status !== "pending";

const ProfileField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="rounded-lg border border-border p-2">
    <p className="text-[10px] font-body text-muted-foreground">{label}</p>
    <p className="text-xs font-body font-semibold text-foreground">{value || "-"}</p>
  </div>
);

const normalizeEditableEventStatus = (status?: string | null) => {
  if (status === "available" || status === "published") return "open";
  if (status === "unpublished") return "draft";
  if (status === "past" || status === "completed") return "closed";
  return EVENT_STATUS_OPTIONS.some((option) => option.value === status) ? status! : "open";
};

const EventManage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOrganizer, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quickCheckIn, setQuickCheckIn] = useState(false);
  const [meetingPointFilter, setMeetingPointFilter] = useState<string>("all");
  const [checkInSearch, setCheckInSearch] = useState("");
  const [checkInMpFilter, setCheckInMpFilter] = useState<string>("all");

  // Dialogs
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [participantFilter, setParticipantFilter] = useState<"all" | "participants" | "deposit_paid" | "attended" | "waitlist" | "price_option">("all");
  const [pendingCancelRegistrationId, setPendingCancelRegistrationId] = useState<string | null>(null);

  // Add participant state
  const [addMode, setAddMode] = useState<"search" | "manual">("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualLevel, setManualLevel] = useState<string>("none");
  const [manualMeetingPoint, setManualMeetingPoint] = useState("");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("not_required");
  const [manualPriceOptionId, setManualPriceOptionId] = useState("");
  const [selectedPriceOptionFilter, setSelectedPriceOptionFilter] = useState(ALL_PRICE_OPTIONS);
  const [selectedSearchUser, setSelectedSearchUser] = useState<any>(null);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editMeetingPoint, setEditMeetingPoint] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const [editPriceOptionId, setEditPriceOptionId] = useState(NO_PRICE_OPTION);
  const [selectedProfileRegistration, setSelectedProfileRegistration] = useState<any | null>(null);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [savingOwnerId, setSavingOwnerId] = useState<string | null>(null);

  // Message state
  const [messageText, setMessageText] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastChannel, setBroadcastChannel] = useState<"notification" | "whatsapp">("notification");
  const [sendingBalanceReminder, setSendingBalanceReminder] = useState(false);

  const { data: broadcastTemplates } = useQuery({
    queryKey: ["broadcast-message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broadcast_message_templates")
        .select("id, title, message, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Broadcast history
  const { data: broadcastHistory } = useQuery({
    queryKey: ["event-broadcasts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_broadcasts")
        .select("*")
        .eq("event_id", id!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Capacity state
  const [newCapacity, setNewCapacity] = useState(0);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_categories(name, icon)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: registrations, isLoading: regsLoading } = useEventRegistrations(id!);
  const { data: meetingPoints } = useEventMeetingPoints(id!);

  // Fetch price options for this event
  const { data: priceOptions } = useQuery({
    queryKey: ["event-price-options", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_price_options")
        .select("*")
        .eq("event_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: ownerOptions = [] } = useQuery({
    queryKey: ["organizer-owner-options"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "organizer"]);
      if (rolesError) throw rolesError;

      const userIds = Array.from(new Set((roles || []).map((role: any) => role.user_id).filter(Boolean)));
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const roleMap = new Map<string, string[]>();
      (roles || []).forEach((role: any) => {
        if (!role.user_id) return;
        roleMap.set(role.user_id, [...(roleMap.get(role.user_id) || []), role.role]);
      });

      return (profiles || [])
        .map((profile: any) => ({
          id: profile.id,
          name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || `Utente ${String(profile.id).slice(0, 8)}`,
          email: profile.email,
          avatarUrl: profile.avatar_url,
          role: roleMap.get(profile.id)?.includes("admin") ? "admin" : "organizer",
        }))
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    },
    enabled: !!user && isAdmin,
  });

  // Search users for adding existing participants
  const { data: searchResults } = useQuery({
    queryKey: ["search-users", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, phone")
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(10);
      return data || [];
    },
    enabled: addMode === "search" && searchQuery.length >= 2,
  });

  if (authLoading) return null;
  if (!user || !isOrganizer) return <Navigate to="/" replace />;

  const registered = registrations?.filter((r) =>
    ["registered", "deposit_paid", "paid", "attended", "no_show"].includes(r.status)
  ) || [];
  const waitlisted = registrations?.filter((r) => r.status === "waitlist") || [];
  const cancelled = registrations?.filter((r) => r.status === "cancelled") || [];
  const pending = registrations?.filter((r) => r.status === "pending_approval") || [];
  const sortedPriceOptions = ((priceOptions || []) as PriceOptionLike[]).slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const hasPriceOptions = sortedPriceOptions.length > 0;
  const defaultPriceOptionId = sortedPriceOptions[0]?.id || "";
  const currentManualPriceOptionId = manualPriceOptionId || defaultPriceOptionId;
  const normalizePriceOptionId = (value: string) => value && value !== NO_PRICE_OPTION ? value : null;
  const getPriceOptionForRegistration = (reg: any) =>
    sortedPriceOptions.find((option) => option.id === reg.price_option_id) || null;
  const getOptionActiveCount = (optionId: string | null | undefined) =>
    registered.filter((reg) => reg.price_option_id === optionId).length;
  const getOptionWaitlistCount = (optionId: string | null | undefined) =>
    waitlisted.filter((reg) => reg.price_option_id === optionId).length;
  const depositPaid = registered.filter((r) => isDepositRegistration(r));
  const attended = registered.filter((r) => r.status === "attended");
  const checkedIn = attended;
  const reservedSpots = (event as any)?.reserved_spots || 0;
  const hasDepositPayments = event?.payment_type === "deposit"
    || sortedPriceOptions.some((option) => getOptionPaymentType(option, event || {}) === "deposit");
  const filteredOwnerOptions = ownerOptions.filter((option) => {
    const query = ownerSearch.trim().toLowerCase();
    if (!query) return true;
    return option.name.toLowerCase().includes(query)
      || (option.email || "").toLowerCase().includes(query)
      || option.role.toLowerCase().includes(query);
  });

  const invalidateParticipantCounts = () => {
    queryClient.invalidateQueries({ queryKey: ["event-registrations", id] });
    queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["event", id] });
    queryClient.invalidateQueries({ queryKey: ["event-participants", id] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
  };

  const openAddParticipantDialog = (mode: "search" | "manual") => {
    setAddMode(mode);
    setManualPriceOptionId(defaultPriceOptionId);
    setShowAddParticipant(true);
  };

  const getParticipantName = (reg: any) => {
    if (reg.sport_level?.startsWith("manual:")) {
      return { firstName: reg.sport_level.replace("manual:", "").split("|")[0], lastName: "(manual)", isManual: true };
    }
    return {
      firstName: (reg.profiles as any)?.first_name || "?",
      lastName: (reg.profiles as any)?.last_name || "",
      isManual: false,
    };
  };

  const filteredRegisteredBase = meetingPointFilter === "all"
    ? registered
    : registered.filter((r) => r.meeting_point_id === meetingPointFilter);

  const filteredRegistered = filteredRegisteredBase.filter((r) => {
    if (participantFilter === "participants") return true;
    if (participantFilter === "deposit_paid") return r.status === "deposit_paid";
    if (participantFilter === "attended") return r.status === "attended";
    if (participantFilter === "waitlist") return false;
    if (participantFilter === "price_option") {
      if (selectedPriceOptionFilter === ALL_PRICE_OPTIONS) return true;
      return (r as any).price_option_id === selectedPriceOptionFilter;
    }
    return true;
  });

  const depositReminderCandidates = depositPaid.filter((r) => {
    if (r.sport_level?.startsWith("manual:")) return false;
    return getOptionBalancePaymentMode(getPriceOptionForRegistration(r), event || {}) === "online";
  });

  // Check-in filtered list (by meeting point + search)
  const filteredCheckIn = registered.filter((r) => {
    if (checkInMpFilter !== "all" && r.meeting_point_id !== checkInMpFilter) return false;
    if (checkInSearch) {
      const { firstName, lastName } = getParticipantName(r);
      const name = `${firstName} ${lastName}`.toLowerCase();
      if (!name.includes(checkInSearch.toLowerCase())) return false;
    }
    return true;
  });

  const handleCheckIn = async (regId: string, currentState: boolean) => {
    const { error } = await supabase
      .from("event_registrations")
      .update({ checked_in: !currentState })
      .eq("id", regId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      invalidateParticipantCounts();
    }
  };

  const handleStatusChange = async (regId: string, newStatus: string) => {
    const { error } = await supabase
      .from("event_registrations")
      .update({
        status: newStatus as any,
        cancelled_at: newStatus === "cancelled" ? new Date().toISOString() : null,
      } as any)
      .eq("id", regId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      invalidateParticipantCounts();
      toast({ title: `Status updated to ${newStatus}` });
    }
  };

  const handlePromoteFromWaitlist = async (regId: string) => {
    await handleStatusChange(regId, "registered");
  };

  const handleApprovePending = async (regId: string, toWaitlist: boolean = false) => {
    await handleStatusChange(regId, toWaitlist ? "waitlist" : "registered");
  };

  const handleCancelRegistration = async (regId: string) => {
    await handleStatusChange(regId, "cancelled");
  };

  const sendBalanceReminders = async (registrationIds?: string[]) => {
    if (!event) return;

    const reminderCooldownMs = 12 * 60 * 60 * 1000;
    const candidates = depositReminderCandidates.filter((reg) => {
      if (!registrationIds?.length) return true;
      return registrationIds.includes(reg.id);
    }).filter((reg) => {
      const lastReminder = (reg as any).last_balance_reminder_sent_at;
      if (!lastReminder) return true;
      return Date.now() - new Date(lastReminder).getTime() > reminderCooldownMs;
    });

    if (candidates.length === 0) {
      toast({ title: "Nessun partecipante da sollecitare" });
      return;
    }

    const nowIso = new Date().toISOString();
    setSendingBalanceReminder(true);
    try {
      const notifications = candidates.map((reg) => ({
        user_id: reg.user_id,
        type: "deposit_balance_reminder",
        title: event.title,
        message: "Completa il saldo per confermare definitivamente la partecipazione",
        event_id: event.id,
      }));

      const { error: notifError } = await supabase.from("notifications").insert(notifications);
      if (notifError) throw notifError;

      await Promise.allSettled(
        candidates.map((reg) =>
          supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: reg.user_id,
              title: event.title,
              message: "Completa il saldo per confermare definitivamente la partecipazione",
              event_id: event.id,
              type: "deposit_balance_reminder",
            },
          }),
        ),
      );

      await supabase
        .from("event_registrations")
        .update({ last_balance_reminder_sent_at: nowIso } as any)
        .in("id", candidates.map((reg) => reg.id));

      invalidateParticipantCounts();
      toast({ title: "Notifica inviata con successo" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSendingBalanceReminder(false);
    }
  };

  // Select a searched user (don't add yet, show edit form first)
  const handleSelectSearchUser = (user: any) => {
    setSelectedSearchUser(user);
    setSearchQuery("");
  };

  // Confirm adding the selected searched user
  const handleConfirmAddSearchUser = async () => {
    if (!selectedSearchUser) return;
    if (hasPriceOptions && !currentManualPriceOptionId) {
      toast({ title: "Seleziona un'opzione prezzo", variant: "destructive" });
      return;
    }
    setAddingParticipant(true);
    try {
      const { error } = await supabase.from("event_registrations").insert({
        event_id: id!,
        user_id: selectedSearchUser.id,
        added_by: user?.id ?? null,
        meeting_point_id: manualMeetingPoint || null,
        price_option_id: hasPriceOptions ? normalizePriceOptionId(currentManualPriceOptionId) : null,
        status: "registered",
        payment_status: manualPaymentStatus,
      });
      if (error) throw error;
      invalidateParticipantCounts();
      setShowAddParticipant(false);
      setSelectedSearchUser(null);
      setSearchQuery("");
      setManualMeetingPoint("");
      setManualPaymentStatus("not_required");
      setManualPriceOptionId(defaultPriceOptionId);
      toast({ title: "Participant added!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingParticipant(false);
    }
  };

  // Update meeting point or payment status on existing registration
  const handleUpdateRegistration = async (regId: string, updates: { meeting_point_id?: string | null; payment_status?: string; price_option_id?: string | null }) => {
    const { error } = await supabase
      .from("event_registrations")
      .update(updates)
      .eq("id", regId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      invalidateParticipantCounts();
      setEditingParticipant(null);
      toast({ title: "Participant updated" });
    }
  };

  const registrationMenuValue = (reg: any) => {
    if (reg.status === "waitlist" || reg.status === "pending_approval") return reg.status;
    if (["registered", "deposit_paid", "paid", "attended", "pending_payment"].includes(reg.status)) return "registered";
    return undefined;
  };

  const paymentMenuValue = (reg: any) => {
    if (reg.payment_status) return reg.payment_status;
    if (reg.status === "deposit_paid") return "deposit_paid";
    if (reg.status === "paid") return "paid";
    return "pending";
  };

  const meetingPointOptionLabel = (point: any, index: number) =>
    `Punto ${index + 1} - ${point.name || "Ritrovo"}`;

  const renderParticipantOptionsMenu = (reg: any) => {
    const isManual = reg.sport_level?.startsWith("manual:");
    const currentRegistrationStatus = registrationMenuValue(reg);
    const currentMeetingPoint = reg.meeting_point_id || NO_MEETING_POINT;
    const currentPriceOption = (reg as any).price_option_id || NO_PRICE_OPTION;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Opzioni partecipante">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Azioni</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={isManual || !reg.user_id}
            onSelect={() => setSelectedProfileRegistration(reg)}
          >
            Apri profilo
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (reg.status !== "no_show") void handleStatusChange(reg.id, "no_show");
            }}
          >
            <span className="flex items-center gap-2">
              {reg.status === "no_show" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              <span>Segna come no-show</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPendingCancelRegistrationId(reg.id)}>
            Rimuovi dall'evento
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Iscrizione</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentRegistrationStatus}
            onValueChange={(value) => {
              if (value && value !== currentRegistrationStatus) void handleStatusChange(reg.id, value);
            }}
          >
            {REGISTRATION_STATUS_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Pagamento</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={paymentMenuValue(reg)}
            onValueChange={(value) => {
              if (value && value !== paymentMenuValue(reg)) {
                void handleUpdateRegistration(reg.id, { payment_status: value });
              }
            }}
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Punto di ritrovo</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentMeetingPoint}
            onValueChange={(value) => {
              if (value !== currentMeetingPoint) {
                void handleUpdateRegistration(reg.id, {
                  meeting_point_id: value === NO_MEETING_POINT ? null : value,
                });
              }
            }}
          >
            <DropdownMenuRadioItem value={NO_MEETING_POINT}>Nessun ritrovo</DropdownMenuRadioItem>
            {(meetingPoints || []).map((mp, index) => (
              <DropdownMenuRadioItem key={mp.id} value={mp.id}>
                {meetingPointOptionLabel(mp, index)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Formula prezzo</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentPriceOption}
            onValueChange={(value) => {
              if (value !== currentPriceOption) {
                void handleUpdateRegistration(reg.id, {
                  price_option_id: value === NO_PRICE_OPTION ? null : value,
                });
              }
            }}
          >
            <DropdownMenuRadioItem value={NO_PRICE_OPTION}>Nessuna formula</DropdownMenuRadioItem>
            {sortedPriceOptions.map((option) => (
              <DropdownMenuRadioItem key={option.id || option.name || "option"} value={option.id || NO_PRICE_OPTION}>
                {option.name || "Formula"}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Add manual participant (profile-less registration). Keep user_id null so
  // created-by/admin identity is never treated as the participant.
  const handleAddManualParticipant = async () => {
    if (!manualName.trim()) return;
    if (hasPriceOptions && !currentManualPriceOptionId) {
      toast({ title: "Seleziona un'opzione prezzo", variant: "destructive" });
      return;
    }
    setAddingParticipant(true);
    try {
      const levelPayload = manualLevel && manualLevel !== "none" ? `|level:${manualLevel}` : "";
      const { error } = await supabase.from("event_registrations").insert({
        event_id: id!,
        user_id: null,
        added_by: user?.id ?? null,
        meeting_point_id: manualMeetingPoint || null,
        price_option_id: hasPriceOptions ? normalizePriceOptionId(currentManualPriceOptionId) : null,
        status: "registered",
        payment_status: manualPaymentStatus,
        sport_level: `manual:${manualName.trim()}${levelPayload}`,
      } as any);
      if (error) throw error;
      invalidateParticipantCounts();
      setShowAddParticipant(false);
      setManualName("");
      setManualLevel("none");
      setManualMeetingPoint("");
      setManualPaymentStatus("not_required");
      setManualPriceOptionId(defaultPriceOptionId);
      toast({ title: `${manualName.trim()} added as participant!` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingParticipant(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async () => {
    try {
      await supabase.from("event_special_badges").delete().eq("event_id", id!);
      await supabase.from("event_broadcasts").delete().eq("event_id", id!);
      // Delete meeting points first
      await supabase.from("event_meeting_points").delete().eq("event_id", id!);
      // Delete registrations
      await supabase.from("event_registrations").delete().eq("event_id", id!);
      await supabase.from("event_price_options").delete().eq("event_id", id!);
      // Delete event
      const { error } = await supabase.from("events").delete().eq("id", id!);
      if (error) throw error;
      toast({ title: "Event deleted" });
      navigate("/organizer");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Update capacity
  const handleUpdateCapacity = async () => {
    if (newCapacity < 1) return;
    const { error } = await supabase.from("events").update({ spots_total: newCapacity }).eq("id", id!);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      invalidateParticipantCounts();
      setShowCapacityDialog(false);
      toast({ title: `Capacity updated to ${newCapacity}` });
    }
  };

  const handleChangeOrganizer = async (owner: { id: string; name: string }) => {
    if (!id || savingOwnerId) return;
    setSavingOwnerId(owner.id);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          organizer_id: owner.id,
          organizer_name: owner.name,
        })
        .eq("id", id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
      setShowOwnerDialog(false);
      toast({ title: "Organizzatore aggiornato" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSavingOwnerId(null);
    }
  };

  const exportCSV = () => {
    const exportRows = filteredRegistered.filter(isConfirmedEffectiveRegistration);
    if (!exportRows.length) return;
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const formatDate = (value: unknown) => {
      const date = new Date(String(value || ""));
      return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy HH:mm");
    };
    const manualNameParts = (sportLevel?: string | null) => {
      if (!sportLevel?.startsWith("manual:")) return null;
      const [name = "", phone = ""] = sportLevel.replace("manual:", "").split("|");
      return { name, phone };
    };
    const formatHealthSafetyStatus = (value?: string | null) => {
      if (value === "none") return "Nessuna da segnalare";
      if (value === "has_info") return "Informazioni da leggere";
      return "Non compilato";
    };
    const formatEmergencyMedication = (value?: boolean | null) => {
      if (value === true) return "Si";
      if (value === false) return "No";
      return "-";
    };
    const formatInterests = (value: unknown) => Array.isArray(value) ? value.filter(Boolean).join("; ") : "";
    const safeFileName = (event?.title || "event")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "") || "event";
    const headers = [
      "Nome",
      "Cognome",
      "Telefono",
      "Instagram",
      "Tipo",
      "Livello registrazione",
      "Formula",
      "Stato",
      "Pagamento",
      "Importo pagato",
      "Rimborso",
      "Ritrovo",
      "Check-in",
      "Registrato",
      "ID tessera",
      "Stato tessera",
      "Data di nascita",
      "Livello esperienza",
      "Esperienza trekking",
      "Frequenza attivita",
      "Grade esperienza",
      "Interessi",
      "Salute e sicurezza",
      "Note salute",
      "Farmaci salvavita",
      "Note farmaci",
      "Supporto richiesto",
    ];
    const rows = exportRows.map((r) => {
      const mp = meetingPoints?.find((p) => p.id === r.meeting_point_id);
      const manual = manualNameParts(r.sport_level);
      const po = getPriceOptionForRegistration(r);
      const profile = (r.profiles as any) || {};
      return [
        manual ? manual.name : (profile.first_name || ""),
        manual ? "(manuale)" : (profile.last_name || ""),
        manual ? manual.phone : (profile.phone || ""),
        manual ? "" : (profile.instagram_handle ? `@${profile.instagram_handle}` : ""),
        manual ? "manuale" : "utente",
        manual ? "-" : (r.sport_level || "-"),
        po?.name || "-",
        r.status || "-",
        r.payment_status || "-",
        (r as any).amount_paid ?? 0,
        (r as any).refund_amount ?? 0,
        mp?.name || "-",
        r.checked_in ? "Si" : "No",
        formatDate(r.created_at),
        manual ? "-" : (profile.membership_id ?? "-"),
        manual ? "-" : (profile.membership_status || "-"),
        manual ? "-" : (profile.birth_date || "-"),
        manual ? "-" : (profile.self_level || "-"),
        manual ? "-" : (profile.trekking_experience || "-"),
        manual ? "-" : (profile.activity_frequency || "-"),
        manual ? "-" : (profile.experience_grade ?? "-"),
        manual ? "-" : (formatInterests(profile.interests) || "-"),
        manual ? "-" : formatHealthSafetyStatus(profile.health_safety_status),
        manual ? "-" : (profile.health_safety_notes || "-"),
        manual ? "-" : formatEmergencyMedication(profile.emergency_medication_has),
        manual ? "-" : (profile.emergency_medication_notes || "-"),
        manual ? "-" : (profile.health_safety_help_notes || "-"),
      ];
    });

    window.setTimeout(() => {
      const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName}-partecipanti.csv`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 0);
  };

  const renderPriceOptionSelect = (value: string, onChange: (value: string) => void) => {
    if (!hasPriceOptions) return null;

    return (
      <div>
        <Label className="font-body text-xs">Formula</Label>
        <Select value={value || defaultPriceOptionId} onValueChange={onChange}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Seleziona formula" />
          </SelectTrigger>
          <SelectContent>
            {sortedPriceOptions.map((option) => (
              <SelectItem key={option.id || option.name || "option"} value={option.id || NO_PRICE_OPTION}>
                <div className="flex flex-col py-0.5">
                  <span>{option.name || "Formula"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {getOptionPaymentSummary(option, event || {})}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };


  if (eventLoading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!event) return <Navigate to="/organizer" replace />;

  return (
    <>
      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/organizer")} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-bold text-foreground truncate">{event.title}</h1>
            <p className="text-xs text-muted-foreground font-body">
              {format(new Date(event.date), "dd MMM yyyy")} · {event.time?.slice(0, 5)}
            </p>
          </div>
          <Select 
              value={normalizeEditableEventStatus(event.status)}
              onValueChange={async (v) => {
                if (v === 'cancelled') {
                  setShowCancelConfirm(true);
                  return;
                }
                const { error } = await supabase.from("events").update({ status: v as any }).eq("id", id!);
                if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
                else { queryClient.invalidateQueries({ queryKey: ["event-detail", id] }); toast({ title: `Event status: ${v}` }); }
              }}
            >
              <SelectTrigger className="w-[168px] h-8 text-xs shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_STATUS_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className={`h-3.5 w-3.5 ${option.iconClassName}`} />
                        {option.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Link to={`/organizer/events/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => navigate(`/organizer/events/new?duplicate=${id}`)}
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isAdmin && (
          <Card className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserCog className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-body font-semibold text-muted-foreground">Organizzatore evento</p>
              <p className="text-sm font-body font-bold text-foreground truncate">{event.organizer_name || "Non assegnato"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowOwnerDialog(true)}>
              Cambia
            </Button>
          </Card>
        )}

        {/* Private/Hidden event link sharing */}
        {event && event.visibility !== "public" && (
          <Card className="p-3 border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-body font-bold text-foreground">
                {event.visibility === "private" ? "Evento privato" : "Evento nascosto"} — Condividi il link
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-[11px] font-body text-muted-foreground truncate select-all">
                {`${window.location.origin}/event/${event.id}`}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/event/${event.id}`);
                  toast({ title: "Link copiato!" });
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copia
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 shrink-0 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/10"
                onClick={() => {
                  const url = `${window.location.origin}/event/${event.id}`;
                  const text = encodeURIComponent(`${event.title} — ${url}`);
                  window.open(`https://wa.me/?text=${text}`, "_blank");
                }}
              >
                <Send className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </div>
          </Card>
        )}

        {/* Quick Stats */}
        <div className={`grid gap-2 ${hasDepositPayments || hasPriceOptions ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4"}`}>
          <Card className={`p-2 text-center cursor-pointer transition-colors ${participantFilter === "participants" ? "ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setParticipantFilter(participantFilter === "participants" ? "all" : "participants")}>
            <p className="text-lg font-bold font-display text-foreground">{registered.length}</p>
            <p className="text-[10px] text-muted-foreground font-body">Partecipanti</p>
          </Card>
          {hasDepositPayments && (
            <Card className={`p-2 text-center cursor-pointer transition-colors ${participantFilter === "deposit_paid" ? "ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setParticipantFilter(participantFilter === "deposit_paid" ? "all" : "deposit_paid")}>
              <p className="text-lg font-bold font-display text-foreground">{depositPaid.length}</p>
              <p className="text-[10px] text-muted-foreground font-body">Acconti</p>
            </Card>
          )}
          <Card className={`p-2 text-center cursor-pointer transition-colors ${participantFilter === "attended" ? "ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setParticipantFilter(participantFilter === "attended" ? "all" : "attended")}>
            <p className="text-lg font-bold font-display text-foreground">{checkedIn.length}</p>
            <p className="text-[10px] text-muted-foreground font-body">Presenti</p>
          </Card>
          <Card className="p-2 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setParticipantFilter(participantFilter === "waitlist" ? "all" : "waitlist")}>
            <p className="text-lg font-bold font-display text-foreground">{waitlisted.length}</p>
            <p className="text-[10px] text-muted-foreground font-body">Lista d'attesa</p>
          </Card>
          {hasPriceOptions && (
            <Card className={`p-2 text-center cursor-pointer transition-colors ${participantFilter === "price_option" ? "ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setParticipantFilter(participantFilter === "price_option" ? "all" : "price_option")}>
              <p className="text-lg font-bold font-display text-foreground">{sortedPriceOptions.length}</p>
              <p className="text-[10px] text-muted-foreground font-body">Opzioni</p>
            </Card>
          )}
          <Card className="p-2 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setNewCapacity(event.spots_total); setShowCapacityDialog(true); }}>
            <p className="text-lg font-bold font-display text-foreground">{event.spots_total - registered.length - reservedSpots}</p>
            <p className="text-[10px] text-muted-foreground font-body">Disponibili</p>
            {reservedSpots > 0 && (
              <p className="text-[9px] text-warning font-body">{reservedSpots} riservati</p>
            )}
          </Card>
        </div>

        {hasPriceOptions && (
          <Card className="p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-body font-semibold text-foreground">Modalità di partecipazione</p>
                <p className="text-[11px] text-muted-foreground font-body">Posti e acconti separati per formula. La lista d'attesa usa l'impostazione generale dell'evento.</p>
              </div>
              <Select
                value={selectedPriceOptionFilter}
                onValueChange={(value) => {
                  setSelectedPriceOptionFilter(value);
                  setParticipantFilter("price_option");
                }}
              >
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Filtro formula" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PRICE_OPTIONS}>Tutte</SelectItem>
                  {sortedPriceOptions.map((option) => (
                    <SelectItem key={option.id || option.name || "option"} value={option.id || NO_PRICE_OPTION}>
                      {option.name || "Formula"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {sortedPriceOptions.map((option) => {
                const remaining = getOptionRemainingSpots(option, event);
                const active = getOptionActiveCount(option.id);
                const waitlistCount = getOptionWaitlistCount(option.id);
                return (
                  <div key={option.id || option.name || "option"} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold font-body text-foreground">{option.name || "Formula"}</p>
                        <p className="text-[11px] font-body text-muted-foreground">{getOptionPaymentSummary(option, event)}</p>
                      </div>
                      <Badge variant={remaining > 0 ? "secondary" : waitlistCount > 0 ? "outline" : "destructive"} className="shrink-0 text-[10px]">
                        {remaining > 0 ? `${remaining} liberi` : isWaitlistEnabledForEvent(event) ? "Waitlist" : "Esaurita"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground font-body">
                      <span>{active} iscritti</span>
                      <span>{waitlistCount} waitlist</span>
                      {option.has_dedicated_spots && <span>{Number(option.dedicated_spots || 0)} dedicati</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Action Bar */}
        <div className="grid grid-cols-3 gap-2 min-w-0">
          <Button size="sm" variant="outline" className="w-full min-w-0 gap-1 px-2 text-xs" onClick={() => openAddParticipantDialog("manual")}>
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Add Participant</span>
          </Button>
          <Button size="sm" variant="outline" className="w-full min-w-0 gap-1 px-2 text-xs" onClick={() => setShowMessageDialog(true)}>
            <Send className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Message All</span>
          </Button>
          {hasDepositPayments && (
            <Button
              size="sm"
              variant="outline"
              className="w-full min-w-0 gap-1 px-2 text-xs"
              disabled={sendingBalanceReminder || depositReminderCandidates.length === 0}
              onClick={() => void sendBalanceReminders()}
            >
              <Bell className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Sollecita saldo</span>
            </Button>
          )}
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="w-full flex overflow-x-auto no-scrollbar">
            <TabsTrigger value="participants" className="flex-1 min-w-0 text-xs px-2">Participants</TabsTrigger>
            <TabsTrigger value="checkin" className="flex-1 min-w-0 text-xs px-2">Check-in</TabsTrigger>
            <TabsTrigger value="waitlist" className="flex-1 min-w-0 text-xs px-2">Waitlist</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 min-w-0 text-xs px-2 relative">
              Pending
              {pending.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 min-w-0 text-xs px-2">
              <BarChart3 className="h-3.5 w-3.5 mr-0.5 shrink-0" />
              <span className="truncate">Stats</span>
            </TabsTrigger>
          </TabsList>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-3 mt-3">
            <div className="flex items-center gap-2">
              {meetingPoints && meetingPoints.length > 0 && (
                <Select value={meetingPointFilter} onValueChange={setMeetingPointFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Filter by meeting point" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All meeting points</SelectItem>
                    {meetingPoints.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 shrink-0">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>

            {regsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredRegistered.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">No participants yet</p>
            ) : (
              <div className="space-y-2">
                {filteredRegistered.map((reg) => {
                  const mp = meetingPoints?.find((p) => p.id === reg.meeting_point_id);
                  const { firstName, lastName, isManual } = getParticipantName(reg);
                  const regPriceOption = getPriceOptionForRegistration(reg);
                  const depositLabel = getDepositPaymentLabel(reg, event, regPriceOption);
                  const instagramHandle = !isManual && isConfirmedEffectiveRegistration(reg)
                    ? (reg.profiles as any)?.instagram_handle
                    : null;
                  return (
                    <Card key={reg.id} className="p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isManual ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                          {isManual ? (firstName[0] || "?") : ((reg.profiles as any)?.avatar_url ? (
                            <img src={(reg.profiles as any).avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : firstName[0])}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm font-semibold text-foreground truncate">
                            {firstName} {lastName}
                            {isManual && <span className="text-[10px] text-warning ml-1">(manual)</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-body">
                            {!isManual && ((reg.profiles as any)?.phone || "No phone")} {mp ? `· ${mp.name}` : ""}
                            {reg.sport_level && !reg.sport_level.startsWith("manual:") && (
                              <span className="text-primary ml-1">· Level: {reg.sport_level}</span>
                            )}
                            {regPriceOption && (
                              <span className="text-secondary ml-1">· {regPriceOption.name}</span>
                            )}
                            {(depositLabel || (reg.payment_status && reg.payment_status !== "not_required")) && (
                              <span className={`ml-1 ${(reg.payment_status === "paid" || reg.status === "paid") ? "text-success" : "text-warning"}`}>
                                · {depositLabel || reg.payment_status}
                              </span>
                            )}
                          </p>
                          {instagramHandle && (
                            <a
                              href={instagramProfileUrl(instagramHandle)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-body font-semibold text-primary hover:underline"
                            >
                              <Instagram className="h-3 w-3" />
                              @{instagramHandle}
                            </a>
                          )}
                          {/* Suitability indicators for organizers */}
                          {!isManual && (reg.profiles as any)?.self_level && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-body font-semibold ${
                                (reg.profiles as any).self_level === "advanced" ? "bg-success/10 text-success" :
                                (reg.profiles as any).self_level === "intermediate" ? "bg-primary/10 text-primary" :
                                "bg-warning/10 text-warning"
                              }`}>
                                {(reg.profiles as any).self_level === "advanced" ? "💪" : (reg.profiles as any).self_level === "intermediate" ? "🥾" : "🌱"} {(reg.profiles as any).self_level}
                              </span>
                              {(reg.profiles as any).trekking_experience && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[9px] font-body text-muted-foreground">
                                  🏔️ {(reg.profiles as any).trekking_experience === "5_plus" || (reg.profiles as any).trekking_experience === "5+" ? "5+" : (reg.profiles as any).trekking_experience} trek
                                </span>
                              )}
                              {(reg.profiles as any).activity_frequency && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[9px] font-body text-muted-foreground">
                                  {(reg.profiles as any).activity_frequency === "high" || (reg.profiles as any).activity_frequency === ">2/week" ? "⚡" : "🙂"} {(reg.profiles as any).activity_frequency}
                                </span>
                              )}
                              {(reg.profiles as any).experience_grade != null && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-secondary/10 text-[9px] font-body text-secondary font-semibold">
                                  Grade: {(reg.profiles as any).experience_grade}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant={reg.checked_in ? "default" : "outline"} className="text-[10px]">
                            {reg.checked_in ? <CheckCircle2 className="h-3 w-3" /> : reg.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              if (editingParticipant === reg.id) {
                                setEditingParticipant(null);
                              } else {
                                setEditingParticipant(reg.id);
                                setEditMeetingPoint(reg.meeting_point_id || NO_MEETING_POINT);
                                setEditPaymentStatus(reg.payment_status || "pending");
                                setEditPriceOptionId((reg as any).price_option_id || NO_PRICE_OPTION);
                              }
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {renderParticipantOptionsMenu(reg)}
                        </div>
                      </div>
                      {editingParticipant === reg.id && (
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] pt-1 border-t border-border">
                          {meetingPoints && meetingPoints.length > 0 && (
                            <div>
                              <Label className="font-body text-[10px] text-muted-foreground">Meeting Point</Label>
                              <Select value={editMeetingPoint} onValueChange={setEditMeetingPoint}>
                                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="None" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_MEETING_POINT}>None</SelectItem>
                                  {meetingPoints.map((mp) => (
                                    <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {hasPriceOptions && (
                            <div>
                              <Label className="font-body text-[10px] text-muted-foreground">Formula</Label>
                              <Select value={editPriceOptionId} onValueChange={setEditPriceOptionId}>
                                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_PRICE_OPTION}>Nessuna</SelectItem>
                                  {sortedPriceOptions.map((option) => (
                                    <SelectItem key={option.id || option.name || "option"} value={option.id || NO_PRICE_OPTION}>
                                      {option.name || "Formula"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div>
                            <Label className="font-body text-[10px] text-muted-foreground">Payment</Label>
                            <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                              <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PAYMENT_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleUpdateRegistration(reg.id, {
                              meeting_point_id: !editMeetingPoint || editMeetingPoint === NO_MEETING_POINT ? null : editMeetingPoint,
                              payment_status: editPaymentStatus,
                              price_option_id: hasPriceOptions ? normalizePriceOptionId(editPriceOptionId) : undefined,
                            })}
                          >
                            Save
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="checkin" className="space-y-3 mt-3">
            {/* Controls row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={checkInSearch}
                  onChange={(e) => setCheckInSearch(e.target.value)}
                  placeholder="Search participants..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button
                variant={quickCheckIn ? "default" : "outline"}
                size="sm"
                className="gap-1 shrink-0"
                onClick={() => setQuickCheckIn(!quickCheckIn)}
              >
                <Zap className="h-3.5 w-3.5" />
                Quick
              </Button>
            </div>

            {/* Meeting point filter */}
            {meetingPoints && meetingPoints.length > 0 && (
              <div className="space-y-2">
                <Select value={checkInMpFilter} onValueChange={setCheckInMpFilter}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Filter by meeting point" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Participants</SelectItem>
                    {meetingPoints.map((mp) => {
                      const mpCheckedIn = registered.filter((r) => r.meeting_point_id === mp.id && r.checked_in).length;
                      const mpTotal = registered.filter((r) => r.meeting_point_id === mp.id).length;
                      return (
                        <SelectItem key={mp.id} value={mp.id}>
                          {mp.name} — {mpCheckedIn}/{mpTotal} checked in
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Attendance counter */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <p className="font-body text-sm text-foreground font-semibold">
                {checkInMpFilter === "all" ? "Total" : meetingPoints?.find(m => m.id === checkInMpFilter)?.name || ""}
              </p>
              <Badge variant="secondary" className="text-sm font-display">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {filteredCheckIn.filter((r) => r.checked_in).length} / {filteredCheckIn.length} checked in
              </Badge>
            </div>

            {filteredCheckIn.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">
                {checkInSearch ? "No matching participants" : "No participants to check in"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredCheckIn.map((reg) => {
                  const { firstName, lastName, isManual } = getParticipantName(reg);
                  const mp = meetingPoints?.find((p) => p.id === reg.meeting_point_id);
                  return (
                    <Card
                      key={reg.id}
                      className={`p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                        reg.checked_in ? "bg-success/10 border-success/30" : "hover:bg-muted/50"
                      }`}
                      onClick={quickCheckIn ? () => handleCheckIn(reg.id, reg.checked_in) : undefined}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        reg.checked_in ? "bg-success text-success-foreground" : "bg-muted"
                      }`}>
                        {reg.checked_in ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{firstName[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">
                          {firstName} {lastName}
                          {isManual && <span className="text-[10px] text-warning ml-1">(manual)</span>}
                        </p>
                        <div className="flex items-center gap-1">
                          {mp && (
                            <p className="text-[10px] text-muted-foreground font-body">{mp.name}</p>
                          )}
                          {reg.sport_level && !reg.sport_level.startsWith("manual:") && (
                            <p className="text-[10px] text-primary font-body">· {reg.sport_level}</p>
                          )}
                          {(reg.profiles as any)?.membership_id && (
                            <p className="text-[10px] text-secondary font-body font-bold">· ID: {(reg.profiles as any).membership_id}</p>
                          )}
                        </div>
                      </div>
                      {!quickCheckIn && (
                        <Button
                          variant={reg.checked_in ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleCheckIn(reg.id, reg.checked_in)}
                        >
                          {reg.checked_in ? "Undo" : "Check in"}
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Waitlist Tab */}
          <TabsContent value="waitlist" className="space-y-3 mt-3">
            {waitlisted.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">No one on the waitlist</p>
            ) : (
              <div className="space-y-2">
                {waitlisted.map((reg, index) => {
                  const priceOption = getPriceOptionForRegistration(reg);
                  const waitlistStatus = (reg as any).waitlist_status || "waiting";
                  return (
                  <Card key={reg.id} className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning text-xs font-bold">
                      {(reg.profiles as any)?.first_name?.[0] || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold text-foreground truncate">
                        {(reg.profiles as any)?.first_name} {(reg.profiles as any)?.last_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-body">
                        Ingresso {format(new Date(reg.created_at), "dd MMM yyyy HH:mm")}
                        {(reg.profiles as any)?.membership_id && (
                          <span className="text-secondary font-bold"> · ID: {(reg.profiles as any).membership_id}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-body">
                        Posizione {index + 1} · Stato {waitlistStatus} · Formula {priceOption?.name || "-"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" className="gap-1 h-7 text-xs" onClick={() => handlePromoteFromWaitlist(reg.id)}>
                        <UserPlus className="h-3 w-3" /> Promote
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setPendingCancelRegistrationId(reg.id)}>
                        <UserMinus className="h-3 w-3" />
                      </Button>
                      {renderParticipantOptionsMenu(reg)}
                    </div>
                  </Card>
                  );
                })}
              </div>
            )}

            {cancelled.length > 0 && (
              <div className="mt-4">
                <h3 className="font-body text-sm font-semibold text-muted-foreground mb-2">Cancelled ({cancelled.length})</h3>
                <div className="space-y-1">
                  {cancelled.map((reg) => (
                    <div key={reg.id} className="flex items-center gap-2 px-3 py-2 text-muted-foreground opacity-60">
                      <span className="text-xs font-body">
                        {(reg.profiles as any)?.first_name} {(reg.profiles as any)?.last_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Pending Approvals Tab */}
          <TabsContent value="pending" className="space-y-3 mt-3">
            {pending.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">No pending manual approvals</p>
            ) : (
              <div className="space-y-2">
                {pending.map((reg) => (
                  <Card key={reg.id} className="p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-xs font-bold">
                        {(reg.profiles as any)?.first_name?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">
                          {(reg.profiles as any)?.first_name} {(reg.profiles as any)?.last_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-body truncate">
                          {(reg.profiles as any)?.phone || "No phone"} · Level {(reg.profiles as any)?.experience_grade || "?"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" className="flex-1 text-xs" onClick={() => handleApprovePending(reg.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setPendingCancelRegistrationId(reg.id)}>
                        Reject
                      </Button>
                      {renderParticipantOptionsMenu(reg)}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-3">
            <EventAnalytics
              event={event}
              registrations={registrations || []}
              meetingPoints={meetingPoints || []}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedProfileRegistration} onOpenChange={(open) => { if (!open) setSelectedProfileRegistration(null); }}>
        <DialogContent className="max-w-sm">
          {selectedProfileRegistration && (() => {
            const reg = selectedProfileRegistration;
            const { firstName, lastName } = getParticipantName(reg);
            const mp = meetingPoints?.find((point) => point.id === reg.meeting_point_id);
            const priceOption = getPriceOptionForRegistration(reg);
            const profile = (reg.profiles || {}) as any;
            const payment = PAYMENT_STATUS_OPTIONS.find((option) => option.value === paymentMenuValue(reg))?.label || paymentMenuValue(reg);
            const status = reg.status === "no_show"
              ? "No-show"
              : REGISTRATION_STATUS_OPTIONS.find((option) => option.value === registrationMenuValue(reg))?.label || reg.status;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">Profilo partecipante</DialogTitle>
                  <DialogDescription className="font-body text-sm">
                    {firstName} {lastName}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm font-body">
                  <div className="grid grid-cols-2 gap-2">
                    <ProfileField label="Iscrizione" value={status} />
                    <ProfileField label="Pagamento" value={payment} />
                    <ProfileField label="Ritrovo" value={mp?.name || "Nessun ritrovo"} />
                    <ProfileField label="Formula" value={priceOption?.name || "Nessuna formula"} />
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-1">
                    {profile.phone && <p><span className="text-muted-foreground">Telefono:</span> {profile.phone}</p>}
                    {profile.instagram_handle && (
                      <p>
                        <span className="text-muted-foreground">Instagram:</span>{" "}
                        <a className="text-primary hover:underline" href={instagramProfileUrl(profile.instagram_handle)} target="_blank" rel="noreferrer">
                          @{profile.instagram_handle}
                        </a>
                      </p>
                    )}
                    {profile.membership_id && <p><span className="text-muted-foreground">Tessera:</span> {profile.membership_id}</p>}
                    {profile.self_level && <p><span className="text-muted-foreground">Livello:</span> {profile.self_level}</p>}
                    {profile.experience_grade != null && <p><span className="text-muted-foreground">Grade:</span> {profile.experience_grade}</p>}
                    {profile.health_safety_status === "has_info" && (
                      <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs">
                        <p className="font-semibold text-foreground">Salute e sicurezza</p>
                        {profile.health_safety_notes && <p className="mt-1 text-muted-foreground">{profile.health_safety_notes}</p>}
                        {profile.emergency_medication_notes && <p className="mt-1 text-muted-foreground">Farmaci/dispositivi: {profile.emergency_medication_notes}</p>}
                        {profile.health_safety_help_notes && <p className="mt-1 text-muted-foreground">Indicazioni: {profile.health_safety_help_notes}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showOwnerDialog} onOpenChange={setShowOwnerDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Cambia organizzatore</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Seleziona l'account che deve gestire questo evento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              placeholder="Cerca nome, email o ruolo"
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredOwnerOptions.length === 0 ? (
                <p className="text-sm font-body text-muted-foreground text-center py-6">Nessun organizzatore disponibile</p>
              ) : (
                filteredOwnerOptions.map((owner) => (
                  <button
                    key={owner.id}
                    type="button"
                    disabled={savingOwnerId != null || owner.id === event.organizer_id}
                    onClick={() => handleChangeOrganizer(owner)}
                    className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                  >
                    {owner.avatarUrl ? (
                      <img src={owner.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {owner.name[0] || "O"}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-body font-semibold text-foreground truncate">{owner.name}</span>
                      <span className="block text-[11px] font-body text-muted-foreground truncate">
                        {owner.role === "admin" ? "Admin" : "Organizzatore"}{owner.email ? ` · ${owner.email}` : ""}
                      </span>
                    </span>
                    {savingOwnerId === owner.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : owner.id === event.organizer_id ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Participant Dialog */}
      <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Add Participant</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Add an existing user or create a manual entry.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-3">
            <Button
              variant={addMode === "search" ? "default" : "outline"}
              size="sm"
              className="flex-1 font-body text-xs"
              onClick={() => setAddMode("search")}
            >
              <Search className="h-3 w-3 mr-1" /> Find User
            </Button>
            <Button
              variant={addMode === "manual" ? "default" : "outline"}
              size="sm"
              className="flex-1 font-body text-xs"
              onClick={() => setAddMode("manual")}
            >
              <UserPlus className="h-3 w-3 mr-1" /> Manual Entry
            </Button>
          </div>

          <div className="space-y-3">
            {addMode === "search" ? (
              <>
                {selectedSearchUser ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      {selectedSearchUser.avatar_url ? (
                        <img src={selectedSearchUser.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {selectedSearchUser.first_name?.[0] || "?"}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-body font-semibold text-foreground">{selectedSearchUser.first_name} {selectedSearchUser.last_name}</p>
                        <p className="text-[10px] font-body text-muted-foreground">{selectedSearchUser.phone || "No phone"}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedSearchUser(null)}>Change</Button>
                    </div>

                    {meetingPoints && meetingPoints.length > 0 && (
                      <div>
                        <Label className="font-body text-xs">Meeting Point</Label>
                        <Select value={manualMeetingPoint} onValueChange={setManualMeetingPoint}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select meeting point" /></SelectTrigger>
                          <SelectContent>
                            {meetingPoints.map((mp) => (
                              <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {renderPriceOptionSelect(currentManualPriceOptionId, setManualPriceOptionId)}

                    <div>
                      <Label className="font-body text-xs">Payment Status</Label>
                      <Select value={manualPaymentStatus} onValueChange={setManualPaymentStatus}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleConfirmAddSearchUser}
                      disabled={addingParticipant || (hasPriceOptions && !currentManualPriceOptionId)}
                      className="w-full font-body"
                    >
                      {addingParticipant ? "Adding..." : "Confirm & Add Participant"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="font-body text-xs">Search by name</Label>
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type at least 2 characters..."
                        className="mt-1"
                      />
                    </div>
                    {searchResults && searchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {searchResults.map((u: any) => (
                          <button
                            key={u.id}
                            onClick={() => handleSelectSearchUser(u)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                          >
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                {u.first_name?.[0] || "?"}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-body font-semibold text-foreground">{u.first_name} {u.last_name}</p>
                              <p className="text-[10px] font-body text-muted-foreground">{u.phone || "No phone"}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchQuery.length >= 2 && searchResults?.length === 0 && (
                      <p className="text-xs text-muted-foreground font-body text-center py-2">No users found</p>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="font-body text-xs">Participant Name *</Label>
                  <Input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Mario Rossi"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-body text-xs">Livello (opzionale)</Label>
                  <Select value={manualLevel} onValueChange={setManualLevel}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona livello" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non specificato</SelectItem>
                      <SelectItem value="beginner">Principiante</SelectItem>
                      <SelectItem value="intermediate">Intermedio</SelectItem>
                      <SelectItem value="advanced">Esperto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {renderPriceOptionSelect(currentManualPriceOptionId, setManualPriceOptionId)}
              </div>
            )}

            {addMode !== "search" && (
              <>
                {meetingPoints && meetingPoints.length > 0 && (
                  <div>
                    <Label className="font-body text-xs">Meeting Point</Label>
                    <Select value={manualMeetingPoint} onValueChange={setManualMeetingPoint}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select meeting point" /></SelectTrigger>
                      <SelectContent>
                        {meetingPoints.map((mp) => (
                          <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="font-body text-xs">Payment Status</Label>
                  <Select value={manualPaymentStatus} onValueChange={setManualPaymentStatus}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleAddManualParticipant}
                  disabled={!manualName.trim() || addingParticipant || (hasPriceOptions && !currentManualPriceOptionId)}
                  className="w-full font-body"
                >
                  {addingParticipant ? "Adding..." : "Add Participant"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Event Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Delete Event?</DialogTitle>
            <DialogDescription className="font-body text-sm">
              This will permanently delete "{event.title}" and all registrations. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 font-body" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1 font-body" onClick={handleDeleteEvent}>
              Delete Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Broadcast Message
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              Send a message to all {registered.length} registered participants of this event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quick Templates */}
            <div>
              <p className="text-xs font-body font-semibold text-muted-foreground mb-2">Quick templates</p>
              <div className="flex flex-wrap gap-1.5">
                {broadcastTemplates?.map((tpl: any) => (
                  <button
                    key={tpl.id}
                    onClick={() => setMessageText(tpl.message.replace(/\{\{event_title\}\}/g, event.title))}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-body font-medium rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors active:scale-95"
                  >
                    <MessageCircle className="h-3 w-3" /> {tpl.title}
                  </button>
                ))}
                {!broadcastTemplates?.length && (
                  <p className="text-[11px] font-body text-muted-foreground">
                    No templates configured yet.
                  </p>
                )}
              </div>
            </div>

            {/* Message Input */}
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your broadcast message..."
              rows={4}
              className="font-body"
            />

            {/* Channel Selection */}
            <div>
              <p className="text-xs font-body font-semibold text-muted-foreground mb-2">Delivery channel</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBroadcastChannel("notification")}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-body font-medium transition-all ${
                    broadcastChannel === "notification"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">In-App</p>
                    <p className="text-[10px] opacity-70">Notification</p>
                  </div>
                </button>
                <button
                  onClick={() => setBroadcastChannel("whatsapp")}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-body font-medium transition-all ${
                    broadcastChannel === "whatsapp"
                      ? "border-[#25D366] bg-[#25D366]/5 text-[#25D366]"
                      : "border-border bg-card text-muted-foreground hover:border-[#25D366]/30"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">WhatsApp</p>
                    <p className="text-[10px] opacity-70">Each user</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Send Button */}
            <Button
              onClick={async () => {
                if (!messageText.trim() || !event || !user) return;
                setSendingBroadcast(true);
                try {
                  if (broadcastChannel === "notification") {
                    // Insert a notification for each registered participant
                    const notifs = registered
                      .filter((r) => r.user_id && !r.sport_level?.startsWith("manual:"))
                      .map((r) => ({
                        user_id: r.user_id,
                        type: "broadcast",
                        title: event.title,
                        message: messageText,
                        event_id: event.id,
                        read: false,
                      }));

                    if (notifs.length > 0) {
                      const { error: notifErr } = await supabase.from("notifications").insert(notifs);
                      if (notifErr) throw notifErr;
                    }

                    // Log the broadcast
                    await supabase.from("event_broadcasts").insert({
                      event_id: event.id,
                      sender_id: user.id,
                      message: messageText,
                      channel: "notification",
                      recipients_count: notifs.length,
                    });

                    toast({ title: "Broadcast sent", description: `${notifs.length} participants notified via in-app notifications.` });
                  } else {
                    // WhatsApp: open for each participant who has a phone
                    const phoneParts = registered
                      .filter((r) => (r.profiles as any)?.phone)
                      .map((r) => (r.profiles as any).phone.replace(/[^0-9+]/g, ""));

                    if (phoneParts.length === 0) {
                      toast({ title: "No phone numbers", description: "No registered participants have phone numbers.", variant: "destructive" });
                      setSendingBroadcast(false);
                      return;
                    }

                    // Log the broadcast
                    await supabase.from("event_broadcasts").insert({
                      event_id: event.id,
                      sender_id: user.id,
                      message: messageText,
                      channel: "whatsapp",
                      recipients_count: phoneParts.length,
                    });

                    // Open WhatsApp for the first participant (user can send one by one)
                    const encodedMsg = encodeURIComponent(messageText);
                    window.open(`https://wa.me/${phoneParts[0]}?text=${encodedMsg}`, "_blank");

                    // Copy remaining numbers to clipboard for convenience
                    if (phoneParts.length > 1) {
                      const remaining = phoneParts.slice(1).join("\n");
                      await navigator.clipboard.writeText(remaining);
                      toast({
                        title: `WhatsApp opened for 1st contact`,
                        description: `${phoneParts.length - 1} more phone numbers copied to clipboard. Send the message to each participant.`,
                        duration: 8000,
                      });
                    } else {
                      toast({ title: "WhatsApp opened", description: "Message ready to send." });
                    }
                  }

                  queryClient.invalidateQueries({ queryKey: ["event-broadcasts", id] });
                  setShowMessageDialog(false);
                  setMessageText("");
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                } finally {
                  setSendingBroadcast(false);
                }
              }}
              disabled={!messageText.trim() || sendingBroadcast}
              className="w-full font-body"
            >
              {sendingBroadcast ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />
                  {broadcastChannel === "whatsapp" ? "Open WhatsApp" : `Send to ${registered.length} participants`}
                </>
              )}
            </Button>

            {/* Broadcast History */}
            {broadcastHistory && broadcastHistory.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-body font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <History className="h-3 w-3" /> Previous broadcasts
                </p>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {broadcastHistory.map((b: any) => (
                    <div key={b.id} className="p-2.5 rounded-lg bg-muted/50 text-xs font-body">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`flex items-center gap-1 font-semibold ${
                          b.channel === "whatsapp" ? "text-[#25D366]" : "text-primary"
                        }`}>
                          {b.channel === "whatsapp" ? <MessageCircle className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                          {b.channel === "whatsapp" ? "WhatsApp" : "In-App"}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(b.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}{" "}
                          {new Date(b.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">{b.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">→ {b.recipients_count} recipients</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Capacity Dialog */}
      <Dialog open={showCapacityDialog} onOpenChange={setShowCapacityDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Adjust Capacity</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Current: {event.spots_total} spots · {registered.length} registered · {reservedSpots} reserved
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-body text-xs">New Total Capacity</Label>
              <Input
                type="number"
                min={registered.length}
                value={newCapacity || ""}
                onChange={(e) => setNewCapacity(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground font-body mt-1">
                Minimum: {registered.length} (current registrations)
              </p>
            </div>
            <Button onClick={handleUpdateCapacity} disabled={newCapacity < registered.length} className="w-full font-body">
              Update Capacity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingCancelRegistrationId} onOpenChange={(open) => { if (!open) setPendingCancelRegistrationId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Cancella partecipante?</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Sei sicuro di voler cancellare questo partecipante?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPendingCancelRegistrationId(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                if (!pendingCancelRegistrationId) return;
                await handleCancelRegistration(pendingCancelRegistrationId);
                setPendingCancelRegistrationId(null);
              }}
            >
              Conferma
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Event Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cancella evento
            </DialogTitle>
            <DialogDescription>
              Sei sicuro di voler cancellare "{event?.title}"? Tutti i partecipanti ({registered.length + waitlisted.length + pending.length}) riceveranno una notifica e un'email di cancellazione. Le iscrizioni verranno annullate. Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)} disabled={cancellingEvent}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={cancellingEvent}
              onClick={async () => {
                setCancellingEvent(true);
                try {
                  // Update event status first
                  const { error } = await supabase.from("events").update({ status: "cancelled" as any }).eq("id", id!);
                  if (error) throw error;

                  // Trigger cancellation notifications via edge function
                  const supabaseFunctionsUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://istotjnoqtrtthnyreyv.supabase.co').replace(/\/$/, '');
                  const gatewayJwt = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                  if (!gatewayJwt) throw new Error("Configurazione Supabase mancante per la funzione.");
                  const response = await fetch(`${supabaseFunctionsUrl}/functions/v1/notify-event-cancelled`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': gatewayJwt,
                      'Authorization': `Bearer ${gatewayJwt}`,
                    },
                    body: JSON.stringify({ event_id: id }),
                  });
                  if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    throw new Error(data?.error || "Errore durante la cancellazione dell'evento");
                  }

                  invalidateParticipantCounts();
                  toast({ title: "Evento annullato", description: "I partecipanti riceveranno il rimborso completo dell'importo versato." });
                } catch (err: any) {
                  toast({ title: "Errore", description: err.message, variant: "destructive" });
                } finally {
                  setCancellingEvent(false);
                  setShowCancelConfirm(false);
                }
              }}
            >
              {cancellingEvent ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Conferma cancellazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EventManage;
