import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useEvents";
import type { AccessRule, AccessRulesConfig } from "@/hooks/useEventAccessRules";
import { supabase } from "@/integrations/supabase/client";
import { parseCancellationPolicy, serializeCancellationPolicy, CANCELLATION_POLICIES, PolicyType } from "@/lib/cancellationPolicy";
import { MANUAL_BADGE_OPTIONS } from "@/lib/eventBadges";
import { FIT_SCORE_EVENT_SECONDARY_MAX, INTEREST_CATEGORY_OPTIONS } from "@/lib/fitScoreAffinityTables";

import LocationAutocomplete from "@/components/LocationAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextEditor from "@/components/RichTextEditor";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Clock, Mountain, Route,
  Trash2, Plus, Image as ImageIcon, Map as MapIcon, Info, HelpCircle, AlertCircle, Loader2, Save, X, GripVertical, ChevronUp, ChevronDown, PackageCheck, Upload, Shield, Car
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

interface MeetingPointInput {
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [validationPopupOpen, setValidationPopupOpen] = useState(false);
  const [validationPopupFields, setValidationPopupFields] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState(0);
  const [galleryUploadTotal, setGalleryUploadTotal] = useState(0);
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

  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [policyType, setPolicyType] = useState<PolicyType | "">("flexible");  
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
  const [weatherOverrideCondition, setWeatherOverrideCondition] = useState("");
  const [weatherOverrideTempMin, setWeatherOverrideTempMin] = useState("");
  const [weatherOverrideTempMax, setWeatherOverrideTempMax] = useState("");
  const [weatherOverrideTempAvg, setWeatherOverrideTempAvg] = useState("");
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [exclusivityLabel, setExclusivityLabel] = useState("");
  const [restrictionMessage, setRestrictionMessage] = useState("");
  const [manualBadges, setManualBadges] = useState<string[]>([]);
  const [customBadge, setCustomBadge] = useState("");

