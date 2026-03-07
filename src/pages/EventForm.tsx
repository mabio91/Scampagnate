import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useEvents";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, Loader2, Upload, ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type PaymentType = Database["public"]["Enums"]["payment_type"];

interface MeetingPointInput {
  name: string;
  location: string;
  time: string;
  notes: string;
}

const EventForm = () => {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { user, isOrganizer, profile, loading: authLoading } = useAuth();
  const { data: categories } = useCategories();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(isEditing);

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    category_id: "",
    spots_total: 20,
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
  });

  const [meetingPoints, setMeetingPoints] = useState<MeetingPointInput[]>([]);

  useEffect(() => {
    if (isEditing) {
      loadEvent();
    }
  }, [id]);

  const loadEvent = async () => {
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", id!)
      .single();

    if (event) {
      setForm({
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        location: event.location,
        category_id: event.category_id || "",
        spots_total: event.spots_total,
        price: event.price,
        deposit: event.deposit || 0,
        payment_type: event.payment_type,
        difficulty: event.difficulty || "",
        distance: event.distance || "",
        elevation: event.elevation || "",
        duration: event.duration || "",
        featured: event.featured,
        cancellation_policy: event.cancellation_policy || "",
        image_url: event.image_url || "",
      });

      const { data: points } = await supabase
        .from("event_meeting_points")
        .select("*")
        .eq("event_id", id!)
        .order("sort_order");

      if (points) {
        setMeetingPoints(points.map((p) => ({
          name: p.name,
          location: p.location,
          time: p.time,
          notes: p.notes || "",
        })));
      }
    }
    setLoadingEvent(false);
  };

  if (authLoading) return null;
  if (!user || !isOrganizer) return <Navigate to="/" replace />;

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
    if (!form.title || !form.date || !form.time || !form.location) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const eventData = {
        title: form.title,
        description: form.description,
        date: form.date,
        time: form.time,
        location: form.location,
        category_id: form.category_id || null,
        spots_total: form.spots_total,
        price: form.price,
        deposit: form.payment_type === "deposit" ? form.deposit : null,
        payment_type: form.payment_type,
        difficulty: form.difficulty || null,
        distance: form.distance || null,
        elevation: form.elevation || null,
        duration: form.duration || null,
        featured: form.featured,
        cancellation_policy: form.cancellation_policy || null,
        image_url: form.image_url || null,
        organizer_id: user.id,
        organizer_name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Organizer",
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

      // Handle meeting points
      if (isEditing) {
        await supabase.from("event_meeting_points").delete().eq("event_id", eventId!);
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
            {isEditing ? "Edit Event" : "Create Event"}
          </h1>
        </div>

        {/* Basic Info */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Basic Info</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="Event title" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Describe the event..." rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => updateForm("date", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="time">Time *</Label>
                <Input id="time" type="time" value={form.time} onChange={(e) => updateForm("time", e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input id="location" value={form.location} onChange={(e) => updateForm("location", e.target.value)} placeholder="Event location" />
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
            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <Input id="image_url" value={form.image_url} onChange={(e) => updateForm("image_url", e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </Card>

        {/* Capacity & Pricing */}
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">Capacity & Pricing</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="spots">Total Spots</Label>
              <Input id="spots" type="number" min={1} value={form.spots_total} onChange={(e) => updateForm("spots_total", parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={form.payment_type} onValueChange={(v) => updateForm("payment_type", v as PaymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.payment_type !== "free" && (
              <div>
                <Label htmlFor="price">Price (€)</Label>
                <Input id="price" type="number" min={0} step={0.01} value={form.price} onChange={(e) => updateForm("price", parseFloat(e.target.value) || 0)} />
              </div>
            )}
            {form.payment_type === "deposit" && (
              <div>
                <Label htmlFor="deposit">Deposit Amount (€)</Label>
                <Input id="deposit" type="number" min={0} step={0.01} value={form.deposit} onChange={(e) => updateForm("deposit", parseFloat(e.target.value) || 0)} />
              </div>
            )}
            <div>
              <Label htmlFor="cancellation">Cancellation Policy</Label>
              <Textarea id="cancellation" value={form.cancellation_policy} onChange={(e) => updateForm("cancellation_policy", e.target.value)} placeholder="e.g., Full refund up to 48h before event" rows={2} />
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
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
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
        </Card>

        {/* Meeting Points */}
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
              <Input placeholder="Location/Address" value={point.location} onChange={(e) => updateMeetingPoint(index, "location", e.target.value)} />
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

        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? "Update Event" : "Create Event"}
        </Button>
      </form>
    </AppLayout>
  );
};

export default EventForm;
