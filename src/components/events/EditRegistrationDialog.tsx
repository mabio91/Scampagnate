import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, CreditCard, Loader2, MapPin, RefreshCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getOptionPaymentSummary, type EventPricingLike, type PriceOptionLike } from "@/lib/priceOptions";

interface AdditionalRegistrationField {
  label: string;
  type?: string | null;
  required?: boolean | null;
  placeholder?: string | null;
  options?: string[] | string | null;
}

interface EventAdditionalFields {
  fields?: AdditionalRegistrationField[];
  car_availability_enabled?: boolean | null;
  ask_car_availability?: boolean | null;
}

interface MeetingPoint {
  id: string;
  name: string;
  location?: string | null;
  time?: string | null;
}

interface EditableRegistrationEvent extends EventPricingLike {
  additional_fields?: EventAdditionalFields | null;
  meeting_points?: MeetingPoint[] | null;
  price_options?: PriceOptionLike[] | null;
}

interface EditableRegistration {
  status?: string | null;
  payment_status?: string | null;
  meeting_point_id?: string | null;
  car_availability?: string | null;
  additional_responses?: Record<string, string> | null;
  price_option_id?: string | null;
}

export interface RegistrationChangeQuote {
  oldPriceOptionName: string;
  newPriceOptionName: string;
  oldTotalAmount: number;
  newTotalAmount: number;
  amountPaidBefore: number;
  additionalPaymentAmount: number;
  refundAmount: number;
  newBalanceDueAmount: number;
}

interface EditRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EditableRegistrationEvent;
  registration: EditableRegistration;
  isSubmitting: boolean;
  onSave: (payload: {
    meetingPointId?: string;
    carAvailability?: string;
    additionalResponses?: Record<string, string>;
  }) => void;
  priceChangeQuote?: RegistrationChangeQuote | null;
  priceChangeLoading?: boolean;
  priceChangeSubmitting?: boolean;
  onQuotePriceChange?: (priceOptionId: string) => void;
  onConfirmPriceChange?: (priceOptionId: string) => void;
}

