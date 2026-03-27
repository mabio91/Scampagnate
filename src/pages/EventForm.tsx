import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useEvents";
import type { AccessRule, AccessRulesConfig } from "@/hooks/useEventAccessRules";
import { supabase } from "@/integrations/supabase/client";
import { parseCancellationPolicy, serializeCancellationPolicy, CANCELLATION_POLICIES, PolicyType } from "@/lib/cancellationPolicy";
import AppLayout from "@/components/layout/AppLayout";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  options: string[]; // array of options for select type
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

const BadgeSelector = ({ value, onChange }: { value: string; onChange: (badgeId: string, badgeName: string) => void }) => {
  const { data: badges } = useBadges();
  return (
    <Select value={value} onValueChange={(v) => {
      const badge = badges?.find(b => b.id === v);
      onChange(v, badge?.name || "");
    }}>
      <SelectTrigger><SelectValue placeholder="Select a badge..." /></SelectTrigger>
      <SelectContent>
        {badges?.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.icon} {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    featured: false,
    cancellation_policy: "",
    image_url: "",
    visibility: "public" as "public" | "private" | "hidden",
    gallery_images: [] as { url: string; order: number }[],
  });

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
    toast({ title: `Template "${template.name}" loaded with ${items.length} items` });
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
  const [weatherOverrideTemp, setWeatherOverrideTemp] = useState("");
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [exclusivityLabel, setExclusivityLabel] = useState("");
  const [restrictionMessage, setRestrictionMessage] = useState("");

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
    }
  }, [id, duplicateId]);

  const loadEvent = async (eventId: string) => {
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (event) {
      setForm({
        title: isDuplicating ? `Copy of ${event.title}` : event.title,
        description: event.description,
        date: isDuplicating ? "" : event.date,
        time: isDuplicating ? "" : event.time,
        location: event.location,
        category_id: event.category_id || "",
        spots_total: event.spots_total,
        reserved_spots: isDuplicating ? 0 : ((event as any).reserved_spots || 0),
        price: event.price,
        deposit: event.deposit || 0,
        payment_type: event.payment_type,
        difficulty: event.difficulty || "",
        distance: event.distance || "",
        elevation: event.elevation || "",
        duration: event.duration || "",
        featured: isDuplicating ? false : event.featured,
        cancellation_policy: event.cancellation_policy || "",
        image_url: event.image_url || "",
        visibility: isDuplicating ? "private" : (event.visibility || "public"),
        gallery_images: (event.gallery_images as any[]) || [],
      });
      setRegistrationOpen(event.status !== "closed");
      // Parse existing cancellation policy
      const { policyType: pt, customText: ct } = parseCancellationPolicy(event.cancellation_policy);
      setPolicyType(pt || "flexible");
      setPolicyCustomText(ct);
      if (event.image_url) {
        setImagePreview(event.image_url);
      }

      // Load equipment list
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

      // Load additional fields
      if (event.additional_fields) {
        const af = event.additional_fields as any;
        if (af.ask_car_availability !== undefined) {
          // New format: { fields: [...], ask_car_availability: bool }
          setAskCarAvailability(!!af.ask_car_availability);
          if (af.weather_override_condition) setWeatherOverrideCondition(af.weather_override_condition);
          if (af.weather_override_temp != null && af.weather_override_temp !== "") setWeatherOverrideTemp(String(af.weather_override_temp));
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
          // Legacy format: plain array
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

      // Load access rules
      if ((event as any).access_rules) {
        const ar = (event as any).access_rules as AccessRulesConfig;
        setAccessRules(ar.rules || []);
        setExclusivityLabel(ar.exclusivity_label || "");
        setRestrictionMessage(ar.restriction_message || "");
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
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" });
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

  const updateForm = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      const eventData = {
        title: form.title,
        description: form.description,
        date: form.date,
        time: form.time,
        location: form.location,
        category_id: form.category_id || null,
        spots_total: form.spots_total,
        reserved_spots: form.reserved_spots,
        price: form.price,
        deposit: form.payment_type === "deposit" ? form.deposit : null,
        payment_type: form.payment_type,
        difficulty: form.difficulty || null,
        distance: form.distance || null,
        elevation: form.elevation || null,
        duration: form.duration || null,
        featured: form.featured,
        cancellation_policy: policyType
          ? serializeCancellationPolicy(policyType as PolicyType, policyCustomText)
          : null,
        image_url: imageUrl,
        visibility: form.visibility,
        gallery_images: form.gallery_images as any,
        equipment_list: equipmentItems.filter((item) => item.name.trim()) as any,
        additional_fields: {
          fields: additionalFields.filter((f) => f.label.trim()),
          ask_car_availability: askCarAvailability,
          weather_override_condition: weatherOverrideCondition || undefined,
          weather_override_temp: weatherOverrideTemp ? parseFloat(weatherOverrideTemp) : undefined,
        } as any,
        access_rules: accessRules.length > 0 ? {
          rules: accessRules,
          exclusivity_label: exclusivityLabel || undefined,
          restriction_message: restrictionMessage || undefined,
        } as any : null,
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
      }

      // Handle meeting points - delete old ones first, then insert new
      if (isEditing) {
        // First, get existing meeting point IDs for this event
        const { data: existingPoints } = await supabase
          .from("event_meeting_points")
          .select("id")
          .eq("event_id", eventId!);
        
        if (existingPoints && existingPoints.length > 0) {
          const existingIds = existingPoints.map(p => p.id);
          
          // Nullify any registration references to these meeting points
          await supabase
            .from("event_registrations")
            .update({ meeting_point_id: null })
            .in("meeting_point_id", existingIds);
          
          // Now delete old meeting points
          const { error: deleteError } = await supabase
            .from("event_meeting_points")
            .delete()
            .eq("event_id", eventId!);
          if (deleteError) {
            console.error("Failed to delete old meeting points:", deleteError);
            throw deleteError;
          }
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

      toast({ title: isEditing ? "Event updated!" : "Event created!" });
      navigate(`/organizer/events/${eventId}`);
    } catch (err: any) {
      toast({ title: "Error saving event", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loadingEvent) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-display text-xl font-bold text-foreground">
            {isEditing ? "Edit Event" : isDuplicating ? "Duplicate Event" : "Create Event"}
          </h1>
        </div>

        {/* Basic Info */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Basic Info</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => { updateForm("title", e.target.value); setValidationErrors(prev => ({ ...prev, title: false })); }} placeholder="Event title" className={validationErrors.title ? "border-destructive ring-destructive/20 ring-2" : ""} />
              {validationErrors.title && <p className="text-xs text-destructive mt-1">Title is required</p>}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Describe the event..." rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => { updateForm("date", e.target.value); setValidationErrors(prev => ({ ...prev, date: false })); }} className={validationErrors.date ? "border-destructive ring-destructive/20 ring-2" : ""} />
                {validationErrors.date && <p className="text-xs text-destructive mt-1">Required</p>}
              </div>
              <div>
                <Label htmlFor="time">Time *</Label>
                <Input id="time" type="time" value={form.time} onChange={(e) => { updateForm("time", e.target.value); setValidationErrors(prev => ({ ...prev, time: false })); }} className={validationErrors.time ? "border-destructive ring-destructive/20 ring-2" : ""} />
                {validationErrors.time && <p className="text-xs text-destructive mt-1">Required</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="location">Location *</Label>
              <LocationAutocomplete
                id="location"
                value={form.location}
                onChange={(val) => { updateForm("location", val); setValidationErrors(prev => ({ ...prev, location: false })); }}
                placeholder="Search location..."
                error={validationErrors.location}
              />
              {validationErrors.location && <p className="text-xs text-destructive mt-1">Location is required</p>}
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={form.category_id} onValueChange={(v) => updateForm("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Visibility moved to Access & Pricing Rules section */}

            {/* Gallery Images */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Event Gallery (Max 5)</Label>
                <span className="text-[10px] text-muted-foreground font-body">{form.gallery_images.length}/5 images</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {form.gallery_images.sort((a,b) => a.order - b.order).map((img, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 group">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                      <img src={img.url} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-body text-muted-foreground truncate">Image {index + 1}</p>
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
                          if (current && prev) {
                            current.order -= 1;
                            prev.order += 1;
                            updateForm("gallery_images", [...newGallery]);
                          }
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
                          if (current && next) {
                            current.order += 1;
                            next.order -= 1;
                            updateForm("gallery_images", [...newGallery]);
                          }
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
                          const newGallery = form.gallery_images
                            .filter((_, i) => i !== index)
                            .map((g, i) => ({ ...g, order: i }));
                          updateForm("gallery_images", newGallery);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {form.gallery_images.length < 5 && (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        const remaining = 5 - form.gallery_images.length;
                        const filesToUpload = files.slice(0, remaining);
                        
                        if (filesToUpload.length === 0) return;

                        setGalleryUploading(true);
                        setGalleryUploadProgress(0);
                        setGalleryUploadTotal(filesToUpload.length);

                        let completed = 0;
                        const uploadPromises = filesToUpload.map(async (file) => {
                          const fileExt = file.name.split('.').pop();
                          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                          const filePath = `${fileName}`;

                          const { data, error } = await supabase.storage
                            .from('event-images')
                            .upload(filePath, file);

                          completed++;
                          setGalleryUploadProgress(completed);

                          if (error) {
                            toast({ title: "Upload Error", description: error.message, variant: "destructive" });
                            return null;
                          }

                          const { data: { publicUrl } } = supabase.storage
                            .from('event-images')
                            .getPublicUrl(filePath);

                          return publicUrl;
                        });

                        const results = await Promise.all(uploadPromises);
                        const successfulUrls = results.filter((url): url is string => url !== null);

                        if (successfulUrls.length > 0) {
                          const newImages = successfulUrls.map((url, i) => ({
                            url,
                            order: form.gallery_images.length + i,
                          }));
                          updateForm("gallery_images", [...form.gallery_images, ...newImages]);
                          toast({ title: `${successfulUrls.length} immagini caricate`, description: "Gallery aggiornata con successo" });
                        }

                        setGalleryUploading(false);
                        e.target.value = '';
                      }}
                    />
                    {galleryUploading ? (
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/50 rounded-xl bg-primary/5">
                        <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
                        <p className="text-xs font-body font-semibold text-foreground">
                          Caricamento {galleryUploadProgress}/{galleryUploadTotal}...
                        </p>
                        <div className="w-full mt-2 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${galleryUploadTotal > 0 ? (galleryUploadProgress / galleryUploadTotal) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                        <Plus className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-xs font-body font-semibold text-foreground">Add Gallery Images</p>
                        <p className="text-[10px] text-muted-foreground font-body">PNG, JPG up to 5MB</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Event Image</Label>
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
                  <span className="text-sm text-muted-foreground">Click to upload image</span>
                  <span className="text-xs text-muted-foreground">Max 5MB</span>
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Capacity & Pricing */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Capacity & Pricing</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="spots">Total Spots</Label>
              <Input id="spots" type="number" min={1} value={form.spots_total || ""} onChange={(e) => updateForm("spots_total", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} onBlur={() => { if (!form.spots_total) updateForm("spots_total", 1); }} />
            </div>
            <div>
              <Label htmlFor="reserved">Reserved Spots</Label>
              <Input id="reserved" type="number" min={0} max={form.spots_total} value={form.reserved_spots || ""} onChange={(e) => updateForm("reserved_spots", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} />
              <p className="text-[11px] text-muted-foreground font-body mt-1">Spots reserved for manual/offline registrations. Count toward total capacity.</p>
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={form.payment_type} onValueChange={(v) => updateForm("payment_type", v as PaymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free Event</SelectItem>
                  <SelectItem value="paid">Full Payment Online (Stripe)</SelectItem>
                  <SelectItem value="location">Payment on Location</SelectItem>
                  <SelectItem value="deposit">Split Payment (Deposit + Balance)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.payment_type !== "free") && (
              <div>
                <Label htmlFor="price">Total Price (€)</Label>
                <Input id="price" type="number" min={0} step={0.01} value={form.price || ""} onChange={(e) => updateForm("price", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)} />
              </div>
            )}
            {form.payment_type === "deposit" && (
              <>
                <div>
                  <Label htmlFor="deposit">Deposit Amount (€)</Label>
                  <Input id="deposit" type="number" min={0} step={0.01} max={form.price} value={form.deposit || ""} onChange={(e) => updateForm("deposit", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)} />
                </div>
                {form.price > 0 && form.deposit > 0 && (
                  <div className="p-3 rounded-xl bg-gold/10 border border-gold/20">
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Total price</span>
                      <span className="font-semibold text-foreground">€{form.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-body mt-1">
                      <span className="text-muted-foreground">Deposit (online)</span>
                      <span className="font-semibold text-foreground">€{form.deposit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-body mt-1 pt-1 border-t border-gold/20">
                      <span className="text-muted-foreground">Remaining balance</span>
                      <span className="font-semibold text-foreground">€{(form.price - form.deposit).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Price Options moved to Access & Pricing Rules section */}

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
          </div>
        </Card>

        {/* Event Details */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Event Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => updateForm("difficulty", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">🟢 Livello 1 - Introduzione</SelectItem>
                  <SelectItem value="2">🟢 Livello 2 - Facile</SelectItem>
                  <SelectItem value="3">🟡 Livello 3 - Intermedio</SelectItem>
                  <SelectItem value="4">🟠 Livello 4 - Impegnativo</SelectItem>
                  <SelectItem value="5">🔴 Livello 5 - Avanzato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="duration">Duration</Label>
              <Input id="duration" value={form.duration} onChange={(e) => updateForm("duration", e.target.value)} placeholder="e.g., 4h" />
            </div>
            <div>
              <Label htmlFor="distance">Distance</Label>
              <Input id="distance" value={form.distance} onChange={(e) => updateForm("distance", e.target.value)} placeholder="e.g., 12km" />
            </div>
            <div>
              <Label htmlFor="elevation">Elevation</Label>
              <Input id="elevation" value={form.elevation} onChange={(e) => updateForm("elevation", e.target.value)} placeholder="e.g., 500m" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="featured" checked={form.featured} onCheckedChange={(v) => updateForm("featured", v)} />
            <Label htmlFor="featured">Featured event</Label>
          </div>

          {/* Weather Override (Admin/Organizer) */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              🌤️ Override Meteo (opzionale)
            </Label>
            <p className="text-[11px] text-muted-foreground font-body">
              Lascia vuoto per usare la previsione automatica. Compila per sovrascrivere.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Condizione</Label>
                <Input
                  value={weatherOverrideCondition}
                  onChange={(e) => setWeatherOverrideCondition(e.target.value)}
                  placeholder="es. Sereno, Nuvoloso"
                />
              </div>
              <div>
                <Label className="text-xs">Temperatura (°C)</Label>
                <Input
                  type="number"
                  value={weatherOverrideTemp}
                  onChange={(e) => setWeatherOverrideTemp(e.target.value)}
                  placeholder="es. 22"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Access & Pricing Rules — Unified Section */}
        <Card className="p-4 space-y-5">
          <div>
            <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Access & Pricing Rules
            </h2>
            <p className="text-xs text-muted-foreground font-body mt-1">
              Configure who can see, access, and register for this event — and at which price.
            </p>
          </div>

          {/* 1. Visibility */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              👁️ Visibility
            </Label>
            <p className="text-[11px] text-muted-foreground font-body">Who can see this event in listings and search.</p>
            <Select value={form.visibility} onValueChange={(v) => updateForm("visibility", v)}>
              <SelectTrigger><SelectValue placeholder="Select visibility" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">🌍 Public — Visible to all users</SelectItem>
                <SelectItem value="private">🔗 Private — Direct link only</SelectItem>
                <SelectItem value="hidden">👁️ Hidden — Organizers & Admins only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground font-body">
              {form.visibility === "public" && "Everyone can find and view this event."}
              {form.visibility === "private" && "Not listed in discovery. Only accessible via direct link or invitation."}
              {form.visibility === "hidden" && "Invisible to regular users. Only organizers and platform administrators can see it."}
            </p>
          </div>

          {/* Registration Status */}
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

          {/* 2. Access Restrictions - Grouped */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                🔒 Requisiti di Registrazione
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

              {/* Interessi consigliati (always soft) */}
              <RuleToggleRow
                label="Interessi consigliati"
                isActive={accessRules.some(r => r.type === "interests")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "interests", interests: [], enforcement: "soft" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "interests"));
                }}
              >
                {accessRules.find(r => r.type === "interests") && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">💡 Sempre soft — non blocca la registrazione</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Trekking", "Cultura", "Fotografia", "Natura", "Sport", "Gastronomia", "Avventura", "Relax"].map(interest => {
                        const currentInterests = accessRules.find(r => r.type === "interests")?.interests || [];
                        const isSelected = currentInterests.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            onClick={() => {
                              setAccessRules(prev => prev.map(r => {
                                if (r.type !== "interests") return r;
                                const curr = r.interests || [];
                                const next = isSelected ? curr.filter(i => i !== interest) : curr.length < 3 ? [...curr, interest] : curr;
                                return { ...r, interests: next };
                              }));
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-body border transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Max 3 interessi</p>
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

              {/* Badge */}
              <RuleToggleRow
                label="Badge specifico richiesto"
                isActive={accessRules.some(r => r.type === "require_badge")}
                onToggle={(active) => {
                  if (active) setAccessRules(prev => [...prev, { type: "require_badge", enforcement: "hard" }]);
                  else setAccessRules(prev => prev.filter(r => r.type !== "require_badge"));
                }}
              >
                {accessRules.find(r => r.type === "require_badge") && (
                  <BadgeSelector
                    value={accessRules.find(r => r.type === "require_badge")?.badge_id || ""}
                    onChange={(badgeId, badgeName) => setAccessRules(prev => prev.map(r => r.type === "require_badge" ? { ...r, badge_id: badgeId, badge_name: badgeName, value: badgeId } : r))}
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
                  <Select value={exclusivityLabel} onValueChange={setExclusivityLabel}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Rileva automaticamente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">Auto-detect</SelectItem>
                      <SelectItem value="Exclusive Event">⭐ Evento esclusivo</SelectItem>
                      <SelectItem value="Members Only">👑 Solo membri</SelectItem>
                      <SelectItem value="Community Priority">🤝 Priorità community</SelectItem>
                      <SelectItem value="Experience Required">🔒 Esperienza richiesta</SelectItem>
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
              <p className="text-xs text-muted-foreground font-body text-center py-2">No access restrictions. Anyone can register.</p>
            )}
          </div>

          {/* 3. Pricing Variations */}
          {form.payment_type !== "free" && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    💰 Pricing Tiers
                  </Label>
                  <p className="text-[11px] text-muted-foreground font-body">Define who sees which price. Configure tiered, community, or promotional pricing.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setPriceOptions(prev => [...prev, { name: "", price: 0, eligible_group: "all", badge_ids: [], original_price: null, is_promotional: false, promo_start: "", promo_end: "" }])} className="gap-1 shrink-0">
                  <Plus className="h-3.5 w-3.5" /> Add Tier
                </Button>
              </div>
              {priceOptions.map((opt, index) => (
                <div key={index} className="p-3 bg-background rounded-lg space-y-2 border border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Tier name (e.g. Community price, Early bird)"
                        value={opt.name}
                        onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, name: e.target.value } : o))}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="€ Price"
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
                      <Label className="text-[11px] text-muted-foreground">Who sees this price</Label>
                      <Select value={opt.eligible_group.startsWith("badge:") ? "badges" : opt.eligible_group} onValueChange={(v) => {
                        if (v === "badges") {
                          setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: "badges", badge_ids: o.badge_ids || [] } : o));
                        } else {
                          setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, eligible_group: v, badge_ids: [] } : o));
                        }
                      }}>
                        <SelectTrigger className="h-8 text-xs mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Everyone</SelectItem>
                          <SelectItem value="members">Active Members</SelectItem>
                          <SelectItem value="new_users">New Users (0 events)</SelectItem>
                          <SelectItem value="experienced">Experienced Users (1+ events)</SelectItem>
                          <SelectItem value="loyal">Loyal Participants (5+ events)</SelectItem>
                          <SelectItem value="badges">Specific Badge(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Original Price (strikethrough)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="€ (optional)"
                        className="h-8 text-xs mt-0.5"
                        value={opt.original_price ?? ""}
                        onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, original_price: e.target.value ? parseFloat(e.target.value) : null } : o))}
                      />
                    </div>
                  </div>
                  {/* Badge selector when "badges" group is chosen */}
                  {(opt.eligible_group === "badges" || opt.eligible_group.startsWith("badge:")) && (
                    <PricingBadgeSelector
                      selectedIds={opt.badge_ids || []}
                      onChange={(ids) => {
                        const group = ids.length > 0 ? `badge:${ids.join(",")}` : "badges";
                        setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, badge_ids: ids, eligible_group: group } : o));
                      }}
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={opt.is_promotional}
                      onCheckedChange={(v) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, is_promotional: v } : o))}
                    />
                    <Label className="text-xs">Time-limited promo</Label>
                  </div>
                  {opt.is_promotional && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Promo Start</Label>
                        <Input
                          type="date"
                          className="h-8 text-xs mt-0.5"
                          value={opt.promo_start}
                          onChange={(e) => setPriceOptions(prev => prev.map((o, i) => i === index ? { ...o, promo_start: e.target.value } : o))}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Promo End</Label>
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
                <p className="text-xs text-muted-foreground font-body text-center py-1">No pricing tiers. The base price (€{form.price}) applies to everyone.</p>
              )}
            </div>
          )}

          {/* Summary hint */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-[11px] text-muted-foreground font-body">
              <strong className="text-foreground">Summary:</strong>{" "}
              {form.visibility === "public" ? "Visible to all" : form.visibility === "private" ? "Direct link only" : "Hidden"} •{" "}
              {accessRules.length === 0 ? "Open registration" : `${accessRules.length} access rule(s)`} •{" "}
              {priceOptions.length === 0 ? "Single price" : `${priceOptions.length} pricing tier(s)`}
            </p>
          </div>
        </Card>


        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">Meeting Points</h2>
            <Button type="button" variant="outline" size="sm" onClick={addMeetingPoint} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {meetingPoints.map((point, index) => (
            <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body font-semibold text-muted-foreground">Point {index + 1}</span>
                <button type="button" onClick={() => removeMeetingPoint(index)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input placeholder="Name" value={point.name} onChange={(e) => updateMeetingPoint(index, "name", e.target.value)} />
              <LocationAutocomplete
                value={point.location}
                onChange={(val) => updateMeetingPoint(index, "location", val)}
                placeholder="Location/Address"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" value={point.time} onChange={(e) => updateMeetingPoint(index, "time", e.target.value)} />
                <Input placeholder="Notes" value={point.notes} onChange={(e) => updateMeetingPoint(index, "notes", e.target.value)} />
              </div>
            </div>
          ))}
          {meetingPoints.length === 0 && (
            <p className="text-sm text-muted-foreground font-body text-center py-2">No meeting points added</p>
          )}
        </Card>

        {/* Equipment List */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-primary" />
              Equipment List
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addEquipmentItem} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          </div>

          {/* Template Selector */}
          {equipmentTemplates && equipmentTemplates.length > 0 && (
            <div>
              <Label>Load from Template</Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template to pre-fill..." />
                </SelectTrigger>
                <SelectContent>
                  {equipmentTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({(t.equipment_template_items || []).length} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Equipment Items */}
          {equipmentItems.map((item, index) => (
            <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={item.is_mandatory}
                    onCheckedChange={(v) => updateEquipmentItem(index, "is_mandatory", !!v)}
                  />
                  <span className="text-xs font-body text-muted-foreground">
                    {item.is_mandatory ? "Mandatory" : "Optional"}
                  </span>
                </div>
                <button type="button" onClick={() => removeEquipmentItem(index)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input
                placeholder="Item name"
                value={item.name}
                onChange={(e) => updateEquipmentItem(index, "name", e.target.value)}
              />
              <Input
                placeholder="Notes (optional)"
                value={item.notes}
                onChange={(e) => updateEquipmentItem(index, "notes", e.target.value)}
              />
            </div>
          ))}
          {equipmentItems.length === 0 && (
            <p className="text-sm text-muted-foreground font-body text-center py-2">
              No equipment items. Select a template or add items manually.
            </p>
          )}
        </Card>

        {/* Car Availability Toggle */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Car className="h-4 w-4" /> Car Availability
              </h2>
              <p className="text-xs text-muted-foreground font-body">
                Ask participants if they can drive to the event location.
              </p>
            </div>
            <Switch checked={askCarAvailability} onCheckedChange={setAskCarAvailability} />
          </div>
          {askCarAvailability && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs font-body text-muted-foreground">
                During registration, participants will see: <strong>"Saresti disposto a prendere la macchina?"</strong>
              </p>
              <p className="text-[10px] font-body text-muted-foreground mt-1">Options: Sì · Preferirei di no · Non sono automunito</p>
            </div>
          )}
        </Card>

        {/* Additional Registration Fields */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">Registration Fields</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setAdditionalFields(prev => [...prev, { label: "", type: "text", required: false, options: [] }])} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Field
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-body">Add custom questions participants must answer during registration (e.g. experience level, equipment availability).</p>
          {additionalFields.map((field, index) => (
            <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={field.required}
                    onCheckedChange={(v) => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, required: !!v } : f))}
                  />
                  <span className="text-xs font-body text-muted-foreground">
                    {field.required ? "Required" : "Optional"}
                  </span>
                </div>
                <button type="button" onClick={() => setAdditionalFields(prev => prev.filter((_, i) => i !== index))} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input
                placeholder="Field label (e.g. Experience level)"
                value={field.label}
                onChange={(e) => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, label: e.target.value } : f))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={field.type} onValueChange={(v) => setAdditionalFields(prev => prev.map((f, i) => i === index ? { ...f, type: v as "text" | "select" } : f))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Free Text</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                  </SelectContent>
                </Select>
                {field.type === "select" && (
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs text-muted-foreground">Dropdown Options</Label>
                    {field.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <Input
                          placeholder={`Option ${optIdx + 1}`}
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
                      <Plus className="h-3.5 w-3.5" /> Add Option
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {additionalFields.length === 0 && (
            <p className="text-sm text-muted-foreground font-body text-center py-2">No custom registration fields.</p>
          )}
        </Card>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? "Update Event" : "Create Event"}
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
    </AppLayout>
  );
};

export default EventForm;
