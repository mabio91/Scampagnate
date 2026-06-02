import { useEffect, useMemo, useRef, useState } from "react";
import { isMembershipActive, isMembershipExpired, getMembershipExpiryDate } from "@/lib/membership";
import { useMembershipFee } from "@/hooks/useMembershipFee";
import { getPolicyDefinition } from "@/lib/cancellationPolicy";
import { getCheckoutServiceFeeAmount, getDiscountedCheckoutAmount } from "@/lib/checkoutPricing";
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
  canOptionJoinWaitlist,
  findPriceOptionById,
  getEligibilityLabel,
  getOptionAvailabilityLabel,
  getOptionBalanceAmount,
  getOptionBalancePaymentMode,
  getOptionDepositAmount,
  getPriceOptionDisplayName,
  getOptionPaymentSummary,
  getOptionPaymentType,
  getOptionTotalPrice,
  isOnlinePaymentType,
  isOptionBookable,
  type PriceOptionLike,
} from "@/lib/priceOptions";
import { getPromoBadgeLabel, getPromoWindowStatus } from "@/lib/promoPricing";
import {
  MapPin, Clock, Car, CreditCard, Loader2, Tag, Lock, Sparkles, ShieldCheck,
  AlertTriangle, ChevronRight
} from "lucide-react";

