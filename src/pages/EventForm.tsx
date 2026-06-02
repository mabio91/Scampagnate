import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useEvents";
import type { AccessRule, AccessRulesConfig } from "@/hooks/useEventAccessRules";
import { supabase } from "@/integrations/supabase/client";
import { parseCancellationPolicy, serializeCancellationPolicy, CANCELLATION_POLICIES, PolicyType } from "@/lib/cancellationPolicy";
import { MANUAL_BADGE_OPTIONS } from "@/lib/eventBadges";
import { FIT_SCORE_EVENT_SECONDARY_MAX, INTEREST_CATEGORY_OPTIONS } from "@/lib/fitScoreAffinityTables";
import { EVENT_CLOSING_SENTENCES, normalizeEventClosingSentence } from "@/lib/eventClosingSentences";

import LocationAutocomplete from "@/components/LocationAutocomplete";
import ImageCropDialog from "@/components/ImageCropDialog";
import { HOME_CARD_IMAGE_FIELD, getEventHomeCardImageUrl } from "@/lib/eventImages";
import {
  getRemovedMeetingPointIds,
  getRetainedMeetingPointIds,
} from "@/lib/meetingPoints";
import { formatPromoDateInput, promoDateInputToIso } from "@/lib/promoPricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import RichTextEditor from "@/components/RichTextEditor";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Clock, Mountain, Route,
  Trash2, Plus, Image as ImageIcon, Map as MapIcon, Info, HelpCircle, AlertCircle, Loader2, Save, X, GripVertical, ChevronUp, ChevronDown, PackageCheck, Upload, Shield, Car, Award
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { useTrekkingDifficultyLevels } from "@/hooks/useTrekkingDifficultyLevels";

type PaymentType = Database["public"]["Enums"]["payment_type"];
type BalancePaymentMode = "online" | "on_site";
type EventStatus = Database["public"]["Enums"]["event_status"];

interface EquipmentItem {
  name: string;
  is_mandatory: boolean;
  notes: string;
}

interface AdditionalField {
  label: string;
  type: "text" | "select";
  required: boolean;
  options: string[];
}

interface EventStaffInput {
  id?: string;
  profile_id: string | null;
  display_name: string;
  role_label: string;
  avatar_url: string | null;
  is_public: boolean;
  profileSearch: string;
}

const EVENT_STATUS_OPTIONS: Array<{ value: EventStatus; label: string; description: string }> = [
  { value: "draft", label: "Non pubblicato", description: "Visibile solo ad admin e organizzatori. Iscrizioni non attive." },
  { value: "upcoming", label: "In arrivo", description: "Evento annunciabile, ma iscrizioni non ancora aperte." },
  { value: "open", label: "Aperto", description: "Evento visibile e iscrizioni attive." },
  { value: "closed", label: "Iscrizioni chiuse", description: "Evento visibile, ma iscrizioni bloccate." },
  { value: "full", label: "Sold out", description: "Evento sold out. La lista d'attesa dipende dall'impostazione generale dell'evento." },
  { value: "rescheduled", label: "Riprogrammato", description: "Evento da riprogrammare. Iscrizioni non attive." },
  { value: "cancelled", label: "Annullato", description: "Evento annullato. Usa il flusso di annullamento per notifiche e rimborsi." },
];

const STAFF_ROLE_PRESETS = ["STAFF", "FOTOGRAFO", "GUIDA"] as const;
const CUSTOM_STAFF_ROLE_VALUE = "__custom__";

const normalizeEditableEventStatus = (status: string | null | undefined): EventStatus => {
  if (status === "available" || status === "published") return "open";
  if (status === "unpublished") return "draft";
  if (status === "past" || status === "completed") return "closed";
  return EVENT_STATUS_OPTIONS.some((option) => option.value === status)
    ? status as EventStatus
    : "open";
};

const useEquipmentTemplates = () => {
  return useQuery({
    queryKey: ["equipment-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_templates")
        .select("*, equipment_template_items(*)");
      if (error) throw error;
      return data;
    },
  });
};

