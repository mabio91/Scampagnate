import { useState } from "react";
import { isMembershipActive, isMembershipExpired, getMembershipExpiryDate } from "@/lib/membership";
import { parseCancellationPolicy, CANCELLATION_POLICIES } from "@/lib/cancellationPolicy";
import { useAuth } from "@/contexts/AuthContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import DiscountCodeInput from "@/components/events/DiscountCodeInput";
import { ResolvedPriceOption } from "@/hooks/usePricingEligibility";
import {
  MapPin, Clock, Car, CreditCard, Loader2, Tag, Lock, Sparkles, ShieldCheck,
  AlertTriangle, ChevronRight
} from "lucide-react";

interface RegistrationCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
  resolvedPriceOptions: ResolvedPriceOption[] | undefined;
  onRegister: (opts: {
    meetingPointId?: string;
    sportLevel?: string;
    priceOptionId?: string;
    carAvailability?: string;
    additionalResponses?: Record<string, string>;
    appliedDiscount?: any;
    requestApproval?: boolean;
  }) => void;
  isSubmitting: boolean;
  isRequestingOverride?: boolean;
  requiresApproval?: boolean;
  isSportCategory?: boolean;
}

const RegistrationCheckoutDialog = ({
  open, onOpenChange, event, resolvedPriceOptions, onRegister,
  isSubmitting, isRequestingOverride, requiresApproval, isSportCategory,
}: RegistrationCheckoutDialogProps) => {
  const { user, profile } = useAuth();

  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [sportLevel, setSportLevel] = useState("");
  const [carAvailability, setCarAvailability] = useState("");
  const [additionalResponses, setAdditionalResponses] = useState<Record<string, string>>({});
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);
  const [selectedPriceOption, setSelectedPriceOption] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);

  const hasMeetingPoints = event.meeting_points && event.meeting_points.length > 0;
  const hasPriceOptions = event.price_options && event.price_options.length > 0;
  const hasEquipment = event.equipment_list && Array.isArray(event.equipment_list);
  const hasMandatoryEquipment = hasEquipment && (event.equipment_list as any[]).some((item: any) => item.is_mandatory);
  const carEnabled = event.additional_fields && (event.additional_fields as any).car_availability_enabled;
  const needsMembership = !isMembershipActive(profile);
  const membershipActive = isMembershipActive(profile);
  const membershipExpired = isMembershipExpired(profile);
  const isPaymentEvent = event.payment_type === "paid" || event.payment_type === "deposit";

  // Custom fields
  const af = event.additional_fields as any;
  const customFields = af && af.fields ? af.fields : (Array.isArray(af) ? af : []);

  // Compute pricing
  const selectedOpt = event.price_options?.find((o: any) => o.id === selectedPriceOption);
  const basePrice = selectedOpt ? Number(selectedOpt.price) : Number(event.price);
  const isDeposit = (event.payment_type as string) === "deposit" && event.deposit && !selectedOpt;
  const depositAmount = isDeposit ? Number(event.deposit) : 0;
  const displayPrice = isDeposit ? depositAmount : basePrice;
  const membershipFee = needsMembership ? 10 : 0;
  const discountedEventPrice = appliedDiscount ? Number(appliedDiscount.final_price) : displayPrice;
  const totalDueToday = discountedEventPrice + membershipFee;
  const remainingAmount = isDeposit ? Number(event.price) - depositAmount : 0;

  // Membership expiry display
  const expiryDate = getMembershipExpiryDate(profile);
  const expiryStr = expiryDate ? expiryDate.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  // (cancellation details computed below after pricing)

  // Validation
  const meetingPointRequired = hasMeetingPoints && !selectedMeetingPoint;
  const priceOptionRequired = hasPriceOptions && !selectedPriceOption;
  const customFieldsInvalid = customFields.some((f: any) => f.required && !additionalResponses[f.label]?.trim());
  const equipmentRequired = hasMandatoryEquipment && !equipmentConfirmed;
  const isDisabled = isSubmitting || meetingPointRequired || priceOptionRequired || customFieldsInvalid || equipmentRequired;

  const handleSubmit = () => {
    onRegister({
      meetingPointId: selectedMeetingPoint || undefined,
      sportLevel: sportLevel || undefined,
      priceOptionId: selectedPriceOption || undefined,
      carAvailability: carAvailability || undefined,
      additionalResponses,
      appliedDiscount,
      requestApproval: isRequestingOverride || requiresApproval,
    });
  };

  // CTA label (dynamic per scenario)
  const ctaLabel = (() => {
    if (isSubmitting) return null;
    if (isRequestingOverride || requiresApproval) return "Invia richiesta di iscrizione";
    if (event.status === "full") return "Iscriviti alla lista d'attesa";
    if (needsMembership && !isPaymentEvent && event.payment_type === "free") return "Attiva tessera e iscriviti";
    if (isDeposit) return "Paga acconto e iscriviti";
    if (isPaymentEvent) return "Paga e completa l'iscrizione";
    if (needsMembership) return "Attiva tessera e iscriviti";
    return "Conferma iscrizione";
  })();

  // Helper text above CTA
  const ctaHelperText = (() => {
    if (isRequestingOverride || requiresApproval) return "La tua richiesta verrà inviata agli organizzatori per l'approvazione.";
    if (isPaymentEvent || needsMembership) return "Verrai reindirizzato al pagamento sicuro per completare l'iscrizione.";
    return "L'iscrizione verrà confermata subito.";
  })();

  // Cancellation policy details
  const cancellationDetails = (() => {
    if (!event.cancellation_policy) return null;
    const { policyType } = parseCancellationPolicy(event.cancellation_policy);
    if (!policyType) return null;
    const policy = CANCELLATION_POLICIES[policyType];
    if (!policy) return null;
    return { label: policy.labelIt, description: policy.descriptionIt, icon: policy.icon, colorClass: policy.colorClass };
  })();

  // Check if Section 1 has any content
  const hasSection1 = hasMeetingPoints || isSportCategory || carEnabled || customFields.length > 0 || hasMandatoryEquipment;

  // Check if Section 2 has any content (pricing/membership)
  const hasSection2 = hasPriceOptions || isPaymentEvent || event.payment_type === "location" || needsMembership;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-display text-lg">
              Completa l'iscrizione a {event.title}
            </DialogTitle>
            <DialogDescription className="font-body text-xs text-muted-foreground">
              Seleziona le opzioni richieste e controlla il riepilogo prima di procedere al pagamento.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 space-y-0">

          {/* ═══════ SECTION 1 — PARTICIPATION DETAILS ═══════ */}
          {hasSection1 && (
            <div className="py-4 space-y-4">
              <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider">Dettagli Partecipazione</p>

              {/* Meeting Points */}
              {hasMeetingPoints && (
                <div>
                  <Label className="font-body text-sm font-semibold mb-2 block">Punto di Ritrovo *</Label>
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

              {/* Custom registration fields */}
              {customFields.length > 0 && customFields.map((field: any, idx: number) => (
                <div key={idx}>
                  <Label className="font-body text-sm font-semibold">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {(!field.type || field.type === "text") && (
                    <Input
                      value={additionalResponses[field.label] || ""}
                      onChange={(e) => setAdditionalResponses(prev => ({ ...prev, [field.label]: e.target.value }))}
                      placeholder={field.placeholder || ""}
                      className="mt-1"
                    />
                  )}
                  {field.type === "dropdown" && (
                    <Select
                      value={additionalResponses[field.label] || ""}
                      onValueChange={(val) => setAdditionalResponses(prev => ({ ...prev, [field.label]: val }))}
                    >
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(field.options) ? field.options : (typeof field.options === 'string' ? field.options.split(',').map((s: string) => s.trim()) : [])).map((opt: string, optIdx: number) => (
                          <SelectItem key={optIdx} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.type === "number" && (
                    <Input
                      type="number"
                      value={additionalResponses[field.label] || ""}
                      onChange={(e) => setAdditionalResponses(prev => ({ ...prev, [field.label]: e.target.value }))}
                      placeholder={field.placeholder || ""}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}

              {/* Car availability */}
              {carEnabled && (
                <div>
                  <Label className="font-body text-sm font-semibold">Saresti disposto a prendere la macchina?</Label>
                  <RadioGroup value={carAvailability} onValueChange={setCarAvailability} className="mt-2 space-y-1.5">
                    <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${carAvailability === "yes" ? "bg-primary/5 border-primary/30" : "bg-muted/40 border-transparent"}`}>
                      <RadioGroupItem value="yes" />
                      <span className="text-sm font-body">✅ Sì</span>
                    </label>
                    <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${carAvailability === "prefer_not" ? "bg-primary/5 border-primary/30" : "bg-muted/40 border-transparent"}`}>
                      <RadioGroupItem value="prefer_not" />
                      <span className="text-sm font-body">🤷 Preferirei di no</span>
                    </label>
                    <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${carAvailability === "no_car" ? "bg-primary/5 border-primary/30" : "bg-muted/40 border-transparent"}`}>
                      <RadioGroupItem value="no_car" />
                      <span className="text-sm font-body">🚶 Non sono automunito</span>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {/* Sport level */}
              {isSportCategory && (
                <div>
                  <Label className="font-body text-sm font-semibold">Livello Sportivo</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[{ key: "Beginner", label: "Principiante" }, { key: "Intermediate", label: "Intermedio" }, { key: "Advanced", label: "Avanzato" }].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSportLevel(sportLevel === key ? "" : key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-colors ${
                          sportLevel === key
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={!["Beginner", "Intermediate", "Advanced"].includes(sportLevel) ? sportLevel : ""}
                    onChange={(e) => setSportLevel(e.target.value)}
                    placeholder="Oppure inserisci il livello personalizzato"
                    className="mt-2"
                  />
                </div>
              )}

              {/* Equipment confirmation */}
              {hasMandatoryEquipment && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={equipmentConfirmed}
                      onCheckedChange={(checked) => setEquipmentConfirmed(!!checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs font-body text-foreground leading-relaxed">
                      Confermo di avere tutta l'attrezzatura obbligatoria richiesta per questa attività
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          {hasSection1 && hasSection2 && <div className="border-t border-border" />}

          {/* ═══════ SECTION 2 — PRICING & MEMBERSHIP ═══════ */}
          {hasSection2 && (
            <div className="py-4 space-y-4">
              <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider">Prezzo e Tessera</p>

              {/* Price options */}
              {resolvedPriceOptions && resolvedPriceOptions.length > 0 && (
                <div>
                  <Label className="font-body text-sm font-semibold mb-2 block">Scegli l'opzione di prezzo *</Label>
                  <RadioGroup value={selectedPriceOption} onValueChange={setSelectedPriceOption} className="space-y-2">
                    {resolvedPriceOptions.map((opt: ResolvedPriceOption) => (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                          !opt.isEligible ? "bg-muted/30 opacity-60 cursor-not-allowed border-transparent" :
                          selectedPriceOption === opt.id ? "bg-primary/5 border-primary/30 shadow-sm" :
                          "bg-muted/40 border-transparent hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={opt.id} disabled={!opt.isEligible} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-body font-semibold text-foreground">{opt.name}</span>
                              {opt.isEligible && opt.eligible_group !== "all" && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-body font-semibold flex items-center gap-0.5">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  {opt.eligible_group === "members" ? "Soci" : opt.eligible_group === "experienced" ? "Esperto" : opt.eligible_group === "loyal" ? "Fedele" : opt.eligible_group}
                                </span>
                              )}
                              {opt.is_promotional && opt.isPromoActive && (
                                <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-body font-semibold">Promo</span>
                              )}
                            </div>
                            {!opt.isEligible && opt.eligibilityReason && (
                              <p className="text-[10px] text-muted-foreground font-body flex items-center gap-1 mt-0.5">
                                <Lock className="h-2.5 w-2.5" /> {opt.eligibilityReason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {opt.original_price && opt.original_price > opt.price && (
                            <span className="text-xs font-body text-muted-foreground line-through block">€{opt.original_price.toFixed(2)}</span>
                          )}
                          <span className={`text-sm font-display font-bold ${opt.isEligible && opt.original_price && opt.original_price > opt.price ? "text-green-600" : "text-foreground"}`}>
                            €{Number(opt.price).toFixed(2)}
                          </span>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Fallback price options (no eligibility data) */}
              {!resolvedPriceOptions && hasPriceOptions && (
                <div>
                  <Label className="font-body text-sm font-semibold mb-2 block">Scegli l'opzione di prezzo *</Label>
                  <RadioGroup value={selectedPriceOption} onValueChange={setSelectedPriceOption} className="space-y-2">
                    {event.price_options.map((opt: any) => (
                      <label key={opt.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedPriceOption === opt.id ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-muted/40 border-transparent hover:bg-muted/60"
                      }`}>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={opt.id} />
                          <span className="text-sm font-body font-semibold text-foreground">{opt.name}</span>
                        </div>
                        <span className="text-sm font-display font-bold text-foreground">€{Number(opt.price).toFixed(2)}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Membership block */}
              {membershipActive && (
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-body font-semibold text-green-700 dark:text-green-400">Tessera attiva</p>
                    {expiryStr && (
                      <p className="text-xs font-body text-green-600 dark:text-green-500">Valida fino al {expiryStr}</p>
                    )}
                  </div>
                </div>
              )}

              {needsMembership && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <p className="text-sm font-body font-bold text-primary">Tessera associativa ASD Scampagnate</p>
                  </div>
                  <p className="text-xs font-body text-muted-foreground leading-relaxed">
                    Per partecipare a questo evento è richiesta la tessera associativa ASD Scampagnate.
                    La tessera è valida per l'anno in corso e include copertura assicurativa base durante le attività.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-body font-bold text-foreground">€10 / anno</span>
                  </div>
                  <p className="text-[10px] font-body text-muted-foreground">
                    La tessera verrà attivata automaticamente con questo pagamento.
                  </p>
                </div>
              )}

              {/* Discount code */}
              {isPaymentEvent && user && (
                <div>
                  <p className="text-sm font-body text-muted-foreground mb-2">Hai un codice sconto?</p>
                  <DiscountCodeInput
                    eventId={event.id}
                    userId={user.id}
                    onDiscountApplied={setAppliedDiscount}
                  />
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          {(hasSection1 || hasSection2) && <div className="border-t border-border" />}

          {/* ═══════ SECTION 3 — FINAL SUMMARY ═══════ */}
          <div className="py-4 space-y-4">
            <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider">Riepilogo</p>

            {/* Amount due today */}
            {(isPaymentEvent || event.payment_type === "location" || needsMembership) && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-2">
                {/* Da pagare oggi */}
                <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-1">Da pagare oggi</p>

                {(isPaymentEvent || event.payment_type === "location") && displayPrice > 0 && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">
                      {isDeposit ? "Acconto evento" : (selectedOpt?.name || "Evento")}
                    </span>
                    <span className={`font-semibold ${appliedDiscount ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      €{displayPrice.toFixed(2)}
                    </span>
                  </div>
                )}

                {appliedDiscount && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-green-600 font-semibold flex items-center gap-1">
                      <Tag className="h-3 w-3" /> Sconto applicato
                    </span>
                    <span className="font-bold text-green-600">€{discountedEventPrice.toFixed(2)}</span>
                  </div>
                )}

                {event.payment_type === "location" && displayPrice > 0 && (
                  <p className="text-xs font-body text-muted-foreground italic">Da saldare in loco</p>
                )}

                {needsMembership && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Quota associativa
                    </span>
                    <span className="font-semibold text-primary">€{membershipFee.toFixed(2)}</span>
                  </div>
                )}

                {(isPaymentEvent || needsMembership) && (
                  <div className="flex justify-between text-sm font-body pt-2 mt-1 border-t border-border">
                    <span className="font-bold text-foreground">Totale da pagare oggi</span>
                    <span className="font-bold text-foreground text-base">€{totalDueToday.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Amount due later */}
            {remainingAmount > 0 && (
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20">
                <p className="text-xs font-body font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Da pagare dopo</p>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-amber-700 dark:text-amber-400">Saldo evento</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">€{remainingAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Cancellation policy */}
            {cancellationDetails && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                <div className="flex items-center gap-2">
                  <cancellationDetails.icon className={`h-4 w-4 shrink-0 ${cancellationDetails.colorClass}`} />
                  <p className="text-sm font-body font-semibold text-foreground">
                    Politica di cancellazione: {cancellationDetails.label}
                  </p>
                </div>
                <p className="text-xs font-body text-muted-foreground pl-6">
                  {cancellationDetails.description}
                </p>
              </div>
            )}

            {/* Free event notice */}
            {event.payment_type === "free" && !needsMembership && (
              <div className="p-3 rounded-xl bg-green-50/60 dark:bg-green-950/10 border border-green-200/40 dark:border-green-800/20">
                <p className="text-sm font-body font-semibold text-green-700 dark:text-green-400">Evento gratuito — nessun pagamento richiesto</p>
              </div>
            )}

            {event.payment_type === "free" && needsMembership && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-2">
                <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-1">Da pagare oggi</p>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-primary font-semibold flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Quota associativa
                  </span>
                  <span className="font-semibold text-primary">€10.00</span>
                </div>
                <div className="flex justify-between text-sm font-body pt-2 mt-1 border-t border-border">
                  <span className="font-bold text-foreground">Totale da pagare oggi</span>
                  <span className="font-bold text-foreground text-base">€10.00</span>
                </div>
              </div>
            )}

            {/* Helper text above CTA */}
            <p className="text-xs font-body text-muted-foreground text-center leading-relaxed px-2">
              {ctaHelperText}
            </p>

            {/* CTA */}
            <Button
              onClick={handleSubmit}
              disabled={isDisabled}
              className="w-full h-12 font-body font-semibold text-sm rounded-xl"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Attendere...</>
              ) : (
                <>
                  {(isPaymentEvent || needsMembership) && <CreditCard className="h-4 w-4 mr-2" />}
                  {ctaLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationCheckoutDialog;