const PromoOptionLabel = ({ endsAt, now }: { endsAt: string | null | undefined; now: Date }) => {
  const label = getPromoBadgeLabel(endsAt, now);
  const hasCountdown = label.startsWith("-");

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-body font-semibold leading-none text-warning"
      aria-label={hasCountdown ? `Promo ${label}` : label}
    >
      <span>Promo</span>
      {hasCountdown && (
        <span className="inline-flex items-center">
          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
          <span className="-ml-px">{label}</span>
        </span>
      )}
    </span>
  );
};

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
    paymentChoice?: "deposit" | "full";
    asWaitlist?: boolean;
    paymentType?: "free" | "paid" | "deposit" | "location";
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
  const { data: membershipFeeAmount = 10 } = useMembershipFee();

  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [sportLevel, setSportLevel] = useState("");
  const [carAvailability, setCarAvailability] = useState("");
  const [additionalResponses, setAdditionalResponses] = useState<Record<string, string>>({});
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);
  const [selectedPriceOption, setSelectedPriceOption] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [paymentChoice, setPaymentChoice] = useState<"deposit" | "full">("deposit");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [promoNow, setPromoNow] = useState(() => new Date());
  const meetingPointRef = useRef<HTMLDivElement>(null);
  const priceOptionRef = useRef<HTMLDivElement>(null);
  const equipmentRef = useRef<HTMLDivElement>(null);
  const customFieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) {
      setAttemptedSubmit(false);
      setSelectedMeetingPoint("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setPromoNow(new Date());
    const timer = window.setInterval(() => setPromoNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const meetingPoints = useMemo(() => event.meeting_points || [], [event.meeting_points]);
  const hasMeetingPoints = meetingPoints.length > 0;
  const hasPriceOptions = event.price_options && event.price_options.length > 0;
  const visiblePriceOptions = resolvedPriceOptions ?? event.price_options ?? [];
  const singlePriceOption = visiblePriceOptions.length === 1 ? visiblePriceOptions[0] : null;
  const hasSinglePriceOption = Boolean(singlePriceOption);
  const hasEquipment = event.equipment_list && Array.isArray(event.equipment_list);
  const hasMandatoryEquipment = hasEquipment && (event.equipment_list as any[]).some((item: any) => item.is_mandatory);
  const carEnabled = event.additional_fields && ((event.additional_fields as any).car_availability_enabled || (event.additional_fields as any).ask_car_availability);
  const needsMembership = !isMembershipActive(profile);
  const membershipActive = isMembershipActive(profile);
  const membershipExpired = isMembershipExpired(profile);
  const selectedOpt = findPriceOptionById(event.price_options, selectedPriceOption);
  const selectedResolvedOpt = resolvedPriceOptions?.find((option) => option.id === selectedPriceOption);
  const selectedOptionIneligible = selectedResolvedOpt ? !selectedResolvedOpt.isEligible : false;
  const selectedPaymentType = getOptionPaymentType(selectedOpt, event);
  const isPaymentEvent = isOnlinePaymentType(selectedPaymentType);
  const balancePaymentMode = getOptionBalancePaymentMode(selectedOpt, event);
  const canPayFullAmount = selectedPaymentType === "deposit" && balancePaymentMode === "online";
  const effectivePaymentChoice = canPayFullAmount ? paymentChoice : "deposit";
  const selectedOptionBookable = hasPriceOptions
    ? Boolean(selectedOpt && isOptionBookable(selectedOpt, event))
    : isOptionBookable(null, event);
  const selectedOptionCanWaitlist = hasPriceOptions
    ? Boolean(selectedOpt && canOptionJoinWaitlist(selectedOpt, event))
    : canOptionJoinWaitlist(null, event);
  const selectedOptionIsWaitlist = selectedOptionCanWaitlist;
  const selectedOptionUnavailable = Boolean(
    ((hasPriceOptions ? selectedPriceOption : true) && !selectedOptionBookable && !selectedOptionCanWaitlist) || selectedOptionIneligible
  );

  // Custom fields
  const af = event.additional_fields as any;
  const customFields = af && af.fields ? af.fields : (Array.isArray(af) ? af : []);

  // Compute pricing
  const totalEventPrice = getOptionTotalPrice(selectedOpt, event);
  const depositAmount = getOptionDepositAmount(selectedOpt, event);
  const isDepositPayment = selectedPaymentType === "deposit" && effectivePaymentChoice === "deposit";
  const displayPrice = selectedPaymentType === "deposit"
    ? (isDepositPayment ? depositAmount : totalEventPrice)
    : totalEventPrice;
  const membershipFee = needsMembership && !selectedOptionIsWaitlist ? membershipFeeAmount : 0;
  const serviceFee = getCheckoutServiceFeeAmount(
    selectedPaymentType,
    isPaymentEvent,
    selectedOptionIsWaitlist,
    appliedDiscount,
  );
  const discountedEventPrice = appliedDiscount
    ? getDiscountedCheckoutAmount(displayPrice, appliedDiscount)
    : displayPrice;
  const totalDueToday = discountedEventPrice + serviceFee + membershipFee;
  const remainingAmount = selectedPaymentType === "deposit" && isDepositPayment
    ? getOptionBalanceAmount(selectedOpt, event)
    : 0;

  // Membership expiry display
  const expiryDate = getMembershipExpiryDate(profile);
  const expiryStr = expiryDate ? expiryDate.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  // (cancellation details computed below after pricing)

  // Validation
  const meetingPointRequired = hasMeetingPoints && !selectedMeetingPoint;
  const priceOptionRequired = hasPriceOptions && !selectedPriceOption;
  const customFieldsInvalid = customFields.some((f: any) => f.required && !additionalResponses[f.label]?.trim());
  const equipmentRequired = hasMandatoryEquipment && !equipmentConfirmed;
  const isDisabled = isSubmitting || selectedOptionUnavailable;
  const showValidation = attemptedSubmit && (meetingPointRequired || priceOptionRequired || customFieldsInvalid || equipmentRequired);
  const firstInvalidRef = () => {
    if (meetingPointRequired) return meetingPointRef.current;
    if (priceOptionRequired) return priceOptionRef.current;
    const firstInvalidField = customFields.find((field: any) => field.required && !additionalResponses[field.label]?.trim());
    if (firstInvalidField) return customFieldRefs.current[firstInvalidField.label];
    if (equipmentRequired) return equipmentRef.current;
    return null;
  };

  const handleSubmit = () => {
    if (meetingPointRequired || priceOptionRequired || customFieldsInvalid || equipmentRequired) {
      setAttemptedSubmit(true);
      firstInvalidRef()?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    onRegister({
      meetingPointId: selectedMeetingPoint || undefined,
      sportLevel: sportLevel || undefined,
      priceOptionId: selectedPriceOption || undefined,
      carAvailability: carAvailability || undefined,
      additionalResponses,
      appliedDiscount,
      requestApproval: isRequestingOverride || requiresApproval,
      paymentChoice: selectedPaymentType === "deposit" && !selectedOptionIsWaitlist ? effectivePaymentChoice : undefined,
      asWaitlist: selectedOptionIsWaitlist,
      paymentType: selectedPaymentType,
    });
  };

  // CTA label (dynamic per scenario)
  const ctaLabel = (() => {
    if (isSubmitting) return null;
    if (isRequestingOverride || requiresApproval) return "Invia richiesta di iscrizione";
    if (selectedOptionIsWaitlist) return "Iscriviti alla lista d'attesa";
    if (needsMembership && !isPaymentEvent && selectedPaymentType === "free") return "Attiva tessera e iscriviti";
    if (selectedPaymentType === "deposit") return effectivePaymentChoice === "full" ? "Paga tutto e iscriviti" : "Paga acconto e iscriviti";
    if (isPaymentEvent) return "Paga e completa l'iscrizione";
    if (needsMembership) return "Attiva tessera e iscriviti";
    return "Conferma iscrizione";
  })();

  // Helper text above CTA
  const ctaHelperText = (() => {
    if (isRequestingOverride || requiresApproval) return "La tua richiesta verrà inviata agli organizzatori per l'approvazione.";
    if (selectedOptionIsWaitlist) return "Entrerai in lista d'attesa per questa formula: nessun pagamento viene avviato ora.";
    if (selectedPaymentType === "deposit" && effectivePaymentChoice === "deposit" && balancePaymentMode === "on_site") {
      return "Pagherai l'acconto online ora. Il saldo rimanente andrà versato sul posto.";
    }
    if (selectedPaymentType === "deposit" && effectivePaymentChoice === "deposit") {
      return "Pagherai l'acconto online ora. Il saldo rimanente resterà da completare online.";
    }
    if (isPaymentEvent || needsMembership) return "Verrai reindirizzato al pagamento sicuro per completare l'iscrizione.";
    return "L'iscrizione verrà confermata subito.";
  })();

  // Cancellation policy details
  const cancellationDetails = event.cancellation_policy
    ? getPolicyDefinition(event.cancellation_policy)
    : null;

  // Check if Section 1 has any content
  const hasSection1 = hasMeetingPoints || isSportCategory || carEnabled || customFields.length > 0 || hasMandatoryEquipment;

  // Check if Section 2 has any content (pricing/membership)
  const hasSection2 = hasPriceOptions || isPaymentEvent || selectedPaymentType === "location" || (needsMembership && !selectedOptionIsWaitlist);

  useEffect(() => {
    if (!open || !singlePriceOption?.id || selectedPriceOption === singlePriceOption.id) return;
    setSelectedPriceOption(singlePriceOption.id);
  }, [open, selectedPriceOption, singlePriceOption?.id]);

  const getCheckoutPaymentDetail = (option: PriceOptionLike | null | undefined) => {
    const paymentType = getOptionPaymentType(option, event);
    if (paymentType === "free") return "Gratis";
    if (paymentType === "location") return "Pagamento sul posto";
    if (paymentType === "paid") return "Pagamento online";
    return getOptionPaymentSummary(option, event);
  };

  const getCheckoutAmountLabel = (option: PriceOptionLike | null | undefined) =>
    getOptionPaymentType(option, event) === "free" ? "Gratis" : `€${getOptionTotalPrice(option, event).toFixed(2)}`;

  const getCheckoutDetailLine = (option: PriceOptionLike | null | undefined) => {
    const availability = getOptionAvailabilityLabel(option, event);
    const paymentDetail = getCheckoutPaymentDetail(option);
    return paymentDetail === "Gratis" ? availability : `${paymentDetail} · ${availability}`;
  };

  const shouldShowPromoBadge = (option: PriceOptionLike | null | undefined) => {
    if (!option?.is_promotional) return false;
    const promoStatus = getPromoWindowStatus(option.promo_start, option.promo_end, promoNow);
    return promoStatus === "active";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto p-0 rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                <div ref={meetingPointRef}>
                  <Label className="font-body text-sm font-semibold mb-2 block">Punto di Ritrovo *</Label>
                  <RadioGroup value={selectedMeetingPoint} onValueChange={setSelectedMeetingPoint} className={`space-y-2 rounded-xl ${attemptedSubmit && meetingPointRequired ? "ring-2 ring-destructive ring-offset-2 ring-offset-background" : ""}`}>
                    {meetingPoints.map((mp: any) => (
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
                  {attemptedSubmit && meetingPointRequired && (
                    <p className="mt-2 text-xs font-body font-semibold text-destructive">Scegli un punto di ritrovo per continuare.</p>
                  )}
                </div>
              )}

              {/* Custom registration fields */}
              {customFields.length > 0 && customFields.map((field: any, idx: number) => (
                <div key={idx} ref={(node) => { customFieldRefs.current[field.label] = node; }}>
                  <Label className="font-body text-sm font-semibold">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {(!field.type || field.type === "text") && (
                    <Input
                      value={additionalResponses[field.label] || ""}
                      onChange={(e) => setAdditionalResponses(prev => ({ ...prev, [field.label]: e.target.value }))}
                      placeholder={field.placeholder || ""}
                      className={`mt-1 ${attemptedSubmit && field.required && !additionalResponses[field.label]?.trim() ? "border-destructive ring-1 ring-destructive" : ""}`}
                    />
                  )}
                  {(field.type === "dropdown" || field.type === "select") && (
                    <Select
                      value={additionalResponses[field.label] || ""}
                      onValueChange={(val) => setAdditionalResponses(prev => ({ ...prev, [field.label]: val }))}
                    >
                      <SelectTrigger className={`mt-1 ${attemptedSubmit && field.required && !additionalResponses[field.label]?.trim() ? "border-destructive ring-1 ring-destructive" : ""}`}><SelectValue placeholder="Seleziona..." /></SelectTrigger>
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
                      className={`mt-1 ${attemptedSubmit && field.required && !additionalResponses[field.label]?.trim() ? "border-destructive ring-1 ring-destructive" : ""}`}
                    />
                  )}
                  {attemptedSubmit && field.required && !additionalResponses[field.label]?.trim() && (
                    <p className="mt-1.5 text-xs font-body font-semibold text-destructive">Campo obbligatorio.</p>
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
                <div ref={equipmentRef} className={`p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border ${attemptedSubmit && equipmentRequired ? "border-destructive ring-2 ring-destructive/40" : "border-amber-200 dark:border-amber-800/30"}`}>
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
                  {attemptedSubmit && equipmentRequired && (
                    <p className="mt-2 text-xs font-body font-semibold text-destructive">
                      Conferma l'attrezzatura obbligatoria per completare l'iscrizione.
                    </p>
                  )}
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
              {singlePriceOption && (
                <div ref={priceOptionRef} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-transparent">
                  <div className="min-w-0 space-y-1">
                    {shouldShowPromoBadge(singlePriceOption) && (
                      <PromoOptionLabel endsAt={singlePriceOption.promo_end} now={promoNow} />
                    )}
                    <p className="text-sm font-body font-semibold text-foreground">{getPriceOptionDisplayName(singlePriceOption)}</p>
                    <p className="text-[10px] text-muted-foreground font-body">
                      {getCheckoutDetailLine(singlePriceOption)}
                    </p>
                    {"isEligible" in singlePriceOption && !(singlePriceOption as ResolvedPriceOption).isEligible && (singlePriceOption as ResolvedPriceOption).eligibilityReason && (
                      <p className="text-[10px] text-muted-foreground font-body flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> {(singlePriceOption as ResolvedPriceOption).eligibilityReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {singlePriceOption.original_price && Number(singlePriceOption.original_price) > Number(singlePriceOption.price) && (
                      <span className="text-xs font-body text-muted-foreground line-through block">€{Number(singlePriceOption.original_price).toFixed(2)}</span>
                    )}
                    <span className={`text-sm font-display font-bold ${shouldShowPromoBadge(singlePriceOption) ? "text-warning" : singlePriceOption.original_price && Number(singlePriceOption.original_price) > Number(singlePriceOption.price) ? "text-green-600" : "text-foreground"}`}>
                      {getCheckoutAmountLabel(singlePriceOption)}
                    </span>
                  </div>
                </div>
              )}

              {resolvedPriceOptions && resolvedPriceOptions.length > 1 && (
                <div ref={priceOptionRef}>
                  <Label className="font-body text-sm font-semibold mb-2 block">Scegli la formula *</Label>
                  <RadioGroup value={selectedPriceOption} onValueChange={setSelectedPriceOption} className={`space-y-2 rounded-xl ${attemptedSubmit && priceOptionRequired ? "ring-2 ring-destructive ring-offset-2 ring-offset-background" : ""}`}>
                    {resolvedPriceOptions.map((opt: ResolvedPriceOption) => {
                      const bookable = isOptionBookable(opt, event);
                      const canWaitlist = !bookable && canOptionJoinWaitlist(opt, event);
                      const disabled = !opt.isEligible || (!bookable && !canWaitlist);
                      const selected = selectedPriceOption === opt.id;
                      const hasPromo = shouldShowPromoBadge(opt);
                      const selectedClass = hasPromo
                        ? "bg-warning/5 border-warning shadow-sm cursor-pointer"
                        : "bg-primary/5 border-primary/30 shadow-sm cursor-pointer";
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-start justify-between gap-3 p-3 rounded-xl transition-all border ${
                            disabled ? "bg-muted/30 opacity-60 cursor-not-allowed border-transparent" :
                            selected ? selectedClass :
                            "bg-muted/40 border-transparent hover:bg-muted/60 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <RadioGroupItem value={opt.id} disabled={disabled} className={`mt-1 ${hasPromo ? "border-warning text-warning" : ""}`} />
                            <div className="min-w-0">
                              {hasPromo && (
                                <PromoOptionLabel endsAt={opt.promo_end} now={promoNow} />
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-body font-semibold text-foreground">{opt.name}</span>
                                {opt.isEligible && opt.eligible_group !== "all" && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-body font-semibold flex items-center gap-0.5">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    {getEligibilityLabel(opt.eligible_group)}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-body mt-0.5">
                                {getCheckoutDetailLine(opt)}
                              </p>
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
                            <span className={`text-sm font-display font-bold ${hasPromo ? "text-warning" : opt.isEligible && opt.original_price && opt.original_price > opt.price ? "text-green-600" : "text-foreground"}`}>
                              {getCheckoutAmountLabel(opt)}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                  {attemptedSubmit && priceOptionRequired && (
                    <p className="mt-2 text-xs font-body font-semibold text-destructive">Scegli una formula di partecipazione.</p>
                  )}
                </div>
              )}

              {/* Fallback price options (no eligibility data) */}
              {!resolvedPriceOptions && hasPriceOptions && !hasSinglePriceOption && (
                <div ref={priceOptionRef}>
                  <Label className="font-body text-sm font-semibold mb-2 block">Scegli la formula *</Label>
                  <RadioGroup value={selectedPriceOption} onValueChange={setSelectedPriceOption} className={`space-y-2 rounded-xl ${attemptedSubmit && priceOptionRequired ? "ring-2 ring-destructive ring-offset-2 ring-offset-background" : ""}`}>
                    {event.price_options.map((opt: any) => {
                      const bookable = isOptionBookable(opt, event);
                      const canWaitlist = !bookable && canOptionJoinWaitlist(opt, event);
                      const disabled = !bookable && !canWaitlist;
                      const selected = selectedPriceOption === opt.id;
                      const hasPromo = shouldShowPromoBadge(opt);
                      const selectedClass = hasPromo
                        ? "bg-warning/5 border-warning shadow-sm cursor-pointer"
                        : "bg-primary/5 border-primary/30 shadow-sm cursor-pointer";
                      return (
                        <label key={opt.id} className={`flex items-start justify-between gap-3 p-3 rounded-xl transition-all border ${
                          disabled ? "bg-muted/30 opacity-60 cursor-not-allowed border-transparent" :
                          selected ? selectedClass : "bg-muted/40 border-transparent hover:bg-muted/60 cursor-pointer"
                        }`}>
                          <div className="flex items-start gap-3 min-w-0">
                            <RadioGroupItem value={opt.id} disabled={disabled} className={`mt-1 ${hasPromo ? "border-warning text-warning" : ""}`} />
                            <div className="min-w-0">
                              {hasPromo && (
                                <PromoOptionLabel endsAt={opt.promo_end} now={promoNow} />
                              )}
                              <span className="text-sm font-body font-semibold text-foreground">{opt.name}</span>
                              <p className="text-[10px] text-muted-foreground font-body mt-0.5">
                                {getCheckoutDetailLine(opt)}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm font-display font-bold ${hasPromo ? "text-warning" : "text-foreground"} shrink-0`}>{getCheckoutAmountLabel(opt)}</span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                  {attemptedSubmit && priceOptionRequired && (
                    <p className="mt-2 text-xs font-body font-semibold text-destructive">Scegli una formula di partecipazione.</p>
                  )}
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

              {needsMembership && !selectedOptionIsWaitlist && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <p className="text-sm font-body font-bold text-primary">Tessera associativa ASD Gruppo Scampagnate</p>
                  </div>
                  <p className="text-xs font-body text-muted-foreground leading-relaxed">
                    Per partecipare a questo evento è richiesta la tessera associativa ASD Gruppo Scampagnate.
                    La tessera è valida per l'anno in corso e include copertura assicurativa base durante le attività.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-body font-bold text-foreground">€{membershipFeeAmount} / anno</span>
                  </div>
                  <p className="text-[10px] font-body text-muted-foreground">
                    La tessera verrà attivata automaticamente con questo pagamento.
                  </p>
                </div>
              )}

              {/* Discount code */}
              {isPaymentEvent && user && !selectedOptionIsWaitlist && (
                <div>
                  <p className="text-sm font-body text-muted-foreground mb-2">Hai un codice sconto?</p>
                  <DiscountCodeInput
                    eventId={event.id}
                    userId={user.id}
                    onDiscountApplied={setAppliedDiscount}
                  />
                </div>
              )}

              {selectedPaymentType === "deposit" && !selectedOptionIsWaitlist && (
                <div>
                  <Label className="font-body text-sm font-semibold mb-2 block">Come vuoi pagare?</Label>
                  <RadioGroup value={effectivePaymentChoice} onValueChange={(value) => setPaymentChoice(value as "deposit" | "full")} className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                      effectivePaymentChoice === "deposit" ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-muted/40 border-transparent hover:bg-muted/60"
                    }`}>
                      <RadioGroupItem value="deposit" />
                      <div>
                        <p className="text-sm font-body font-semibold text-foreground">Paga acconto</p>
                        <p className="text-xs font-body text-muted-foreground">
                          Oggi paghi €{depositAmount.toFixed(2)}.
                          {remainingAmount > 0 && ` Restano €${remainingAmount.toFixed(2)}.`}
                        </p>
                      </div>
                    </label>
                    {canPayFullAmount && (
                      <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        effectivePaymentChoice === "full" ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-muted/40 border-transparent hover:bg-muted/60"
                      }`}>
                        <RadioGroupItem value="full" />
                        <div>
                          <p className="text-sm font-body font-semibold text-foreground">Paga tutto subito</p>
                          <p className="text-xs font-body text-muted-foreground">
                            Completi online l'intero importo in un solo checkout.
                          </p>
                        </div>
                      </label>
                    )}
                  </RadioGroup>
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
            {((!selectedOptionIsWaitlist && (isPaymentEvent || selectedPaymentType === "location")) || (needsMembership && !selectedOptionIsWaitlist)) && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-2">
                {/* Da pagare oggi */}
                <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-1">Da pagare oggi</p>

                {!selectedOptionIsWaitlist && (isPaymentEvent || selectedPaymentType === "location") && displayPrice > 0 && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">
                      {selectedPaymentType === "deposit" && isDepositPayment ? "Acconto evento" : "Evento"}
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

                {!selectedOptionIsWaitlist && selectedPaymentType === "location" && displayPrice > 0 && (
                  <p className="text-xs font-body text-muted-foreground italic">Da saldare in loco</p>
                )}

                {serviceFee > 0 && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">Costo del servizio</span>
                    <span className="font-semibold text-foreground">€{serviceFee.toFixed(2)}</span>
                  </div>
                )}

                {needsMembership && !selectedOptionIsWaitlist && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Quota associativa
                    </span>
                    <span className="font-semibold text-primary">€{membershipFee.toFixed(2)}</span>
                  </div>
                )}

                {((!selectedOptionIsWaitlist && isPaymentEvent) || (needsMembership && !selectedOptionIsWaitlist)) && (
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
            {selectedOptionIsWaitlist ? (
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20">
                <p className="text-sm font-body font-semibold text-amber-700 dark:text-amber-400">Lista d'attesa - nessun pagamento ora</p>
              </div>
            ) : selectedPaymentType === "free" ? (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2">
                <p className="text-sm font-body font-semibold text-foreground">Regole e info</p>
                <div className="space-y-1 text-xs font-body text-muted-foreground">
                  <p>Puoi disdire in qualsiasi momento direttamente dall'app</p>
                  <p>Se non puoi più venire, libera il posto il prima possibile</p>
                  <p>I posti liberati vengono assegnati alla lista d'attesa</p>
                  <p>Chi non si presenta senza disdire potrà avere limitazioni sugli eventi futuri</p>
                  <p>Qui si viene per stare bene: rispetto per il gruppo prima di tutto</p>
                </div>
              </div>
            ) : cancellationDetails && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                <div className="flex items-center gap-2">
                  <cancellationDetails.icon className={`h-4 w-4 shrink-0 ${cancellationDetails.colorClass}`} />
                  <p className="text-sm font-body font-semibold text-foreground">Politica di cancellazione</p>
                </div>
                <div className="pl-6 space-y-0.5">
                  <p className="text-sm font-body font-semibold text-foreground">{cancellationDetails.labelIt}</p>
                  <p className="text-xs font-body text-muted-foreground">
                    {cancellationDetails.checkoutDescriptionIt}
                  </p>
                </div>
              </div>
            )}

            {/* Free event notice */}
            {selectedPaymentType === "free" && !needsMembership && !selectedOptionIsWaitlist && (
              <div className="p-3 rounded-xl bg-green-50/60 dark:bg-green-950/10 border border-green-200/40 dark:border-green-800/20">
                <p className="text-sm font-body font-semibold text-green-700 dark:text-green-400">Evento gratuito — nessun pagamento richiesto</p>
              </div>
            )}

            {selectedPaymentType === "free" && needsMembership && !selectedOptionIsWaitlist && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-2">
                <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-1">Da pagare oggi</p>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-primary font-semibold flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Quota associativa
                  </span>
                  <span className="font-semibold text-primary">€{membershipFeeAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-body pt-2 mt-1 border-t border-border">
                  <span className="font-bold text-foreground">Totale da pagare oggi</span>
                  <span className="font-bold text-foreground text-base">€{membershipFeeAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Helper text above CTA */}
            <p className="text-xs font-body text-muted-foreground text-center leading-relaxed px-2">
              {showValidation ? "Completa i campi evidenziati per continuare." : ctaHelperText}
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
                  {(isPaymentEvent || (needsMembership && !selectedOptionIsWaitlist)) && <CreditCard className="h-4 w-4 mr-2" />}
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