const useBadges = () => {
  return useQuery({
    queryKey: ["badges-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("id, name, icon, description")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
};

const useSpecialBadges = () => {
  return useQuery({
    queryKey: ["special-badges-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("id, name, icon, description")
        .eq("category", "special")
        .neq("name", "Founding Member")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
};

const MultiBadgeSelector = ({ selectedIds, onChange, label }: { selectedIds: string[]; onChange: (ids: string[]) => void; label?: string }) => {
  const { data: badges } = useBadges();
  const toggleBadge = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(b => b !== id) : [...selectedIds, id]);
  };
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-[11px] text-muted-foreground">{label}</Label>}
      <div className="flex flex-wrap gap-1.5">
        {badges?.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => toggleBadge(b.id)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              selectedIds.includes(b.id)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border/50 hover:border-primary/50"
            }`}
          >
            {b.icon} {b.name}
          </button>
        ))}
        {(!badges || badges.length === 0) && (
          <span className="text-xs text-muted-foreground">Nessun badge disponibile</span>
        )}
      </div>
    </div>
  );
};

const EventSpecialBadgeSelector = ({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) => {
  const { data: badges, isLoading } = useSpecialBadges();
  const selectedBadges = (badges || []).filter((badge) => selectedIds.includes(badge.id));

  const toggleBadge = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((badgeId) => badgeId !== id) : [...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">Seleziona badge speciali</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between gap-2 text-left font-normal">
            <span className="min-w-0 flex-1 truncate">
              {selectedBadges.length > 0
                ? selectedBadges.map((badge) => `${badge.icon} ${badge.name}`).join(", ")
                : "Nessun badge speciale selezionato"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto">
          {isLoading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Caricamento...</div>
          )}
          {!isLoading && (!badges || badges.length === 0) && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Nessun badge speciale selezionato</div>
          )}
          {badges?.map((badge) => (
            <DropdownMenuCheckboxItem
              key={badge.id}
              checked={selectedIds.includes(badge.id)}
              onCheckedChange={() => toggleBadge(badge.id)}
              onSelect={(event) => event.preventDefault()}
            >
              <span className="truncate">{badge.icon} {badge.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-xs text-muted-foreground font-body">
        Questi badge verranno assegnati solo agli utenti segnati come presenti all'evento.
      </p>
    </div>
  );
};

interface MeetingPointInput {
  id?: string;
  name: string;
  location: string;
  time: string;
  notes: string;
}

// Helper components for grouped access rules UI
const RuleToggleRow = ({ label, isActive, onToggle, children }: {
  label: string;
  isActive: boolean;
  onToggle: (active: boolean) => void;
  children?: React.ReactNode;
}) => (
  <div className="p-2.5 bg-background rounded-lg border border-border/50 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-body text-foreground">{label}</span>
      <Switch checked={isActive} onCheckedChange={onToggle} />
    </div>
    {isActive && children}
  </div>
);

const EnforcementToggle = ({ rule, onChange }: { rule: AccessRule; onChange: (v: "hard" | "soft") => void }) => (
  <Select value={rule.enforcement || "hard"} onValueChange={(v) => onChange(v as "hard" | "soft")}>
    <SelectTrigger className="w-20 h-8 text-[10px]"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="hard">🔒 Hard</SelectItem>
      <SelectItem value="soft">💡 Soft</SelectItem>
    </SelectContent>
  </Select>
);

const EventForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const isEditing = !!id;
  const isDuplicating = !!duplicateId;
  const navigate = useNavigate();
  const { user, isOrganizer, profile, loading: authLoading } = useAuth();
  const { data: categories } = useCategories();
  const { data: difficultyLevels } = useTrekkingDifficultyLevels();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(isEditing || isDuplicating);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [homeCardImageFile, setHomeCardImageFile] = useState<File | null>(null);
  const [homeCardImageUrl, setHomeCardImageUrl] = useState("");
  const [homeCardImagePreview, setHomeCardImagePreview] = useState<string | null>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [coverHomeCropFile, setCoverHomeCropFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [validationPopupOpen, setValidationPopupOpen] = useState(false);
  const [validationPopupFields, setValidationPopupFields] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState(0);
  const [galleryUploadTotal, setGalleryUploadTotal] = useState(0);
  const [activeGalleryCropFile, setActiveGalleryCropFile] = useState<File | null>(null);
  const [galleryCropQueue, setGalleryCropQueue] = useState<File[]>([]);
  const [croppedGalleryFiles, setCroppedGalleryFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    location_label: "",
    category_id: "",
    spots_total: 20,
    reserved_spots: 0,
    price: 0,
    deposit: 0,
    payment_type: "free" as PaymentType,
    balance_payment_mode: "online" as BalancePaymentMode,
    difficulty: "",
    distance: "",
    elevation: "",
    duration: "",
    duration_unit: "h" as "h" | "giorni",
    featured: false,
    cancellation_policy: "",
    image_url: "",
    visibility: "public" as "public" | "private" | "hidden",
    gallery_images: [] as { url: string; order: number }[],
  });
  const [fitScoreMainCategory, setFitScoreMainCategory] = useState("");
  const [fitScoreSecondaryCategories, setFitScoreSecondaryCategories] = useState<string[]>([]);

  const [eventStatus, setEventStatus] = useState<EventStatus>("open");
  const [policyType, setPolicyType] = useState<PolicyType | "">("flexible_24h");
  const [policyCustomText, setPolicyCustomText] = useState("");

  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const { data: equipmentTemplates } = useEquipmentTemplates();

  const handleTemplateSelect = (templateId: string) => {
    const template = equipmentTemplates?.find((t) => t.id === templateId);
    if (!template) return;
    const items: EquipmentItem[] = (template.equipment_template_items || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((item: any) => ({
        name: item.name,
        is_mandatory: item.is_mandatory,
        notes: item.notes || "",
      }));
    setEquipmentItems(items);
    toast({ title: `Template "${template.name}" caricato con ${items.length} elementi` });
  };

  const addEquipmentItem = () => {
    setEquipmentItems((prev) => [...prev, { name: "", is_mandatory: false, notes: "" }]);
  };

  const updateEquipmentItem = (index: number, field: keyof EquipmentItem, value: any) => {
    setEquipmentItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeEquipmentItem = (index: number) => {
    setEquipmentItems((prev) => prev.filter((_, i) => i !== index));
  };
  const [meetingPoints, setMeetingPoints] = useState<MeetingPointInput[]>([]);
  const [additionalFields, setAdditionalFields] = useState<AdditionalField[]>([]);
  const [askCarAvailability, setAskCarAvailability] = useState(false);
  const [waitingListEnabled, setWaitingListEnabled] = useState(true);
  const [weatherOverrideCondition, setWeatherOverrideCondition] = useState("");
  const [weatherOverrideTempMin, setWeatherOverrideTempMin] = useState("");
  const [weatherOverrideTempMax, setWeatherOverrideTempMax] = useState("");
  const [weatherOverrideTempAvg, setWeatherOverrideTempAvg] = useState("");
  const [closingSentenceMode, setClosingSentenceMode] = useState<"random" | "preset" | "manual">("random");
  const [closingSentence, setClosingSentence] = useState("");
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [exclusivityLabel, setExclusivityLabel] = useState("");
  const [restrictionMessage, setRestrictionMessage] = useState("");
  const [manualBadges, setManualBadges] = useState<string[]>([]);
  const [customBadge, setCustomBadge] = useState("");
  const [eventSpecialBadgeIds, setEventSpecialBadgeIds] = useState<string[]>([]);
  const [existingOrganizer, setExistingOrganizer] = useState<{ id: string | null; name: string | null }>({ id: null, name: null });
  const [eventStaff, setEventStaff] = useState<EventStaffInput[]>([]);
  const [activeStaffSearchIndex, setActiveStaffSearchIndex] = useState<number | null>(null);
  const { data: remoteClosingSentences = [] } = useQuery({
    queryKey: ["event-closing-sentences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_closing_sentences" as any)
        .select("sentence")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("sentence", { ascending: true });

      if (error) throw error;
      return ((data as Array<{ sentence?: string | null }> | null) || [])
        .map((row) => normalizeEventClosingSentence(row.sentence))
        .filter(Boolean);
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const closingSentenceOptions =
    remoteClosingSentences.length > 0 ? remoteClosingSentences : [...EVENT_CLOSING_SENTENCES];
  const activeStaffSearchTerm =
    activeStaffSearchIndex !== null ? eventStaff[activeStaffSearchIndex]?.profileSearch.trim() || "" : "";
  const { data: staffProfileResults = [] } = useQuery({
    queryKey: ["event-staff-profile-search", activeStaffSearchTerm],
    queryFn: async () => {
      if (activeStaffSearchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .or(`first_name.ilike.%${activeStaffSearchTerm}%,last_name.ilike.%${activeStaffSearchTerm}%,email.ilike.%${activeStaffSearchTerm}%`)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: activeStaffSearchTerm.length >= 2,
  });

  useEffect(() => {
    const normalized = normalizeEventClosingSentence(closingSentence);
    if (closingSentenceMode === "manual" && normalized && closingSentenceOptions.includes(normalized)) {
      setClosingSentenceMode("preset");
      setClosingSentence(normalized);
    }
  }, [remoteClosingSentences, closingSentenceMode, closingSentence]);

  interface PriceOptionInput {
    id?: string;
    name: string;
    price: number;
    eligible_group: string;
    badge_ids: string[];
    original_price: number | null;
    is_promotional: boolean;
    promo_start: string;
    promo_end: string;
    payment_type: PaymentType;
    deposit_amount: number | null;
    balance_amount: number | null;
    balance_payment_mode: BalancePaymentMode;
    has_dedicated_spots: boolean;
    dedicated_spots: number | null;
    spots_taken?: number | null;
    waitlist_enabled: boolean;
  }

  const createBlankPriceOption = (overrides: Partial<PriceOptionInput> = {}): PriceOptionInput => ({
    name: "",
    price: 0,
    eligible_group: "all",
    badge_ids: [],
    original_price: null,
    is_promotional: false,
    promo_start: "",
    promo_end: "",
    payment_type: form.payment_type,
    deposit_amount: form.payment_type === "deposit" ? form.deposit : null,
    balance_amount: form.payment_type === "deposit" ? Math.max(0, form.price - form.deposit) : null,
    balance_payment_mode: form.balance_payment_mode,
    has_dedicated_spots: false,
    dedicated_spots: null,
    spots_taken: 0,
    waitlist_enabled: false,
    ...overrides,
  });

  const createLegacyPriceOption = (event: { payment_type?: string | null; price?: number | null; deposit?: number | null; balance_payment_mode?: string | null }) => {
    const paymentType = (event.payment_type || "free") as PaymentType;
    const price = paymentType === "free" ? 0 : Number(event.price || 0);
    const depositAmount = paymentType === "deposit" ? Number(event.deposit || 0) : null;

    return createBlankPriceOption({
      price,
      payment_type: paymentType,
      deposit_amount: depositAmount,
      balance_amount: paymentType === "deposit" ? Math.max(0, price - Number(depositAmount || 0)) : null,
      balance_payment_mode: (event.balance_payment_mode || "online") as BalancePaymentMode,
    });
  };

  const [priceOptions, setPriceOptions] = useState<PriceOptionInput[]>(() => [
    createBlankPriceOption(),
  ]);

  const fallbackFormulaName = (index: number) => `Formula ${index + 1}`;
  const normalizeFormulaInputName = (name: string | null | undefined, index: number) => {
    const trimmedName = (name || "").trim();
    return trimmedName === fallbackFormulaName(index) ? "" : trimmedName;
  };

  useEffect(() => {
    if (isEditing) {
      loadEvent(id);
    } else if (isDuplicating) {
      loadEvent(duplicateId);
    } else {
      // Pre-fill from query params (e.g. proposal conversion)
      const title = searchParams.get("title");
      const description = searchParams.get("description");
      const location = searchParams.get("location");
      const locationLabel = searchParams.get("location_label");
      const date = searchParams.get("date");
      const time = searchParams.get("time");
      const spotsTotal = searchParams.get("spots_total");
      const categoryId = searchParams.get("category_id");
      if (title || description || location) {
        setForm(prev => ({
          ...prev,
          ...(title && { title }),
          ...(description && { description }),
          ...(location && { location }),
          ...(locationLabel && { location_label: locationLabel }),
          ...(date && { date }),
          ...(time && { time }),
          ...(spotsTotal && { spots_total: parseInt(spotsTotal) }),
          ...(categoryId && { category_id: categoryId }),
        }));
      }
    }
  }, [id, duplicateId]);

  const loadEvent = async (eventId: string) => {
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (event) {
      // Parse duration and unit
      let durationVal = event.duration || "";
      let durationUnit: "h" | "giorni" = "h";
      if (durationVal) {
        const lower = durationVal.toLowerCase().trim();
        if (lower.endsWith("giorni") || lower.endsWith("giorno") || lower.endsWith("days") || lower.endsWith("day") || lower.endsWith("g")) {
          durationUnit = "giorni";
          durationVal = lower.replace(/(giorni|giorno|days|day|g)$/i, "").trim();
        } else {
          durationUnit = "h";
          durationVal = lower.replace(/(h|ore|hours|hour)$/i, "").trim();
        }
      }

      // Parse distance (remove km suffix)
      let distanceVal = event.distance || "";
      if (distanceVal) distanceVal = distanceVal.replace(/\s*km$/i, "").trim();

      // Parse elevation (remove m suffix)
      let elevationVal = event.elevation || "";
      if (elevationVal) elevationVal = elevationVal.replace(/\s*m$/i, "").trim();

      setForm({
        title: isDuplicating ? `Copia di ${event.title}` : event.title,
        description: event.description,
        date: isDuplicating ? "" : event.date,
        time: isDuplicating ? "" : event.time,
        location: event.location,
        location_label: (event as any).location_label || "",
        category_id: event.category_id || "",
        spots_total: event.spots_total,
        reserved_spots: isDuplicating ? 0 : ((event as any).reserved_spots || 0),
        price: event.price,
        deposit: event.deposit || 0,
        payment_type: event.payment_type,
        balance_payment_mode: (event as any).balance_payment_mode || "online",
        difficulty: event.difficulty || "",
        distance: distanceVal,
        elevation: elevationVal,
        duration: durationVal,
        duration_unit: durationUnit,
        featured: isDuplicating ? false : event.featured,
        cancellation_policy: event.cancellation_policy || "",
        image_url: event.image_url || "",
        visibility: isDuplicating ? "private" : (event.visibility || "public"),
        gallery_images: (event.gallery_images as any[]) || [],
      });
      setExistingOrganizer(
        isDuplicating
          ? { id: null, name: null }
          : {
              id: event.organizer_id || null,
              name: event.organizer_name || null,
            }
      );
      setEventStatus(isDuplicating ? "open" : normalizeEditableEventStatus(event.status));
      const { policyType: pt, customText: ct } = parseCancellationPolicy(event.cancellation_policy);
      setPolicyType(pt || "flexible_24h");
      setPolicyCustomText(ct);
      if (event.image_url) {
        setImagePreview(event.image_url);
      }
      const savedHomeCardImageUrl = getEventHomeCardImageUrl(event as any) || "";
      setHomeCardImageUrl(savedHomeCardImageUrl);
      setHomeCardImagePreview(savedHomeCardImageUrl || null);

      if (event.equipment_list && Array.isArray(event.equipment_list)) {
        setEquipmentItems(
          (event.equipment_list as any[]).map((item: any) => ({
            name: item.name || "",
            is_mandatory: item.is_mandatory || false,
            notes: item.notes || "",
          }))
        );
      }

      const { data: points } = await supabase
        .from("event_meeting_points")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order");

      if (points) {
        setMeetingPoints(points.map((p) => ({
          id: isDuplicating ? undefined : p.id,
          name: p.name,
          location: p.location,
          time: p.time,
          notes: p.notes || "",
        })));
      }

      const { data: staffRows } = await supabase
        .from("event_staff" as any)
        .select("id, profile_id, display_name, role_label, avatar_url, is_public, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      setEventStaff((staffRows || []).map((member: any) => ({
        id: isDuplicating ? undefined : member.id,
        profile_id: member.profile_id || null,
        display_name: member.display_name || "",
        role_label: member.role_label || "Staff",
        avatar_url: member.avatar_url || null,
        is_public: member.is_public !== false,
        profileSearch: member.display_name || "",
      })));

      if (event.additional_fields) {
        const af = event.additional_fields as any;
        if (Array.isArray(af)) {
          setAdditionalFields(
            af.map((f: any) => ({
              label: f.label || "",
              type: f.type || "text",
              required: f.required || false,
              options: Array.isArray(f.options) ? f.options : (typeof f.options === 'string' && f.options ? f.options.split(',').map((o: string) => o.trim()) : []),
            }))
          );
          setWaitingListEnabled(false);
        } else {
          const normalized = normalizeEventClosingSentence(af.closing_sentence);
          if (isDuplicating || !normalized) {
            setClosingSentenceMode("random");
            setClosingSentence("");
          } else if ((closingSentenceOptions as readonly string[]).includes(normalized)) {
            setClosingSentenceMode("preset");
            setClosingSentence(normalized);
          } else {
            setClosingSentenceMode("manual");
            setClosingSentence(normalized);
          }
          setFitScoreMainCategory(af.fit_score_main_category || "");
          setFitScoreSecondaryCategories(
            Array.isArray(af.fit_score_secondary_categories)
              ? af.fit_score_secondary_categories.slice(0, FIT_SCORE_EVENT_SECONDARY_MAX)
              : []
          );
          if (af.ask_car_availability !== undefined) {
            setAskCarAvailability(!!af.ask_car_availability);
          }
          setWaitingListEnabled(!!af.waiting_list_enabled);
          if (af.weather_override_condition) setWeatherOverrideCondition(af.weather_override_condition);
          if (af.weather_override_temp_min != null && af.weather_override_temp_min !== "") setWeatherOverrideTempMin(String(af.weather_override_temp_min));
          if (af.weather_override_temp_max != null && af.weather_override_temp_max !== "") setWeatherOverrideTempMax(String(af.weather_override_temp_max));
          if (af.weather_override_temp_avg != null && af.weather_override_temp_avg !== "") setWeatherOverrideTempAvg(String(af.weather_override_temp_avg));
          if (af.weather_override_temp != null && af.weather_override_temp !== "" && !af.weather_override_temp_avg) {
            setWeatherOverrideTempAvg(String(af.weather_override_temp));
          }
          if (Array.isArray(af.fields)) {
            setAdditionalFields(
              af.fields.map((f: any) => ({
                label: f.label || "",
                type: f.type || "text",
                required: f.required || false,
                options: Array.isArray(f.options) ? f.options : (typeof f.options === 'string' && f.options ? f.options.split(',').map((o: string) => o.trim()) : []),
              }))
            );
          }
        }
      } else {
        setWaitingListEnabled(false);
      }

      if ((event as any).access_rules) {
        const ar = (event as any).access_rules as AccessRulesConfig;
        setAccessRules(ar.rules || []);
        setExclusivityLabel(ar.exclusivity_label || "");
        setRestrictionMessage(ar.restriction_message || "");
      }
      if ((event as any).event_badges && Array.isArray((event as any).event_badges)) {
        const badges = (event as any).event_badges as string[];
        const knownManual = new Set(MANUAL_BADGE_OPTIONS.map((option) => option.value));
        setManualBadges(badges.filter(b => knownManual.has(b as (typeof MANUAL_BADGE_OPTIONS)[number]["value"])));
        const custom = badges.find(b => !knownManual.has(b as (typeof MANUAL_BADGE_OPTIONS)[number]["value"]));
        if (custom) setCustomBadge(custom);
      }

      if (!isDuplicating) {
        const { data: specialBadgeLinks } = await supabase
          .from("event_special_badges")
          .select("badge_id")
          .eq("event_id", eventId);

        setEventSpecialBadgeIds(
          (specialBadgeLinks || [])
            .map((link) => link.badge_id)
            .filter(Boolean)
        );
      } else {
        setEventSpecialBadgeIds([]);
      }

      const { data: options } = await supabase
        .from("event_price_options")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order");
      if (options && options.length > 0) {
        setPriceOptions(options.map((o: any, index: number) => {
          const group = o.eligible_group || 'all';
          const badgeIds = group.startsWith("badge:") ? group.replace("badge:", "").split(",") : [];
          const paymentType = (o.payment_type || event.payment_type || "free") as PaymentType;
          const depositAmount = o.deposit_amount != null ? Number(o.deposit_amount) : (paymentType === "deposit" ? Number(event.deposit || 0) : null);
          const balanceAmount = paymentType === "deposit"
            ? Math.max(0, Number(o.price || 0) - Number(depositAmount || 0))
            : null;
          return {
            id: isDuplicating ? undefined : o.id,
            name: normalizeFormulaInputName(o.name, index),
            price: paymentType === "free" ? 0 : Number(o.price),
            eligible_group: group,
            badge_ids: badgeIds,
            original_price: o.original_price ? Number(o.original_price) : null,
            is_promotional: o.is_promotional || false,
            promo_start: formatPromoDateInput(o.promo_start),
            promo_end: formatPromoDateInput(o.promo_end),
            payment_type: paymentType,
            deposit_amount: depositAmount,
            balance_amount: balanceAmount,
            balance_payment_mode: (o.balance_payment_mode || event.balance_payment_mode || "online") as BalancePaymentMode,
            has_dedicated_spots: !!o.has_dedicated_spots,
            dedicated_spots: o.dedicated_spots != null ? Number(o.dedicated_spots) : null,
            spots_taken: o.spots_taken != null ? Number(o.spots_taken) : 0,
            waitlist_enabled: false,
          };
        }));
      } else {
        setPriceOptions([createLegacyPriceOption(event as any)]);
      }
    }
    setLoadingEvent(false);
  };

  if (authLoading) return null;
  if (!user || !isOrganizer) return <Navigate to="/" replace />;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Seleziona un file immagine", variant: "destructive" });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "L'immagine originale deve essere inferiore a 25MB", variant: "destructive" });
      return;
    }
    setCoverCropFile(file);
    e.target.value = "";
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setHomeCardImageFile(null);
    setHomeCardImageUrl("");
    setHomeCardImagePreview(null);
    updateForm("image_url", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadEventImageFile = async (file: File): Promise<string> => {
    if (!user) throw new Error("Utente non autenticato");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("event-images").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.image_url || null;
    setUploadingImage(true);
    try {
      return await uploadEventImageFile(imageFile);
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadHomeCardImage = async (): Promise<string | null> => {
    if (!homeCardImageFile) return homeCardImageUrl || null;
    return uploadEventImageFile(homeCardImageFile);
  };

  const normalizeGalleryFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length !== files.length) {
      toast({
        title: "Alcuni file non sono immagini",
        description: "Sono state considerate solo le immagini.",
        variant: "destructive",
      });
    }

    const validFiles = imageFiles.filter((file) => {
      if (file.size <= 25 * 1024 * 1024) return true;

      toast({
        title: "Immagine troppo grande",
        description: `${file.name} supera il limite di 25MB.`,
        variant: "destructive",
      });
      return false;
    });

    const remaining = 5 - form.gallery_images.length;
    if (remaining <= 0) {
      toast({
        title: "Hai raggiunto il limite massimo",
        description: "Puoi caricare fino a 5 immagini.",
        variant: "destructive",
      });
      return [];
    }

    if (validFiles.length > remaining) {
      toast({
        title: "Limite immagini raggiunto",
        description: `Sono state aggiunte solo le prime ${remaining} immagini disponibili.`,
      });
    }

    return validFiles.slice(0, remaining);
  };

  const uploadGalleryFiles = async (files: File[]) => {
    const filesToUpload = normalizeGalleryFiles(files);
    if (filesToUpload.length === 0) return;

    setGalleryUploading(true);
    setGalleryUploadProgress(0);
    setGalleryUploadTotal(filesToUpload.length);

    let completed = 0;
    const uploadPromises = filesToUpload.map(async (file) => {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error } = await supabase.storage.from("event-images").upload(fileName, file, {
        cacheControl: "31536000",
        contentType: file.type,
      });

      completed += 1;
      setGalleryUploadProgress(completed);

      if (error) {
        toast({ title: "Errore upload", description: error.message, variant: "destructive" });
        return null;
      }

      const { data: { publicUrl } } = supabase.storage.from("event-images").getPublicUrl(fileName);
      return publicUrl;
    });

    const results = await Promise.all(uploadPromises);
    const successfulUrls = results.filter((url): url is string => url !== null);

    if (successfulUrls.length > 0) {
      const newImages = successfulUrls.map((url, index) => ({
        url,
        order: form.gallery_images.length + index,
      }));
      updateForm("gallery_images", [...form.gallery_images, ...newImages]);
      toast({ title: `${successfulUrls.length} immagini caricate` });
    }

    setGalleryUploading(false);
  };

  const startGalleryCrop = (files: File[]) => {
    const filesToCrop = normalizeGalleryFiles(files);
    if (filesToCrop.length === 0) return;

    const [first, ...rest] = filesToCrop;
    setCroppedGalleryFiles([]);
    setGalleryCropQueue(rest);
    setActiveGalleryCropFile(first);
  };

  const handleGalleryCropComplete = async (file: File) => {
    const nextCropped = [...croppedGalleryFiles, file];
    const [nextFile, ...restQueue] = galleryCropQueue;

    if (nextFile) {
      setCroppedGalleryFiles(nextCropped);
      setGalleryCropQueue(restQueue);
      setActiveGalleryCropFile(nextFile);
      return;
    }

    setActiveGalleryCropFile(null);
    setGalleryCropQueue([]);
    setCroppedGalleryFiles([]);
    await uploadGalleryFiles(nextCropped);
  };

  const handleGalleryPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.clipboardData?.items || []);
    const pastedImages = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (pastedImages.length === 0) return;

    event.preventDefault();
    startGalleryCrop(
      pastedImages.map((file, index) => {
        if (file.name) return file;
        const extension = file.type.split("/")[1] || "png";
        return new File([file], `immagine-incollata-${Date.now()}-${index}.${extension}`, {
          type: file.type || "image/png",
        });
      }),
    );
  };

  const updateForm = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addPriceOption = () => {
    setPriceOptions((prev) => {
      const previous = prev[prev.length - 1];
      const paymentType = previous?.payment_type || "free";
      const price = paymentType === "free" ? 0 : Number(previous?.price || 0);
      const depositAmount = paymentType === "deposit"
        ? Number(previous?.deposit_amount ?? form.deposit ?? 0)
        : null;

      return [
        ...prev,
        createBlankPriceOption({
          price,
          payment_type: paymentType,
          deposit_amount: depositAmount,
          balance_amount: paymentType === "deposit" ? Math.max(0, price - Number(depositAmount || 0)) : null,
          balance_payment_mode: previous?.balance_payment_mode || form.balance_payment_mode,
        }),
      ];
    });
  };

  const hasPaidPriceOptions = priceOptions.some((option) => option.payment_type !== "free");

  const toggleFitScoreSecondaryCategory = (category: string) => {
    setFitScoreSecondaryCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((value) => value !== category);
      }
      if (prev.length >= FIT_SCORE_EVENT_SECONDARY_MAX) {
        return prev;
      }
      return [...prev, category];
    });
  };

  const addMeetingPoint = () => {
    setMeetingPoints((prev) => [...prev, { name: "", location: "", time: "08:00", notes: "" }]);
  };

  const updateMeetingPoint = (index: number, field: string, value: string) => {
    setMeetingPoints((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removeMeetingPoint = (index: number) => {
    setMeetingPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const addStaffMember = () => {
    setEventStaff((prev) => [
      ...prev,
      {
        profile_id: null,
        display_name: "",
        role_label: "Staff",
        avatar_url: null,
        is_public: true,
        profileSearch: "",
      },
    ]);
  };

  const updateStaffMember = (index: number, field: keyof EventStaffInput, value: string | boolean | null) => {
    setEventStaff((prev) => prev.map((member, i) => i === index ? { ...member, [field]: value } : member));
  };

  const selectStaffProfile = (index: number, profile: any) => {
    const displayName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "Staff";
    setEventStaff((prev) => prev.map((member, i) => i === index
      ? {
          ...member,
          profile_id: profile.id,
          display_name: displayName,
          avatar_url: profile.avatar_url || null,
          profileSearch: displayName,
        }
      : member
    ));
    setActiveStaffSearchIndex(null);
  };

  const clearStaffProfile = (index: number) => {
    setEventStaff((prev) => prev.map((member, i) => i === index
      ? { ...member, profile_id: null, avatar_url: null, profileSearch: "" }
      : member
    ));
  };

  const removeStaffMember = (index: number) => {
    setEventStaff((prev) => prev.filter((_, i) => i !== index));
    setActiveStaffSearchIndex((activeIndex) => activeIndex === index ? null : activeIndex);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, boolean> = {};
    if (!form.title) errors.title = true;
    if (!form.date) errors.date = true;
    if (!form.time) errors.time = true;
    if (!form.location) errors.location = true;
    if (!fitScoreMainCategory) errors.fit_score_main_category = true;
    if (!imageFile && !form.image_url) errors.image = true;

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const missingFields = [];
      if (errors.title) missingFields.push("Titolo");
      if (errors.date) missingFields.push("Data");
      if (errors.time) missingFields.push("Ora");
      if (errors.location) missingFields.push("Località");
      if (errors.image) missingFields.push("Immagine di copertina");
      setValidationPopupFields(missingFields);
      setValidationPopupOpen(true);
      return;
    }
    setValidationErrors({});

    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const resolvedHomeCardImageUrl = await uploadHomeCardImage();
      const explicitMeetingPointsForSave = meetingPoints;

      // Format duration with unit
      const durationFormatted = form.duration ? `${form.duration}${form.duration_unit === "giorni" ? " giorni" : "h"}` : null;
      // Format distance with km
      const distanceFormatted = form.distance ? `${form.distance} km` : null;
      // Format elevation with m
      const elevationFormatted = form.elevation ? `${form.elevation} m` : null;
      const validPriceOptions = priceOptions;
      const primaryPriceOption = validPriceOptions[0] || null;
      const primaryPaymentType = (primaryPriceOption?.payment_type || form.payment_type) as PaymentType;
      const primaryPrice = primaryPaymentType === "free"
        ? 0
        : (primaryPriceOption ? Number(primaryPriceOption.price || 0) : form.price);
      const primaryDeposit = primaryPaymentType === "deposit"
        ? Number(primaryPriceOption?.deposit_amount ?? form.deposit ?? 0)
        : null;
      const primaryBalancePaymentMode = primaryPaymentType === "deposit"
        ? ((primaryPriceOption?.balance_payment_mode || form.balance_payment_mode) as BalancePaymentMode)
        : null;
      const currentOrganizerName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Organizer";
      const resolvedOrganizerId = isEditing && !isDuplicating && existingOrganizer.id ? existingOrganizer.id : user.id;
      const resolvedOrganizerName = isEditing && !isDuplicating && existingOrganizer.name ? existingOrganizer.name : currentOrganizerName;

      const eventData = {
        title: form.title,
        description: form.description,
        date: form.date,
        time: form.time,
        location: form.location,
        location_label: form.location_label || null,
        category_id: form.category_id || null,
        spots_total: form.spots_total,
        reserved_spots: form.reserved_spots,
        price: primaryPrice,
        deposit: primaryDeposit,
        payment_type: primaryPaymentType,
        balance_payment_mode: primaryBalancePaymentMode,
        difficulty: form.difficulty || null,
        distance: distanceFormatted,
        elevation: elevationFormatted,
        duration: durationFormatted,
        featured: form.featured,
        cancellation_policy: policyType
          ? serializeCancellationPolicy(policyType as PolicyType, policyCustomText)
          : null,
        image_url: imageUrl,
        visibility: form.visibility,
        gallery_images: form.gallery_images as any,
        equipment_list: equipmentItems.filter((item) => item.name.trim()) as any,
        additional_fields: {
          [HOME_CARD_IMAGE_FIELD]: resolvedHomeCardImageUrl,
          closing_sentence: closingSentenceMode === "random" ? undefined : normalizeEventClosingSentence(closingSentence),
          fit_score_main_category: fitScoreMainCategory,
          fit_score_secondary_categories: fitScoreSecondaryCategories,
          fields: additionalFields.filter((f) => f.label.trim()),
          ask_car_availability: askCarAvailability,
          waiting_list_enabled: waitingListEnabled,
          weather_override_condition: weatherOverrideCondition || undefined,
          weather_override_temp_min: weatherOverrideTempMin ? parseFloat(weatherOverrideTempMin) : undefined,
          weather_override_temp_max: weatherOverrideTempMax ? parseFloat(weatherOverrideTempMax) : undefined,
          weather_override_temp_avg: weatherOverrideTempAvg ? parseFloat(weatherOverrideTempAvg) : undefined,
        } as any,
        access_rules: accessRules.length > 0 ? {
          rules: accessRules,
          exclusivity_label: exclusivityLabel || undefined,
          restriction_message: restrictionMessage || undefined,
        } as any : null,
        event_badges: [...manualBadges, ...(customBadge.trim() ? [customBadge.trim()] : [])] as any,
        organizer_id: resolvedOrganizerId,
        organizer_name: resolvedOrganizerName,
        status: eventStatus,
      };

      let eventId = id;

      if (isEditing) {
        const { error } = await supabase.from("events").update(eventData).eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert(eventData).select("id").single();
        if (error) throw error;
        eventId = data.id;

        // Mark proposal as converted if created from one
        const proposalId = searchParams.get("proposal_id");
        if (proposalId) {
          await supabase
            .from("activity_proposals" as any)
            .update({ status: "converted", updated_at: new Date().toISOString() } as any)
            .eq("id", proposalId);
        }
      }

      // Handle meeting points without breaking existing registration choices.
      if (isEditing) {
        const { data: existingPoints, error: existingPointsError } = await supabase
          .from("event_meeting_points")
          .select("id")
          .eq("event_id", eventId!);
        if (existingPointsError) throw existingPointsError;

        const removedPointIds = getRemovedMeetingPointIds(
          (existingPoints || []).map((point) => point.id),
          explicitMeetingPointsForSave,
        );

        if (removedPointIds.length > 0) {
          const { error: unlinkError } = await supabase
            .from("event_registrations")
            .update({ meeting_point_id: null })
            .in("meeting_point_id", removedPointIds);
          if (unlinkError) throw unlinkError;

          const { error: deleteError } = await supabase
            .from("event_meeting_points")
            .delete()
            .in("id", removedPointIds)
            .eq("event_id", eventId!);
          if (deleteError) throw deleteError;
        }

        const retainedPointIds = new Set(getRetainedMeetingPointIds(explicitMeetingPointsForSave));
        for (const [index, point] of explicitMeetingPointsForSave.entries()) {
          const pointPayload = {
            name: point.name,
            location: point.location,
            time: point.time,
            notes: point.notes || null,
            sort_order: index,
          };

          if (point.id && retainedPointIds.has(point.id)) {
            const { error: updatePointError } = await supabase
              .from("event_meeting_points")
              .update(pointPayload)
              .eq("id", point.id)
              .eq("event_id", eventId!);
            if (updatePointError) throw updatePointError;
          } else {
            const { error: insertPointError } = await supabase
              .from("event_meeting_points")
              .insert({ event_id: eventId!, ...pointPayload });
            if (insertPointError) throw insertPointError;
          }
        }
      } else if (explicitMeetingPointsForSave.length > 0) {
        const pointsData = explicitMeetingPointsForSave.map((p, i) => ({
          event_id: eventId!,
          name: p.name,
          location: p.location,
          time: p.time,
          notes: p.notes || null,
          sort_order: i,
        }));
        const { error } = await supabase.from("event_meeting_points").insert(pointsData);
        if (error) throw error;
      }

      const { error: deleteStaffError } = await supabase
        .from("event_staff" as any)
        .delete()
        .eq("event_id", eventId!);
      if (deleteStaffError) throw deleteStaffError;

      const staffData = eventStaff
        .map((member, index) => ({
          event_id: eventId!,
          profile_id: member.profile_id || null,
          display_name: member.display_name.trim(),
          role_label: member.role_label.trim() || "Staff",
          avatar_url: member.avatar_url || null,
          sort_order: index,
          is_public: member.is_public,
        }))
        .filter((member) => member.display_name);

      if (staffData.length > 0) {
        const { error: insertStaffError } = await supabase
          .from("event_staff" as any)
          .insert(staffData);
        if (insertStaffError) throw insertStaffError;
      }

      if (isEditing) {
        const { error: deleteSpecialBadgesError } = await supabase
          .from("event_special_badges")
          .delete()
          .eq("event_id", eventId!);
        if (deleteSpecialBadgesError) throw deleteSpecialBadgesError;
      }

      if (eventSpecialBadgeIds.length > 0) {
        const specialBadgeLinks = Array.from(new Set(eventSpecialBadgeIds)).map((badgeId) => ({
          event_id: eventId!,
          badge_id: badgeId,
        }));
        const { error: specialBadgesError } = await supabase
          .from("event_special_badges")
          .insert(specialBadgeLinks);
        if (specialBadgesError) throw specialBadgesError;
      }

      // Handle price options without breaking existing price_option_id registrations.
      const retainedOptionIds = validPriceOptions
        .map((option) => option.id)
        .filter((optionId): optionId is string => Boolean(optionId));

      if (isEditing) {
        const { data: existingOptions, error: existingOptionsError } = await supabase
          .from("event_price_options")
          .select("id")
          .eq("event_id", eventId!);
        if (existingOptionsError) throw existingOptionsError;

        const removedOptions = (existingOptions || []).filter((option) => !retainedOptionIds.includes(option.id));
        for (const removedOption of removedOptions) {
          const { data: linkedRegistrations, error: linkedRegistrationsError } = await supabase
            .from("event_registrations")
            .select("id")
            .eq("price_option_id", removedOption.id)
            .limit(1);
          if (linkedRegistrationsError) throw linkedRegistrationsError;
          if ((linkedRegistrations || []).length > 0) continue;

          const { error: deleteOptionError } = await supabase
            .from("event_price_options")
            .delete()
            .eq("id", removedOption.id)
            .eq("event_id", eventId!);
          if (deleteOptionError) throw deleteOptionError;
        }
      }

      for (const [index, option] of validPriceOptions.entries()) {
        const optionPaymentType = option.payment_type || primaryPaymentType;
        const optionDepositAmount = optionPaymentType === "deposit"
          ? Number(option.deposit_amount ?? Math.min(Number(option.price || 0), Number(form.deposit || 0)))
          : null;
        const optionBalanceAmount = optionPaymentType === "deposit"
          ? Math.max(0, Number(option.price || 0) - Number(optionDepositAmount || 0))
          : null;
        const optionPayload = {
          event_id: eventId!,
          name: option.name.trim() || fallbackFormulaName(index),
          price: optionPaymentType === "free" ? 0 : Number(option.price || 0),
          sort_order: index,
          eligible_group: option.eligible_group || "all",
          original_price: option.original_price || null,
          is_promotional: option.is_promotional || false,
          promo_start: promoDateInputToIso(option.promo_start, "start"),
          promo_end: promoDateInputToIso(option.promo_end, "end"),
          payment_type: optionPaymentType,
          deposit_amount: optionDepositAmount,
          balance_amount: optionBalanceAmount,
          balance_payment_mode: optionPaymentType === "deposit" ? option.balance_payment_mode : null,
          has_dedicated_spots: !!option.has_dedicated_spots,
          dedicated_spots: option.has_dedicated_spots ? Number(option.dedicated_spots || 0) : null,
          waitlist_enabled: false,
        };

        if (isEditing && option.id) {
          const { error: updateOptionError } = await supabase
            .from("event_price_options")
            .update(optionPayload)
            .eq("id", option.id)
            .eq("event_id", eventId!);
          if (updateOptionError) throw updateOptionError;
        } else {
          const { error: insertOptionError } = await supabase
            .from("event_price_options")
            .insert(optionPayload);
          if (insertOptionError) throw insertOptionError;
        }
      }

      toast({ title: isEditing ? "Evento aggiornato!" : "Evento creato!" });
      navigate(`/organizer/events/${eventId}`);
    } catch (err: any) {
      toast({ title: "Errore nel salvataggio", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loadingEvent) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <ImageCropDialog
        open={!!coverCropFile}
        file={coverCropFile}
        title="Ritaglia copertina"
        description="Scegli il ritaglio 1:1 usato nel dettaglio evento."
        aspect={{ width: 1, height: 1 }}
        outputWidth={1200}
        outputHeight={1200}
        onCancel={() => setCoverCropFile(null)}
        onCropped={(croppedFile) => {
          const originalFile = coverCropFile;
          setCoverCropFile(null);
          setImageFile(croppedFile);
          setImagePreview(URL.createObjectURL(croppedFile));
          setHomeCardImageFile(null);
          setHomeCardImageUrl("");
          setHomeCardImagePreview(null);
          if (originalFile) setCoverHomeCropFile(originalFile);
        }}
      />
      <ImageCropDialog
        open={!!coverHomeCropFile}
        file={coverHomeCropFile}
        title="Ritaglia anteprima home"
        description="Scegli la porzione quadrata mostrata nelle card della home."
        aspect={{ width: 1, height: 1 }}
        outputWidth={1200}
        outputHeight={1200}
        onCancel={() => setCoverHomeCropFile(null)}
        onCropped={(croppedFile) => {
          setCoverHomeCropFile(null);
          setHomeCardImageFile(croppedFile);
          setHomeCardImagePreview(URL.createObjectURL(croppedFile));
          setHomeCardImageUrl("");
        }}
      />
      <ImageCropDialog
        open={!!activeGalleryCropFile}
        file={activeGalleryCropFile}
        title="Ritaglia immagine galleria"
        description={`Immagine ${croppedGalleryFiles.length + 1} di ${croppedGalleryFiles.length + galleryCropQueue.length + (activeGalleryCropFile ? 1 : 0)}`}
        aspect={{ width: 1, height: 1 }}
        outputWidth={1200}
        outputHeight={1200}
        onCancel={() => {
          setActiveGalleryCropFile(null);
          setGalleryCropQueue([]);
          setCroppedGalleryFiles([]);
        }}
        onCropped={(croppedFile) => {
          void handleGalleryCropComplete(croppedFile);
        }}
      />
      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-display text-xl font-bold text-foreground">
            {isEditing ? "Modifica evento" : isDuplicating ? "Duplica evento" : "Crea evento"}
          </h1>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 1. INFORMAZIONI BASE */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Informazioni base</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Titolo *</Label>
              <Input id="title" value={form.title} onChange={(e) => { updateForm("title", e.target.value); setValidationErrors(prev => ({ ...prev, title: false })); }} placeholder="Titolo evento" className={validationErrors.title ? "border-destructive ring-destructive/20 ring-2" : ""} />
              {validationErrors.title && <p className="text-xs text-destructive mt-1">Il titolo è obbligatorio</p>}
            </div>
            <div>
              <Label htmlFor="description">Descrizione</Label>
              <RichTextEditor 
                content={form.description} 
                onChange={(content) => updateForm("description", content)} 
                placeholder="Descrivi l'evento..." 
              />
            </div>
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                Frase conclusiva
              </Label>
              <Select
                value={closingSentenceMode}
                onValueChange={(value) => {
                  const mode = value as "random" | "preset" | "manual";
                  setClosingSentenceMode(mode);
                  if (mode === "random") setClosingSentence("");
                  if (mode === "preset" && !closingSentence) setClosingSentence(closingSentenceOptions[0]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="preset">Scegli frase</SelectItem>
                  <SelectItem value="manual">Frase manuale</SelectItem>
                </SelectContent>
              </Select>

              {closingSentenceMode === "preset" && (
                <Select value={closingSentence || closingSentenceOptions[0]} onValueChange={setClosingSentence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {closingSentenceOptions.map((sentence) => (
                      <SelectItem key={sentence} value={sentence}>
                        {sentence}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {closingSentenceMode === "manual" && (
                <Input
                  value={closingSentence}
                  onChange={(event) => setClosingSentence(event.target.value)}
                  placeholder="Inserisci una frase conclusiva"
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Le frasi disponibili si gestiscono da Admin &gt; Frasi evento. Random usa automaticamente una frase attiva.
              </p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <div className="min-w-0">
                <Label htmlFor="date">Data *</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => { updateForm("date", e.target.value); setValidationErrors(prev => ({ ...prev, date: false })); }} className={validationErrors.date ? "border-destructive ring-destructive/20 ring-2" : ""} />
                {validationErrors.date && <p className="text-xs text-destructive mt-1">Obbligatorio</p>}
              </div>
              <div className="min-w-0">
                <Label htmlFor="time">Ora *</Label>
                <Input id="time" type="time" value={form.time} onChange={(e) => { updateForm("time", e.target.value); setValidationErrors(prev => ({ ...prev, time: false })); }} className={validationErrors.time ? "border-destructive ring-destructive/20 ring-2" : ""} />
                {validationErrors.time && <p className="text-xs text-destructive mt-1">Obbligatorio</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="location">Località *</Label>
              <LocationAutocomplete
                id="location"
                value={form.location}
                onChange={(val) => { updateForm("location", val); setValidationErrors(prev => ({ ...prev, location: false })); }}
                placeholder="Cerca località..."
                error={validationErrors.location}
              />
              {validationErrors.location && <p className="text-xs text-destructive mt-1">La località è obbligatoria</p>}
              <div className="mt-2">
                <Label htmlFor="location_label" className="text-xs text-muted-foreground">Etichetta personalizzata <span className="text-muted-foreground/60">(opzionale)</span></Label>
                <Input
                  id="location_label"
                  value={form.location_label}
                  onChange={(e) => updateForm("location_label", e.target.value)}
                  placeholder="es. Metro La Rustica"
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Se vuoto, verrà mostrato l'indirizzo completo</p>
              </div>
            </div>
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => updateForm("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-border/50 p-3">
            <div>
              <Label className="text-sm font-semibold">Categoria principale</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Obbligatoria per il KPI "Quanto fa per te".
              </p>
              <Select
                value={fitScoreMainCategory}
                onValueChange={(value) => {
                  setFitScoreMainCategory(value);
                  setValidationErrors((prev) => ({ ...prev, fit_score_main_category: false }));
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Seleziona la categoria principale" />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.label}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.fit_score_main_category && (
                <p className="text-xs text-destructive mt-1">La categoria principale e obbligatoria.</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-semibold">Categorie secondarie</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Facoltative, massimo {FIT_SCORE_EVENT_SECONDARY_MAX}.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {INTEREST_CATEGORY_OPTIONS.filter((option) => option.label !== fitScoreMainCategory).map((option) => {
                  const selected = fitScoreSecondaryCategories.includes(option.label);
                  const disabled = !selected && fitScoreSecondaryCategories.length >= FIT_SCORE_EVENT_SECONDARY_MAX;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleFitScoreSecondaryCategory(option.label)}
                      disabled={disabled}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/40 text-foreground"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3 border-t border-border/50 pt-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Badge speciali evento</h3>
              </div>
              <EventSpecialBadgeSelector
                selectedIds={eventSpecialBadgeIds}
                onChange={setEventSpecialBadgeIds}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Staff evento</h2>
              <p className="text-xs text-muted-foreground mt-1">
                L'organizzatore viene mostrato automaticamente per primo. Qui puoi aggiungere staff, fotografi o collaboratori.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addStaffMember} className="shrink-0">
              <Plus className="h-4 w-4" />
              Staff
            </Button>
          </div>

          {eventStaff.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm font-body text-muted-foreground">Nessuno staff aggiuntivo inserito.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {eventStaff.map((member, index) => (
                <div key={member.id || index} className="rounded-xl border border-border/60 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <span className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                          {member.display_name.trim()[0] || "S"}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{member.display_name || "Nuovo membro staff"}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.profile_id ? "Profilo collegato" : "Inserimento manuale"}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStaffMember(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Cerca profilo utente</Label>
                    <div className="relative">
                      <Input
                        value={member.profileSearch}
                        onFocus={() => setActiveStaffSearchIndex(index)}
                        onChange={(event) => {
                          updateStaffMember(index, "profileSearch", event.target.value);
                          setActiveStaffSearchIndex(index);
                        }}
                        placeholder="Cerca per nome, cognome o email"
                      />
                      {activeStaffSearchIndex === index && staffProfileResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-lg border border-border bg-popover p-1 shadow-lg">
                          {staffProfileResults.map((profile: any) => {
                            const profileName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "Utente";
                            return (
                              <button
                                key={profile.id}
                                type="button"
                                onClick={() => selectStaffProfile(index, profile)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                              >
                                {profile.avatar_url ? (
                                  <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                                ) : (
                                  <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold">
                                    {profileName[0] || "U"}
                                  </span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">{profileName}</span>
                                  {profile.email && <span className="block truncate text-[11px] text-muted-foreground">{profile.email}</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {member.profile_id && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => clearStaffProfile(index)} className="h-7 px-2 text-xs">
                        Usa nominativo manuale
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs">Nome visualizzato</Label>
                      <Input
                        value={member.display_name}
                        onChange={(event) => updateStaffMember(index, "display_name", event.target.value)}
                        placeholder="Nome e cognome"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Ruolo</Label>
                      <Select
                        value={STAFF_ROLE_PRESETS.includes(member.role_label as any) ? member.role_label : CUSTOM_STAFF_ROLE_VALUE}
                        onValueChange={(value) => {
                          updateStaffMember(index, "role_label", value === CUSTOM_STAFF_ROLE_VALUE ? "" : value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona ruolo" />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_ROLE_PRESETS.map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_STAFF_ROLE_VALUE}>Campo libero</SelectItem>
                        </SelectContent>
                      </Select>
                      {!STAFF_ROLE_PRESETS.includes(member.role_label as any) && (
                        <Input
                          className="mt-2"
                          value={member.role_label}
                          onChange={(event) => updateStaffMember(index, "role_label", event.target.value)}
                          placeholder="Inserisci ruolo"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                    <Label className="text-xs text-muted-foreground">Visibile nel dettaglio evento</Label>
                    <Switch
                      checked={member.is_public}
                      onCheckedChange={(checked) => updateStaffMember(index, "is_public", checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 2. GALLERIA */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Galleria</h2>
          <div className="space-y-3">
            {/* Event Image */}
            <div>
              <Label>Immagine di copertina</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="mt-2 space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img src={imagePreview} alt="Preview" className="w-full aspect-square object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background"
                    >
                      <X className="h-4 w-4 text-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/35 p-3">
                    <img
                      src={homeCardImagePreview || homeCardImageUrl || imagePreview}
                      alt="Anteprima home"
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-body font-semibold text-foreground">Anteprima home</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">Riquadro 1:1 usato nelle card evento.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      Cambia
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clicca per caricare un'immagine</span>
                  <span className="text-xs text-muted-foreground">Riduzione automatica, max 25MB</span>
                </button>
              )}
            </div>

            {/* Gallery Images */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Galleria evento (Max 5)</Label>
                <span className="text-[10px] text-muted-foreground font-body">{form.gallery_images.length}/5 immagini</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {form.gallery_images.sort((a,b) => a.order - b.order).map((img, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 group">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                      <img src={img.url} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-body text-muted-foreground truncate">Immagine {index + 1}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        disabled={index === 0}
                        onClick={() => {
                          const newGallery = [...form.gallery_images];
                          const current = newGallery.find(g => g.order === index);
                          const prev = newGallery.find(g => g.order === index - 1);
                          if (current && prev) { current.order -= 1; prev.order += 1; updateForm("gallery_images", [...newGallery]); }
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        disabled={index === form.gallery_images.length - 1}
                        onClick={() => {
                          const newGallery = [...form.gallery_images];
                          const current = newGallery.find(g => g.order === index);
                          const next = newGallery.find(g => g.order === index + 1);
                          if (current && next) { current.order += 1; next.order -= 1; updateForm("gallery_images", [...newGallery]); }
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          const newGallery = form.gallery_images.filter((_, i) => i !== index).map((g, i) => ({ ...g, order: i }));
                          updateForm("gallery_images", newGallery);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {form.gallery_images.length < 5 && (
                  <div
                    className="relative"
                    onPaste={handleGalleryPaste}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        startGalleryCrop(files);
                        e.target.value = '';
                      }}
                    />
                    {galleryUploading ? (
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/50 rounded-xl bg-primary/5">
                        <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
                        <p className="text-xs font-body font-semibold text-foreground">Caricamento {galleryUploadProgress}/{galleryUploadTotal}...</p>
                        <div className="w-full mt-2 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${galleryUploadTotal > 0 ? (galleryUploadProgress / galleryUploadTotal) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                        tabIndex={0}
                        role="button"
                        aria-label="Aggiungi o incolla immagini della galleria"
                      >
                        <Plus className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-xs font-body font-semibold text-foreground">Aggiungi immagini</p>
                        <p className="text-[10px] text-muted-foreground font-body">PNG, JPG fino a 25MB; ottimizzate automaticamente</p>
                        <p className="text-[10px] text-muted-foreground font-body mt-1 text-center">
                          Puoi anche incollare un'immagine copiata dal browser con Ctrl+V
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 3. CAPIENZA */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Capienza</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="spots">Posti totali</Label>
              <Input id="spots" type="number" min={1} value={form.spots_total || ""} onChange={(e) => updateForm("spots_total", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} onBlur={() => { if (!form.spots_total) updateForm("spots_total", 1); }} />
            </div>
            <div>
              <Label htmlFor="reserved">Posti riservati</Label>
              <Input id="reserved" type="number" min={0} max={form.spots_total} value={form.reserved_spots || ""} onChange={(e) => updateForm("reserved_spots", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} />
              <p className="text-[11px] text-muted-foreground font-body mt-1">Posti riservati per registrazioni manuali/offline. Contano verso la capacità totale.</p>
            </div>
          </div>
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 4. PAGAMENTO */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Pagamento</h2>
          <div className="space-y-3">
            {/* Cancellation Policy */}
            {hasPaidPriceOptions ? (
              <div>
                <Label>Termini di cancellazione</Label>
                <Select value={policyType} onValueChange={(v) => setPolicyType(v as PolicyType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleziona una politica" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.values(CANCELLATION_POLICIES)).map((p) => {
                      const Icon = p.icon;
                      return (
                        <SelectItem key={p.type} value={p.type}>
                          <span className={`inline-flex items-center gap-1.5 ${p.colorClass}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {p.labelIt}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {policyType && (
                  <p className={`mt-1.5 text-xs font-body px-1 ${CANCELLATION_POLICIES[policyType as PolicyType]?.colorClass || 'text-muted-foreground'}`}>
                    {CANCELLATION_POLICIES[policyType as PolicyType]?.descriptionIt}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <p className="text-sm font-body font-semibold text-foreground">Regole eventi gratuiti</p>
                <p className="text-xs font-body text-muted-foreground mt-1">
                  Per gli eventi gratuiti non viene mostrata alcuna policy di rimborso. Gli utenti vedranno solo le regole di comportamento e cancellazione del posto.
                </p>
              </div>
            )}

            {/* ── Modalità di partecipazione ── */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  Formule di pagamento
                </Label>
                <p className="text-[11px] text-muted-foreground font-body">Ogni prezzo, acconto o pagamento sul posto viene gestito dentro una formula.</p>
              </div>
                {priceOptions.map((opt, index) => (
                  <div key={index} className="p-3 bg-background rounded-lg space-y-2 border border-border/50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Formula {index + 1}</p>
                      {priceOptions.length > 1 && (
                        <button type="button" onClick={() => setPriceOptions(prev => prev.filter((_, i) => i !== index))} className="text-destructive p-1" aria-label={`Rimuovi formula ${index + 1}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Nome formula"
                          value={opt.name}
                          onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, name: e.target.value } : o))}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="€ Prezzo"
                          value={opt.payment_type === "free" ? 0 : (opt.price || "")}
                          disabled={opt.payment_type === "free"}
                          className={opt.payment_type === "free" ? "opacity-60" : ""}
                          onChange={(e) => setPriceOptions(prev => prev.map((o, i) => {
                            if (i !== index) return o;
                            const price = parseFloat(e.target.value) || 0;
                            return {
                              ...o,
                              price,
                              balance_amount: o.payment_type === "deposit" ? Math.max(0, price - Number(o.deposit_amount || 0)) : o.balance_amount,
                            };
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Pagamento formula</Label>
                        <Select
                          value={opt.payment_type}
                          onValueChange={(v) => setPriceOptions(prev => prev.map((o, i) => {
                            if (i !== index) return o;
                            const paymentType = v as PaymentType;
                            const price = paymentType === "free" ? 0 : Number(o.price || 0);
                            const depositAmount = paymentType === "deposit" ? (o.deposit_amount ?? form.deposit ?? 0) : null;
                            return {
                              ...o,
                              price,
                              payment_type: paymentType,
                              deposit_amount: depositAmount,
                              balance_amount: paymentType === "deposit" ? Math.max(0, price - Number(depositAmount || 0)) : null,
                              balance_payment_mode: paymentType === "deposit" ? o.balance_payment_mode : form.balance_payment_mode,
                            };
                          }))}
                        >
                          <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Gratis</SelectItem>
                            <SelectItem value="paid">Online completo</SelectItem>
                            <SelectItem value="location">Sul posto</SelectItem>
                            <SelectItem value="deposit">Acconto + saldo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {opt.payment_type === "deposit" && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Acconto (€)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="h-8 text-xs mt-0.5"
                            value={opt.deposit_amount ?? ""}
                            onChange={(e) => setPriceOptions(prev => prev.map((o, i) => {
                              if (i !== index) return o;
                              const depositAmount = e.target.value ? parseFloat(e.target.value) || 0 : 0;
                              return {
                                ...o,
                                deposit_amount: depositAmount,
                                balance_amount: Math.max(0, Number(o.price || 0) - depositAmount),
                              };
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Saldo calcolato</Label>
                          <div className="h-8 mt-0.5 flex items-center rounded-md border border-input bg-muted/40 px-3 text-xs font-semibold text-foreground">
                            €{Math.max(0, Number(opt.price || 0) - Number(opt.deposit_amount || 0)).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Saldo</Label>
                          <Select value={opt.balance_payment_mode} onValueChange={(v) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, balance_payment_mode: v as BalancePaymentMode } : o))}>
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="online">Online</SelectItem>
                              <SelectItem value="on_site">Sul posto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={opt.has_dedicated_spots}
                          onCheckedChange={(v) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, has_dedicated_spots: v, dedicated_spots: v ? (o.dedicated_spots ?? 1) : null } : o))}
                        />
                        <Label className="text-xs">Posti dedicati</Label>
                      </div>
                      {opt.has_dedicated_spots && (
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Posti formula</Label>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 text-xs mt-0.5"
                            value={opt.dedicated_spots ?? ""}
                            onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, dedicated_spots: e.target.value ? parseInt(e.target.value) || 0 : 0 } : o))}
                          />
                          {opt.spots_taken ? (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{opt.spots_taken} gia presi</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Chi vede questo prezzo</Label>
                        <Select value={opt.eligible_group.startsWith("badge:") ? "badges" : opt.eligible_group.startsWith("trekking_gt:") ? "trekking_gt" : opt.eligible_group.startsWith("events_gt:") ? "events_gt" : opt.eligible_group} onValueChange={(v) => {
                          if (v === "badges") {
                            setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: "badges", badge_ids: o.badge_ids || [] } : o));
                          } else if (v === "trekking_gt") {
                            setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: "trekking_gt:1", badge_ids: [] } : o));
                          } else if (v === "events_gt") {
                            setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: "events_gt:1", badge_ids: [] } : o));
                          } else {
                            setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: v, badge_ids: [] } : o));
                          }
                        }}>
                          <SelectTrigger className="h-8 text-xs mt-0.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tutti</SelectItem>
                            <SelectItem value="members">Membri attivi</SelectItem>
                            <SelectItem value="new_users">Nuovi utenti (0 eventi)</SelectItem>
                            <SelectItem value="experienced">Utenti esperti (1+ eventi)</SelectItem>
                            <SelectItem value="loyal">Partecipanti fedeli (5+ eventi)</SelectItem>
                            <SelectItem value="badges">Badge specifico/i</SelectItem>
                            <SelectItem value="trekking_gt">Numero trekking &gt; X</SelectItem>
                            <SelectItem value="events_gt">Numero eventi &gt; X</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Prezzo originale (barrato)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="€ (opzionale)"
                          className="h-8 text-xs mt-0.5"
                          value={opt.original_price ?? ""}
                          onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, original_price: e.target.value ? parseFloat(e.target.value) : null } : o))}
                        />
                      </div>
                    </div>
                    {/* Badge selector when "badges" group is chosen */}
                    {(opt.eligible_group === "badges" || opt.eligible_group.startsWith("badge:")) && (
                      <MultiBadgeSelector
                        selectedIds={opt.badge_ids || []}
                        label="Seleziona badge — l'utente deve averne almeno uno"
                        onChange={(ids) => {
                          const group = ids.length > 0 ? `badge:${ids.join(",")}` : "badges";
                          setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, badge_ids: ids, eligible_group: group } : o));
                        }}
                      />
                    )}
                    {/* Trekking count rule */}
                    {(opt.eligible_group.startsWith("trekking_gt:")) && (
                      <div className="flex items-center gap-2">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Numero trekking &gt;</Label>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-xs w-20"
                          value={parseInt(opt.eligible_group.split(":")[1]) || ""}
                          onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: `trekking_gt:${e.target.value || "1"}` } : o))}
                        />
                      </div>
                    )}
                    {/* Events count rule */}
                    {(opt.eligible_group.startsWith("events_gt:")) && (
                      <div className="flex items-center gap-2">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Numero eventi &gt;</Label>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-xs w-20"
                          value={parseInt(opt.eligible_group.split(":")[1]) || ""}
                          onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: `events_gt:${e.target.value || "1"}` } : o))}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={opt.is_promotional}
                        onCheckedChange={(v) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, is_promotional: v } : o))}
                      />
                      <Label className="text-xs">Promo a tempo limitato</Label>
                    </div>
                    {opt.is_promotional && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Inizio promo</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs mt-0.5"
                            value={opt.promo_start}
                            onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, promo_start: e.target.value } : o))}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Fine promo</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs mt-0.5"
                            value={opt.promo_end}
                            onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, promo_end: e.target.value } : o))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPriceOption} className="w-full gap-1">
                  <Plus className="h-3.5 w-3.5" /> Aggiungi formula
                </Button>
                {priceOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground font-body text-center py-1">Aggiungi almeno una formula per definire pagamento e prezzo.</p>
                )}
              </div>
          </div>
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 4. DETTAGLI EVENTO */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Dettagli evento</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="difficulty">Difficoltà</Label>
              <Select value={form.difficulty} onValueChange={(v) => updateForm("difficulty", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nessuna difficoltà —</SelectItem>
                  {(difficultyLevels || []).map((lvl) => (
                    <SelectItem key={lvl.id} value={String(lvl.level_number)}>
                      {lvl.icon} Livello {lvl.level_number} – {lvl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="duration">Durata</Label>
              <div className="flex gap-1.5">
                <Input id="duration" type="number" min={0} step={0.5} value={form.duration} onChange={(e) => updateForm("duration", e.target.value)} placeholder="es. 4" className="flex-1" />
                <Select value={form.duration_unit} onValueChange={(v) => updateForm("duration_unit", v)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h">ore (h)</SelectItem>
                    <SelectItem value="giorni">giorni</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="distance">Distanza</Label>
              <div className="relative">
                <Input id="distance" type="number" min={0} step={0.1} value={form.distance} onChange={(e) => updateForm("distance", e.target.value)} placeholder="es. 12" className="pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
              </div>
            </div>
            <div>
              <Label htmlFor="elevation">Dislivello</Label>
              <div className="relative">
                <Input id="elevation" type="number" min={0} step={10} value={form.elevation} onChange={(e) => updateForm("elevation", e.target.value)} placeholder="es. 500" className="pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="featured" checked={form.featured} onCheckedChange={(v) => updateForm("featured", v)} />
            <Label htmlFor="featured">Evento in evidenza</Label>
          </div>

          {/* Badge evento */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              🏷️ Badge evento
            </Label>
            <p className="text-[11px] text-muted-foreground font-body">Seleziona fino a 2 badge manuali. I badge auto (Ultimi posti, Gratuito, Founding Event) vengono applicati automaticamente.</p>
            <div className="flex flex-wrap gap-1.5">
              {MANUAL_BADGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setManualBadges(prev =>
                      prev.includes(opt.value)
                        ? prev.filter(b => b !== opt.value)
                        : prev.length < 2 ? [...prev, opt.value] : prev
                    );
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    manualBadges.includes(opt.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border/50 hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Badge personalizzato (opzionale)</Label>
              <Input
                placeholder="es. Nuovo formato"
                value={customBadge}
                onChange={(e) => setCustomBadge(e.target.value)}
                className="h-8 text-xs mt-0.5"
                maxLength={25}
              />
            </div>
          </div>

          {/* Override Meteo */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              🌤️ Override meteo (opzionale)
            </Label>
            <p className="text-[11px] text-muted-foreground font-body">
              Lascia vuoto per usare la previsione automatica. Seleziona una condizione per sovrascrivere.
            </p>
            <div>
              <Label className="text-xs">Condizione meteo</Label>
              <Select value={weatherOverrideCondition || "none"} onValueChange={(v) => setWeatherOverrideCondition(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona condizione..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Previsioni meteo
                  </div>
                  <SelectItem value="none">— Nessun override —</SelectItem>
                  <SelectItem value="sereno">☀️ Sereno</SelectItem>
                  <SelectItem value="parzialmente_nuvoloso">🌤 Parzialmente nuvoloso</SelectItem>
                  <SelectItem value="nuvoloso">☁️ Nuvoloso</SelectItem>
                  <SelectItem value="pioggia_debole">🌦️ Pioggia debole</SelectItem>
                  <SelectItem value="pioggia">🌧 Pioggia</SelectItem>
                  <SelectItem value="temporale">⛈ Temporale</SelectItem>
                  <SelectItem value="ventoso">🌬 Ventoso</SelectItem>
                  <SelectItem value="neve">❄️ Neve</SelectItem>
                  <SelectItem value="nebbia">🌫 Nebbia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {weatherOverrideCondition && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Temp. min (°C)</Label>
                  <Input type="number" value={weatherOverrideTempMin} onChange={(e) => setWeatherOverrideTempMin(e.target.value)} placeholder="es. 8" />
                </div>
                <div>
                  <Label className="text-xs">Temp. max (°C)</Label>
                  <Input type="number" value={weatherOverrideTempMax} onChange={(e) => setWeatherOverrideTempMax(e.target.value)} placeholder="es. 22" />
                </div>
                <div>
                  <Label className="text-xs">Temp. media (°C)</Label>
                  <Input type="number" value={weatherOverrideTempAvg} onChange={(e) => setWeatherOverrideTempAvg(e.target.value)} placeholder="es. 15" />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 5. REGOLE DI ISCRIZIONE */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-5">
          <div>
            <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Regole di iscrizione
            </h2>
            <p className="text-xs text-muted-foreground font-body mt-1">
              Configura chi può vedere, accedere e registrarsi a questo evento.
            </p>
          </div>

          {/* Visibilità */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              👁️ Visibilità
            </Label>
            <p className="text-[11px] text-muted-foreground font-body">Chi può vedere questo evento nelle liste e nella ricerca.</p>
            <Select value={form.visibility} onValueChange={(v) => updateForm("visibility", v)}>
              <SelectTrigger><SelectValue placeholder="Seleziona visibilità" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">🌍 Pubblico — Visibile a tutti</SelectItem>
                <SelectItem value="private">🔗 Privato — Solo link diretto</SelectItem>
                <SelectItem value="hidden">👁️ Nascosto — Solo organizzatori e admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground font-body">
              {form.visibility === "public" && "Tutti possono trovare e visualizzare questo evento."}
              {form.visibility === "private" && "Non visibile nella scoperta. Accessibile solo tramite link diretto o invito."}
              {form.visibility === "hidden" && "Invisibile agli utenti normali. Solo organizzatori e amministratori possono vederlo."}
            </p>
          </div>

          {/* Stato evento */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  📝 Stato evento
                </Label>
                <p className="text-[11px] text-muted-foreground font-body">
                  Lo stato governa visibilita, iscrizioni, CTA e riepiloghi utente.
                </p>
              </div>
              <Select value={eventStatus} onValueChange={(value) => setEventStatus(value as EventStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground font-body">
                {EVENT_STATUS_OPTIONS.find((option) => option.value === eventStatus)?.description}
              </p>
            </div>
          </div>

          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  Lista d'attesa
                </Label>
                <p className="text-[11px] text-muted-foreground font-body">
                  Se l'evento e sold out, gli utenti possono entrare in lista senza occupare posti o generare pagamenti.
                </p>
              </div>
              <Switch checked={waitingListEnabled} onCheckedChange={setWaitingListEnabled} />
            </div>
          </div>

          {/* Requisiti di Registrazione */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                🔒 Requisiti di registrazione
              </Label>
              <p className="text-[11px] text-muted-foreground font-body">Chi può registrarsi. Gli utenti che non soddisfano i requisiti vedranno un messaggio di restrizione.</p>
            </div>

            {/* GROUP 1: 🧠 Profilo partecipante */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">🧠 Profilo partecipante</p>

              {/* Livello minimo */}
              <RuleToggleRow
                label="Livello minimo richiesto"
                isActive={accessRules.some(r => r.type === "min_level")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "min_level", value: 1, enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "min_level"));
                }}
              >
                {accessRules.find(r => r.type === "min_level") && (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={String(accessRules.find(r => r.type === "min_level")?.value || "1")}
                      onValueChange={(v) => setAccessRules(prev => prev.map(r => r.type === "min_level" ? { ...r, value: parseInt(v) } : r))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Principiante</SelectItem>
                        <SelectItem value="2">Intermedio</SelectItem>
                        <SelectItem value="3">Avanzato</SelectItem>
                      </SelectContent>
                    </Select>
                    <EnforcementToggle rule={accessRules.find(r => r.type === "min_level")!} onChange={(enforcement) => setAccessRules(prev => prev.map(r => r.type === "min_level" ? { ...r, enforcement } : r))} />
                  </div>
                )}
              </RuleToggleRow>

              {/* Esperienze minime */}
              <RuleToggleRow
                label="Numero minimo di esperienze"
                isActive={accessRules.some(r => r.type === "min_experience")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "min_experience", value: 1, enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "min_experience"));
                }}
              >
                {accessRules.find(r => r.type === "min_experience") && (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={String(accessRules.find(r => r.type === "min_experience")?.value || "1")}
                      onValueChange={(v) => setAccessRules(prev => prev.map(r => r.type === "min_experience" ? { ...r, value: parseInt(v) } : r))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">0–2 escursioni</SelectItem>
                        <SelectItem value="2">3–5 escursioni</SelectItem>
                        <SelectItem value="3">5+ escursioni</SelectItem>
                      </SelectContent>
                    </Select>
                    <EnforcementToggle rule={accessRules.find(r => r.type === "min_experience")!} onChange={(enforcement) => setAccessRules(prev => prev.map(r => r.type === "min_experience" ? { ...r, enforcement } : r))} />
                  </div>
                )}
              </RuleToggleRow>

              {/* Frequenza attività */}
              <RuleToggleRow
                label="Frequenza attività fisica minima"
                isActive={accessRules.some(r => r.type === "min_activity_frequency")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "min_activity_frequency", value: 1, enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "min_activity_frequency"));
                }}
              >
                {accessRules.find(r => r.type === "min_activity_frequency") && (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={String(accessRules.find(r => r.type === "min_activity_frequency")?.value || "1")}
                      onValueChange={(v) => setAccessRules(prev => prev.map(r => r.type === "min_activity_frequency" ? { ...r, value: parseInt(v) } : r))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Raramente</SelectItem>
                        <SelectItem value="2">1–2 volte a settimana</SelectItem>
                        <SelectItem value="3">Più di 2 volte a settimana</SelectItem>
                      </SelectContent>
                    </Select>
                    <EnforcementToggle rule={accessRules.find(r => r.type === "min_activity_frequency")!} onChange={(enforcement) => setAccessRules(prev => prev.map(r => r.type === "min_activity_frequency" ? { ...r, enforcement } : r))} />
                  </div>
                )}
              </RuleToggleRow>
            </div>

            {/* GROUP 2: 📊 Storico attività */}
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">📊 Storico attività</p>

              {/* Min trekking events */}
              <RuleToggleRow
                label="Min. eventi trekking completati"
                isActive={accessRules.some(r => r.type === "min_trekking_events")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "min_trekking_events", value: 1, enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "min_trekking_events"));
                }}
              >
                {accessRules.find(r => r.type === "min_trekking_events") && (
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number" min={1} className="h-8 text-xs flex-1"
                      value={accessRules.find(r => r.type === "min_trekking_events")?.value as number || ""}
                      onChange={(e) => setAccessRules(prev => prev.map(r => r.type === "min_trekking_events" ? { ...r, value: parseInt(e.target.value) || 0 } : r))}
                    />
                    <EnforcementToggle rule={accessRules.find(r => r.type === "min_trekking_events")!} onChange={(enforcement) => setAccessRules(prev => prev.map(r => r.type === "min_trekking_events" ? { ...r, enforcement } : r))} />
                  </div>
                )}
              </RuleToggleRow>

              {/* Min total events attended */}
              <RuleToggleRow
                label="Min. presenze totali"
                isActive={accessRules.some(r => r.type === "min_attended_events")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "min_attended_events", value: 1, enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "min_attended_events"));
                }}
              >
                {accessRules.find(r => r.type === "min_attended_events") && (
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number" min={1} className="h-8 text-xs flex-1"
                      value={accessRules.find(r => r.type === "min_attended_events")?.value as number || ""}
                      onChange={(e) => setAccessRules(prev => prev.map(r => r.type === "min_attended_events" ? { ...r, value: parseInt(e.target.value) || 0 } : r))}
                    />
                    <EnforcementToggle rule={accessRules.find(r => r.type === "min_attended_events")!} onChange={(enforcement) => setAccessRules(prev => prev.map(r => r.type === "min_attended_events" ? { ...r, enforcement } : r))} />
                  </div>
                )}
              </RuleToggleRow>
            </div>

            {/* GROUP 3: ⚙️ Accesso */}
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">⚙️ Accesso</p>

              {/* Membership */}
              <RuleToggleRow
                label="Membership attiva richiesta"
                isActive={accessRules.some(r => r.type === "require_membership")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "require_membership", enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "require_membership"));
                }}
              />

              {/* Badge (multi-select) */}
              <RuleToggleRow
                label="Badge specifico richiesto"
                isActive={accessRules.some(r => r.type === "require_badge")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "require_badge", enforcement: "hard", badge_ids: [] } as any]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "require_badge"));
                }}
              >
                {accessRules.find(r => r.type === "require_badge") && (
                  <MultiBadgeSelector
                    selectedIds={(accessRules.find(r => r.type === "require_badge") as any)?.badge_ids || (accessRules.find(r => r.type === "require_badge")?.badge_id ? [accessRules.find(r => r.type === "require_badge")!.badge_id!] : [])}
                    label="L'utente deve avere almeno uno di questi badge"
                    onChange={(ids) => setAccessRules(prev => prev.map(r => r.type === "require_badge" ? { ...r, badge_ids: ids, badge_id: ids[0] || "", value: ids[0] || "" } as any : r))}
                  />
                )}
              </RuleToggleRow>

              {/* Manual approval */}
              <RuleToggleRow
                label="Approvazione manuale richiesta"
                isActive={accessRules.some(r => r.type === "manual_approval")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "manual_approval", enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "manual_approval"));
                }}
              />
            </div>

            {accessRules.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div>
                  <Label className="text-xs">Etichetta esclusività (mostrata sulla card)</Label>
                  <Select value={exclusivityLabel || "auto"} onValueChange={(v) => setExclusivityLabel(v === "auto" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Auto (default)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (default)</SelectItem>
                      <SelectItem value="⭐ Evento esclusivo">⭐ Evento esclusivo</SelectItem>
                      <SelectItem value="👑 Solo membri">👑 Solo membri</SelectItem>
                      <SelectItem value="🔒 Esperienza richiesta">🔒 Esperienza richiesta</SelectItem>
                      <SelectItem value="⚡ Accesso limitato">⚡ Accesso limitato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Messaggio di restrizione globale (opzionale)</Label>
                  <Input
                    value={restrictionMessage}
                    onChange={(e) => setRestrictionMessage(e.target.value)}
                    placeholder="es. Questo evento è riservato ai membri esperti"
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground font-body mt-1">Mostrato quando un utente non soddisfa i requisiti. Se vuoto, vengono usati i messaggi delle singole regole.</p>
                </div>
              </div>
            )}

            {accessRules.length === 0 && (
              <p className="text-xs text-muted-foreground font-body text-center py-2">Nessuna restrizione di accesso. Tutti possono registrarsi.</p>
            )}
          </div>

          {/* Summary hint */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-[11px] text-muted-foreground font-body">
              <strong className="text-foreground">Riepilogo:</strong>{" "}
              {form.visibility === "public" ? "Visibile a tutti" : form.visibility === "private" ? "Solo link diretto" : "Nascosto"} •{" "}
              {accessRules.length === 0 ? "Registrazione aperta" : `${accessRules.length} regola/e di accesso`} •{" "}
              {priceOptions.length === 0 ? "Prezzo unico" : `${priceOptions.length} fascia/e di prezzo`}
            </p>
          </div>
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 6. PUNTI DI RITROVO */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">Punti di ritrovo</h2>
            <Button type="button" variant="outline" size="sm" onClick={addMeetingPoint} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Aggiungi
            </Button>
          </div>
          {meetingPoints.map((point, index) => (
            <div key={point.id || index} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body font-semibold text-muted-foreground">Punto {index + 1}</span>
                <button type="button" onClick={() => removeMeetingPoint(index)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input placeholder="Nome" value={point.name} onChange={(e) => updateMeetingPoint(index, "name", e.target.value)} />
              <LocationAutocomplete
                value={point.location}
                onChange={(val) => updateMeetingPoint(index, "location", val)}
                placeholder="Luogo/Indirizzo"
              />
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <Input type="time" value={point.time} onChange={(e) => updateMeetingPoint(index, "time", e.target.value)} />
                <Input placeholder="Note" value={point.notes} onChange={(e) => updateMeetingPoint(index, "notes", e.target.value)} />
              </div>
            </div>
          ))}
          {meetingPoints.length === 0 && (
            <p className="text-sm text-muted-foreground font-body text-center py-2">Nessun punto di ritrovo aggiunto</p>
          )}
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 7. LISTA ATTREZZATURA */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-primary" />
              Lista attrezzatura
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addEquipmentItem} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Aggiungi
            </Button>
          </div>

          {/* Template Selector */}
          {equipmentTemplates && equipmentTemplates.length > 0 && (
            <div>
              <Label>Carica da template</Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un template..." />
                </SelectTrigger>
                <SelectContent>
                  {equipmentTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({(t.equipment_template_items || []).length} elementi)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {equipmentItems.map((item, index) => (
            <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={item.is_mandatory}
                    onCheckedChange={(v) => updateEquipmentItem(index, "is_mandatory", !!v)}
                  />
                  <span className="text-xs font-body text-muted-foreground">
                    {item.is_mandatory ? "Obbligatorio" : "Opzionale"}
                  </span>
                </div>
                <button type="button" onClick={() => removeEquipmentItem(index)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input placeholder="Nome oggetto" value={item.name} onChange={(e) => updateEquipmentItem(index, "name", e.target.value)} />
              <Input placeholder="Note (opzionale)" value={item.notes} onChange={(e) => updateEquipmentItem(index, "notes", e.target.value)} />
            </div>
          ))}
          {equipmentItems.length === 0 && (
            <p className="text-sm text-muted-foreground font-body text-center py-2">
              Nessun elemento. Seleziona un template o aggiungi manualmente.
            </p>
          )}
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 8. DISPONIBILITÀ AUTO */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Car className="h-4 w-4" /> Disponibilità auto
              </h2>
              <p className="text-xs text-muted-foreground font-body">
                Chiedi ai partecipanti se possono guidare fino al luogo dell'evento.
              </p>
            </div>
            <Switch checked={askCarAvailability} onCheckedChange={setAskCarAvailability} />
          </div>
          {askCarAvailability && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs font-body text-muted-foreground">
                Durante la registrazione, i partecipanti vedranno: <strong>"Saresti disposto a prendere la macchina?"</strong>
              </p>
              <p className="text-[10px] font-body text-muted-foreground mt-1">Opzioni: Sì · Preferirei di no · Non sono automunito</p>
            </div>
          )}
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* 9. RICHIESTE SPECIALI (Registration Fields) */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">Richieste speciali</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setAdditionalFields(prev => [...prev, { label: "", type: "text", required: false, options: [] }])} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Aggiungi
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-body">Aggiungi domande personalizzate che i partecipanti devono compilare durante la registrazione.</p>
          {additionalFields.map((field, index) => (
            <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={field.required}
                    onCheckedChange={(v) => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, required: !!v } : f))}
                  />
                  <span className="text-xs font-body text-muted-foreground">
                    {field.required ? "Obbligatorio" : "Opzionale"}
                  </span>
                </div>
                <button type="button" onClick={() => setAdditionalFields(prev => prev.filter((_, i) => i !== index))} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input
                placeholder="Etichetta campo (es. Livello di esperienza)"
                value={field.label}
                onChange={(e) => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, label: e.target.value } : f))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={field.type} onValueChange={(v) => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, type: v as "text" | "select" } : f))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Testo libero</SelectItem>
                    <SelectItem value="select">Menu a tendina</SelectItem>
                  </SelectContent>
                </Select>
                {field.type === "select" && (
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs text-muted-foreground">Opzioni menu</Label>
                    {field.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <Input
                          placeholder={`Opzione ${optIdx + 1}`}
                          value={opt}
                          onChange={(e) => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, options: f.options.map((o, oi) => oi === optIdx ? e.target.value : o) } : f))}
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, options: f.options.filter((_, oi) => oi !== optIdx) } : f))}
                          className="text-destructive p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, options: [...f.options, ""] } : f))}
                      className="gap-1 w-full"
                    >
                      <Plus className="h-3.5 w-3.5" /> Aggiungi opzione
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {additionalFields.length === 0 && (
            <p className="text-sm text-muted-foreground font-body text-center py-2">Nessun campo personalizzato.</p>
          )}
        </Card>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? "Aggiorna evento" : "Crea evento"}
        </Button>
      </form>

      <AlertDialog open={validationPopupOpen} onOpenChange={setValidationPopupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Campi obbligatori mancanti
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Compila i seguenti campi per continuare:</p>
                <ul className="space-y-1.5">
                  {validationPopupFields.map((field) => (
                    <li key={field} className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Ho capito</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EventForm;
