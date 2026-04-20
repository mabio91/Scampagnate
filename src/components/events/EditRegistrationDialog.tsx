import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface EditRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
  registration: any;
  isSubmitting: boolean;
  onSave: (payload: {
    meetingPointId?: string;
    carAvailability?: string;
    additionalResponses?: Record<string, string>;
  }) => void;
}

const EditRegistrationDialog = ({
  open,
  onOpenChange,
  event,
  registration,
  isSubmitting,
  onSave,
}: EditRegistrationDialogProps) => {
  const additionalFields = useMemo(() => {
    const af = event?.additional_fields as any;
    return af && Array.isArray(af.fields) ? af.fields : [];
  }, [event?.additional_fields]);

  const hasMeetingPoints = Boolean(event?.meeting_points?.length);
  const carEnabled = Boolean((event?.additional_fields as any)?.car_availability_enabled || (event?.additional_fields as any)?.ask_car_availability);

  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [carAvailability, setCarAvailability] = useState("");
  const [additionalResponses, setAdditionalResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSelectedMeetingPoint(registration?.meeting_point_id || "");
    setCarAvailability(registration?.car_availability || "");
    setAdditionalResponses((registration?.additional_responses as Record<string, string> | null) || {});
  }, [open, registration]);

  const hasEditableFields = hasMeetingPoints || carEnabled || additionalFields.length > 0;
  const meetingPointRequired = hasMeetingPoints && !selectedMeetingPoint;
  const customFieldsInvalid = additionalFields.some((field: any) => field.required && !String(additionalResponses[field.label] || "").trim());
  const isDisabled = isSubmitting || !hasEditableFields || meetingPointRequired || customFieldsInvalid;

  const handleSave = () => {
    onSave({
      meetingPointId: hasMeetingPoints ? (selectedMeetingPoint || undefined) : undefined,
      carAvailability: carEnabled ? (carAvailability || undefined) : undefined,
      additionalResponses,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-display text-lg">Modifica iscrizione</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Aggiorna solo i dettagli di partecipazione configurati per questo evento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasMeetingPoints && (
            <div>
              <Label className="font-body text-sm font-semibold mb-2 block">Punto di ritrovo *</Label>
              <RadioGroup value={selectedMeetingPoint} onValueChange={setSelectedMeetingPoint} className="space-y-2">
                {event.meeting_points.map((mp: any) => (
                  <label
                    key={mp.id}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                      selectedMeetingPoint === mp.id
                        ? "bg-primary/5 border-primary/30 shadow-sm"
                        : "bg-muted/40 border-transparent hover:bg-muted/60"
                    }`}
                  >
                    <RadioGroupItem value={mp.id} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-semibold text-foreground">{mp.name}</p>
                      <p className="text-xs font-body text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" /> {mp.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-body font-bold text-primary shrink-0">
                      <Clock className="h-3.5 w-3.5" /> {mp.time?.slice(0, 5)}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {carEnabled && (
            <div>
              <Label className="font-body text-sm font-semibold">Saresti disposto a prendere la macchina?</Label>
              <RadioGroup value={carAvailability} onValueChange={setCarAvailability} className="mt-2 space-y-1.5">
                <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${carAvailability === "yes" ? "bg-primary/5 border-primary/30" : "bg-muted/40 border-transparent"}`}>
                  <RadioGroupItem value="yes" />
                  <span className="text-sm font-body">Si</span>
                </label>
                <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${carAvailability === "prefer_not" ? "bg-primary/5 border-primary/30" : "bg-muted/40 border-transparent"}`}>
                  <RadioGroupItem value="prefer_not" />
                  <span className="text-sm font-body">Preferirei di no</span>
                </label>
                <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${carAvailability === "no_car" ? "bg-primary/5 border-primary/30" : "bg-muted/40 border-transparent"}`}>
                  <RadioGroupItem value="no_car" />
                  <span className="text-sm font-body">Non sono automunito</span>
                </label>
              </RadioGroup>
            </div>
          )}

          {additionalFields.map((field: any, idx: number) => (
            <div key={`${field.label}-${idx}`}>
              <Label className="font-body text-sm font-semibold">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
              {(!field.type || field.type === "text") && (
                <Input
                  value={additionalResponses[field.label] || ""}
                  onChange={(e) => setAdditionalResponses((prev) => ({ ...prev, [field.label]: e.target.value }))}
                  placeholder={field.placeholder || ""}
                  className="mt-1"
                />
              )}
              {(field.type === "dropdown" || field.type === "select") && (
                <Select
                  value={additionalResponses[field.label] || ""}
                  onValueChange={(value) => setAdditionalResponses((prev) => ({ ...prev, [field.label]: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(field.options)
                      ? field.options
                      : typeof field.options === "string"
                        ? field.options.split(",").map((option: string) => option.trim())
                        : []
                    ).map((option: string, optionIdx: number) => (
                      <SelectItem key={`${field.label}-${optionIdx}`} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.type === "number" && (
                <Input
                  type="number"
                  value={additionalResponses[field.label] || ""}
                  onChange={(e) => setAdditionalResponses((prev) => ({ ...prev, [field.label]: e.target.value }))}
                  placeholder={field.placeholder || ""}
                  className="mt-1"
                />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 font-body" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Chiudi
            </Button>
            <Button className="flex-1 font-body" onClick={handleSave} disabled={isDisabled}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvataggio...</> : "Salva modifiche"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditRegistrationDialog;