const EditRegistrationDialog = ({
  open,
  onOpenChange,
  event,
  registration,
  isSubmitting,
  onSave,
  priceChangeQuote,
  priceChangeLoading,
  priceChangeSubmitting,
  onQuotePriceChange,
  onConfirmPriceChange,
}: EditRegistrationDialogProps) => {
  const additionalFields = useMemo(() => {
    const af = event?.additional_fields;
    return af && Array.isArray(af.fields) ? af.fields : [];
  }, [event?.additional_fields]);

  const meetingPoints = useMemo(() => event?.meeting_points || [], [event?.meeting_points]);
  const hasMeetingPoints = meetingPoints.length > 0;
  const carEnabled = Boolean(event?.additional_fields?.car_availability_enabled || event?.additional_fields?.ask_car_availability);

  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [carAvailability, setCarAvailability] = useState("");
  const [additionalResponses, setAdditionalResponses] = useState<Record<string, string>>({});
  const [selectedPriceOption, setSelectedPriceOption] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedMeetingPoint(
      registration?.meeting_point_id || (meetingPoints.length === 1 ? meetingPoints[0].id : ""),
    );
    setCarAvailability(registration?.car_availability || "");
    setAdditionalResponses((registration?.additional_responses as Record<string, string> | null) || {});
    setSelectedPriceOption(registration?.price_option_id || "");
  }, [open, registration, meetingPoints]);

  const priceOptions = useMemo(() => event?.price_options || [], [event?.price_options]);
  const currentPriceOption = useMemo(
    () => priceOptions.find((option) => option.id === registration?.price_option_id) || null,
    [priceOptions, registration?.price_option_id],
  );
  const selectedPriceOptionRow = useMemo(
    () => priceOptions.find((option) => option.id === selectedPriceOption) || null,
    [priceOptions, selectedPriceOption],
  );
  const registrationCanChangeFormula = ["registered", "paid", "deposit_paid"].includes(registration?.status || "");
  const priceChangeAvailable = Boolean(
    registrationCanChangeFormula && priceOptions.length > 1 && onQuotePriceChange && onConfirmPriceChange,
  );
  const hasSelectedDifferentFormula = Boolean(
    selectedPriceOption && selectedPriceOption !== (registration?.price_option_id || ""),
  );
  const hasEditableFields = hasMeetingPoints || carEnabled || additionalFields.length > 0;
  const meetingPointRequired = hasMeetingPoints && !selectedMeetingPoint;
  const customFieldsInvalid = additionalFields.some((field) => field.required && !String(additionalResponses[field.label] || "").trim());
  const isDisabled = isSubmitting || !hasEditableFields || meetingPointRequired || customFieldsInvalid;
  const priceChangeDisabled = !hasSelectedDifferentFormula || priceChangeLoading || priceChangeSubmitting;

  const handlePriceOptionChange = (value: string) => {
    setSelectedPriceOption(value);
    if (value && value !== (registration?.price_option_id || "")) {
      onQuotePriceChange?.(value);
    }
  };

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
                {meetingPoints.map((mp) => (
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

          {additionalFields.map((field, idx) => (
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

          {priceChangeAvailable && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
              <div>
                <Label className="font-body text-sm font-semibold mb-2 block">Formula di iscrizione</Label>
                {currentPriceOption && (
                  <p className="mb-2 text-xs font-body text-muted-foreground">
                    Attuale: <span className="font-semibold text-foreground">{currentPriceOption.name}</span> · {getOptionPaymentSummary(currentPriceOption, event)}
                  </p>
                )}
                <RadioGroup value={selectedPriceOption} onValueChange={handlePriceOptionChange} className="space-y-2">
                  {priceOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedPriceOption === option.id
                          ? "bg-primary/5 border-primary/30 shadow-sm"
                          : "bg-background border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <RadioGroupItem value={option.id || ""} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-body font-semibold text-foreground">{option.name}</p>
                        <p className="text-xs font-body text-muted-foreground">{getOptionPaymentSummary(option, event)}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {hasSelectedDifferentFormula && (
                <div className="rounded-xl bg-background p-3 text-sm font-body space-y-2">
                  {priceChangeLoading ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Calcolo differenza...
                    </p>
                  ) : priceChangeQuote ? (
                    <>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Nuova formula</span>
                        <span className="text-right font-semibold text-foreground">{selectedPriceOptionRow?.name}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Prezzo attuale</span>
                        <span className="font-semibold text-foreground">€{Number(priceChangeQuote.oldTotalAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Nuovo prezzo</span>
                        <span className="font-semibold text-foreground">€{Number(priceChangeQuote.newTotalAmount).toFixed(2)}</span>
                      </div>
                      {priceChangeQuote.additionalPaymentAmount > 0 && (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-primary/5 p-2 text-primary">
                          <span className="flex items-center gap-1 font-semibold"><CreditCard className="h-3.5 w-3.5" /> Saldo da pagare</span>
                          <span className="font-bold">€{Number(priceChangeQuote.additionalPaymentAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {priceChangeQuote.refundAmount > 0 && (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-green-50 p-2 text-green-700 dark:bg-green-950/20 dark:text-green-400">
                          <span className="flex items-center gap-1 font-semibold"><RefreshCcw className="h-3.5 w-3.5" /> Rimborso automatico</span>
                          <span className="font-bold">€{Number(priceChangeQuote.refundAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {priceChangeQuote.additionalPaymentAmount <= 0 && priceChangeQuote.refundAmount <= 0 && (
                        <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                          Nessun pagamento o rimborso immediato: aggiorneremo solo la formula e l'eventuale saldo residuo.
                        </p>
                      )}
                      {priceChangeQuote.newBalanceDueAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Dopo il cambio resterà un saldo di €{Number(priceChangeQuote.newBalanceDueAmount).toFixed(2)}.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Seleziona una formula diversa per calcolare saldo o rimborso.
                    </p>
                  )}
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                className="w-full font-body"
                onClick={() => selectedPriceOption && onConfirmPriceChange?.(selectedPriceOption)}
                disabled={priceChangeDisabled || !priceChangeQuote}
              >
                {priceChangeSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aggiornamento...</> : "Conferma cambio formula"}
              </Button>
            </div>
          )}

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