  interface PriceOptionInput {
    name: string;
    price: number;
    eligible_group: string;
    badge_ids: string[];
    original_price: number | null;
    is_promotional: boolean;
    promo_start: string;
    promo_end: string;
  }
  const [priceOptions, setPriceOptions] = useState<PriceOptionInput[]>([]);

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
      setRegistrationOpen(event.status !== "closed");
      const { policyType: pt, customText: ct } = parseCancellationPolicy(event.cancellation_policy);
      setPolicyType(pt || "flexible");
      setPolicyCustomText(ct);
      if (event.image_url) {
        setImagePreview(event.image_url);
      }

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
          name: p.name,
          location: p.location,
          time: p.time,
          notes: p.notes || "",
        })));
      }

      if (event.additional_fields) {
        const af = event.additional_fields as any;
        setFitScoreMainCategory(af.fit_score_main_category || "");
        setFitScoreSecondaryCategories(
          Array.isArray(af.fit_score_secondary_categories)
            ? af.fit_score_secondary_categories.slice(0, FIT_SCORE_EVENT_SECONDARY_MAX)
            : []
        );
        if (af.ask_car_availability !== undefined) {
          setAskCarAvailability(!!af.ask_car_availability);
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
        } else if (Array.isArray(af)) {
          setAdditionalFields(
            af.map((f: any) => ({
              label: f.label || "",
              type: f.type || "text",
              required: f.required || false,
              options: Array.isArray(f.options) ? f.options : (typeof f.options === 'string' && f.options ? f.options.split(',').map((o: string) => o.trim()) : []),
            }))
          );
        }
      }

      if ((event as any).access_rules) {
        const ar = (event as any).access_rules as AccessRulesConfig;
        setAccessRules(ar.rules || []);
        setExclusivityLabel(ar.exclusivity_label || "");
        setRestrictionMessage(ar.restriction_message || "");
      }
      if ((event as any).event_badges && Array.isArray((event as any).event_badges)) {
        const badges = (event as any).event_badges as string[];
        const knownManual = ["evento_top", "best_seller", "consigliato", "prezzo_speciale", "early_bird"];
        setManualBadges(badges.filter(b => knownManual.includes(b)));
        const custom = badges.find(b => !knownManual.includes(b));
        if (custom) setCustomBadge(custom);
      }

      const { data: options } = await supabase
        .from("event_price_options")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order");
      if (options && options.length > 0) {
        setPriceOptions(options.map((o: any) => {
          const group = o.eligible_group || 'all';
          const badgeIds = group.startsWith("badge:") ? group.replace("badge:", "").split(",") : [];
          return {
            name: o.name,
            price: Number(o.price),
            eligible_group: group,
            badge_ids: badgeIds,
            original_price: o.original_price ? Number(o.original_price) : null,
            is_promotional: o.is_promotional || false,
            promo_start: o.promo_start ? o.promo_start.split('T')[0] : '',
            promo_end: o.promo_end ? o.promo_end.split('T')[0] : '',
          };
        }));
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
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "L'immagine deve essere inferiore a 5MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    updateForm("image_url", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return form.image_url || null;
    setUploadingImage(true);
    const ext = imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-images").upload(path, imageFile);
    setUploadingImage(false);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(path);
    return urlData.publicUrl;
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
      if (file.size <= 5 * 1024 * 1024) return true;

      toast({
        title: "Immagine troppo grande",
        description: `${file.name} supera il limite di 5MB.`,
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
      const { error } = await supabase.storage.from("event-images").upload(fileName, file);

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

  const handleGalleryPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.clipboardData?.items || []);
    const pastedImages = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (pastedImages.length === 0) return;

    event.preventDefault();
    await uploadGalleryFiles(
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

      // Format duration with unit
      let durationFormatted = form.duration ? `${form.duration}${form.duration_unit === "giorni" ? " giorni" : "h"}` : null;
      // Format distance with km
      let distanceFormatted = form.distance ? `${form.distance} km` : null;
      // Format elevation with m
      let elevationFormatted = form.elevation ? `${form.elevation} m` : null;

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
        price: form.price,
        deposit: form.payment_type === "deposit" ? form.deposit : null,
        payment_type: form.payment_type,
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
          fit_score_main_category: fitScoreMainCategory,
          fit_score_secondary_categories: fitScoreSecondaryCategories,
          fields: additionalFields.filter((f) => f.label.trim()),
          ask_car_availability: askCarAvailability,
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
        organizer_id: user.id,
        organizer_name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Organizer",
        status: (registrationOpen ? "published" : "closed") as Database["public"]["Enums"]["event_status"],
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

      // Handle meeting points
      if (isEditing) {
        const { data: existingPoints } = await supabase
          .from("event_meeting_points")
          .select("id")
          .eq("event_id", eventId!);
        
        if (existingPoints && existingPoints.length > 0) {
          const existingIds = existingPoints.map(p => p.id);
          await supabase
            .from("event_registrations")
            .update({ meeting_point_id: null })
            .in("meeting_point_id", existingIds);
          
          const { error: deleteError } = await supabase
            .from("event_meeting_points")
            .delete()
            .eq("event_id", eventId!);
          if (deleteError) throw deleteError;
        }
      }

      if (meetingPoints.length > 0) {
        const pointsData = meetingPoints.map((p, i) => ({
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

      // Handle price options
      if (isEditing) {
        await supabase.from("event_price_options").delete().eq("event_id", eventId!);
      }
      const validPriceOptions = priceOptions.filter(o => o.name.trim());
      if (validPriceOptions.length > 0) {
        const optionsData = validPriceOptions.map((o, i) => ({
          event_id: eventId!,
          name: o.name,
          price: o.price,
          sort_order: i,
          eligible_group: o.eligible_group || 'all',
          original_price: o.original_price || null,
          is_promotional: o.is_promotional || false,
          promo_start: o.promo_start || null,
          promo_end: o.promo_end || null,
        }));
        const { error: poError } = await supabase.from("event_price_options").insert(optionsData);
        if (poError) throw poError;
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Data *</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => { updateForm("date", e.target.value); setValidationErrors(prev => ({ ...prev, date: false })); }} className={validationErrors.date ? "border-destructive ring-destructive/20 ring-2" : ""} />
                {validationErrors.date && <p className="text-xs text-destructive mt-1">Obbligatorio</p>}
              </div>
              <div>
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
          </div>
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
                <div className="relative mt-2 rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background"
                  >
                    <X className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clicca per caricare un'immagine</span>
                  <span className="text-xs text-muted-foreground">Max 5MB</span>
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
                        await uploadGalleryFiles(files);
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
                        <p className="text-[10px] text-muted-foreground font-body">PNG, JPG fino a 5MB</p>
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
        {/* 3. CAPACITÀ E PREZZI (with pricing tiers at end) */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Capacità e prezzi</h2>
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
            <div>
              <Label>Tipo pagamento</Label>
              <Select value={form.payment_type} onValueChange={(v) => updateForm("payment_type", v as PaymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Evento gratuito</SelectItem>
                  <SelectItem value="paid">Pagamento completo online (Stripe)</SelectItem>
                  <SelectItem value="location">Pagamento sul posto</SelectItem>
                  <SelectItem value="deposit">Pagamento frazionato (Acconto + Saldo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.payment_type !== "free") && (
              <div>
                <Label htmlFor="price">Prezzo totale (€)</Label>
                <Input id="price" type="number" min={0} step={0.01} value={form.price || ""} onChange={(e) => updateForm("price", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)} disabled={priceOptions.filter(o => o.name.trim()).length > 0} className={priceOptions.filter(o => o.name.trim()).length > 0 ? "opacity-50" : ""} />
                {priceOptions.filter(o => o.name.trim()).length > 0 && (
                  <p className="text-[11px] text-muted-foreground font-body mt-1">Il prezzo è gestito dalle fasce di prezzo sottostanti.</p>
                )}
              </div>
            )}
            {form.payment_type === "deposit" && (
              <>
                <div>
                  <Label htmlFor="deposit">Acconto (€)</Label>
                  <Input id="deposit" type="number" min={0} step={0.01} max={form.price} value={form.deposit || ""} onChange={(e) => updateForm("deposit", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)} />
                </div>
                {form.price > 0 && form.deposit > 0 && (
                  <div className="p-3 rounded-xl bg-gold/10 border border-gold/20">
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Prezzo totale</span>
                      <span className="font-semibold text-foreground">€{form.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-body mt-1">
                      <span className="text-muted-foreground">Acconto (online)</span>
                      <span className="font-semibold text-foreground">€{form.deposit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-body mt-1 pt-1 border-t border-gold/20">
                      <span className="text-muted-foreground">Saldo rimanente</span>
                      <span className="font-semibold text-foreground">€{(form.price - form.deposit).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Cancellation Policy */}
            <div>
              <Label>Politica di cancellazione</Label>
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

            {/* ── Fasce di prezzo (Pricing Tiers) ── */}
            {form.payment_type !== "free" && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      💰 Fasce di prezzo
                    </Label>
                    <p className="text-[11px] text-muted-foreground font-body">Definisci chi vede quale prezzo. Configura prezzi per community, badge o promozioni.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPriceOptions(prev => [...prev, { name: "", price: 0, eligible_group: "all", badge_ids: [], original_price: null, is_promotional: false, promo_start: "", promo_end: "" }])} className="gap-1 shrink-0">
                    <Plus className="h-3.5 w-3.5" /> Aggiungi
                  </Button>
                </div>
                {priceOptions.map((opt, index) => (
                  <div key={index} className="p-3 bg-background rounded-lg space-y-2 border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Nome fascia (es. Prezzo community, Early bird)"
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
                          value={opt.price || ""}
                          onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, price: parseFloat(e.target.value) || 0 } : o))}
                        />
                      </div>
                      <button type="button" onClick={() => setPriceOptions(prev => prev.filter((_, i) => i !== index))} className="text-destructive p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
                {priceOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground font-body text-center py-1">Nessuna fascia di prezzo. Il prezzo base (€{form.price}) si applica a tutti.</p>
                )}
              </div>
            )}
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

          {/* Iscrizioni */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  📝 Iscrizioni
                </Label>
                <p className="text-[11px] text-muted-foreground font-body">
                  {registrationOpen
                    ? "Le iscrizioni sono aperte. Gli utenti possono registrarsi."
                    : "Le iscrizioni sono chiuse. L'evento è visibile ma nessuno può registrarsi."}
                </p>
              </div>
              <Switch checked={registrationOpen} onCheckedChange={setRegistrationOpen} />
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
            <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
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
              <div className="grid grid-cols-2 gap-2">
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
