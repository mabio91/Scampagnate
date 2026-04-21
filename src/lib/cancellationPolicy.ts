import { CheckCircle2, Clock3, CircleMinus, type LucideIcon } from "lucide-react";

export const NON_REFUNDABLE_SERVICE_FEE_EUR = 1;

export type PolicyType = "flexible_24h" | "flexible_48h" | "non_refundable";

export interface PolicyDefinition {
  type: PolicyType;
  label: string;
  labelIt: string;
  icon: LucideIcon;
  description: string;
  descriptionIt: string;
  checkoutDescriptionIt: string;
  shortInfoLabelIt: string | null;
  requiredHours: number | null;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export const CANCELLATION_POLICIES: Record<PolicyType, PolicyDefinition> = {
  flexible_24h: {
    type: "flexible_24h",
    label: "Flexible 24h",
    labelIt: "Flessibile 24h",
    icon: CheckCircle2,
    description: "Full refund up to 24 hours before the event, excluding the €1 service fee.",
    descriptionIt: "Rimborso completo fino a 24 ore prima dell'evento, escluso il costo del servizio di 1€.",
    checkoutDescriptionIt: "Rimborso completo fino a 24 ore prima dell'evento (escluso il costo del servizio di 1€)",
    shortInfoLabelIt: "Rimborso disponibile fino a 24h prima ->",
    requiredHours: 24,
    colorClass: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/30",
    borderClass: "border-green-200 dark:border-green-800",
  },
  flexible_48h: {
    type: "flexible_48h",
    label: "Flexible 48h",
    labelIt: "Flessibile 48h",
    icon: Clock3,
    description: "Full refund up to 48 hours before the event, excluding the €1 service fee.",
    descriptionIt: "Rimborso completo fino a 48 ore prima dell'evento, escluso il costo del servizio di 1€.",
    checkoutDescriptionIt: "Rimborso completo fino a 48 ore prima dell'evento (escluso il costo del servizio di 1€)",
    shortInfoLabelIt: "Rimborso disponibile fino a 48h prima ->",
    requiredHours: 48,
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  non_refundable: {
    type: "non_refundable",
    label: "Non-refundable",
    labelIt: "Non rimborsabile",
    icon: CircleMinus,
    description: "No refund for cancellation.",
    descriptionIt: "Questo evento non prevede rimborso in caso di cancellazione.",
    checkoutDescriptionIt: "Questo evento non prevede rimborso in caso di cancellazione",
    shortInfoLabelIt: null,
    requiredHours: null,
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
    borderClass: "border-border",
  },
};

const LEGACY_POLICY_MAP: Record<string, PolicyType> = {
  flexible: "flexible_24h",
  flessibile: "flexible_24h",
  moderate: "flexible_48h",
  moderata: "flexible_48h",
  strict: "non_refundable",
  rigida: "non_refundable",
  non_refundable: "non_refundable",
};

export const parseCancellationPolicy = (
  raw: string | null | undefined
): {
  policyType: PolicyType | null;
  customText: string;
} => {
  if (!raw) return { policyType: null, customText: "" };

  const normalizedRaw = raw.trim().toLowerCase();

  if (LEGACY_POLICY_MAP[normalizedRaw]) {
    return { policyType: LEGACY_POLICY_MAP[normalizedRaw], customText: "" };
  }

  const colonIdx = normalizedRaw.indexOf(":");
  if (colonIdx !== -1) {
    const prefix = normalizedRaw.slice(0, colonIdx);
    if (LEGACY_POLICY_MAP[prefix]) {
      return {
        policyType: LEGACY_POLICY_MAP[prefix],
        customText: raw.slice(colonIdx + 1),
      };
    }

    if (prefix === "custom") {
      return { policyType: "non_refundable", customText: raw.slice(colonIdx + 1) };
    }
  }

  if (CANCELLATION_POLICIES[normalizedRaw as PolicyType]) {
    return { policyType: normalizedRaw as PolicyType, customText: "" };
  }

  return { policyType: "flexible_24h", customText: "" };
};

export const serializeCancellationPolicy = (
  type: PolicyType,
  _customText: string
): string => type;

export const getPolicyDefinition = (cancellationPolicy: string | null | undefined) => {
  const { policyType } = parseCancellationPolicy(cancellationPolicy);
  const resolvedType = policyType || "flexible_24h";
  return CANCELLATION_POLICIES[resolvedType];
};

export const getServiceFeeAmount = (paymentType?: string | null) => {
  return paymentType === "paid" || paymentType === "deposit"
    ? NON_REFUNDABLE_SERVICE_FEE_EUR
    : 0;
};

export const calculateRefundAmount = ({
  amountPaid,
  serviceFeeAmount,
  isOrganizerCancellation,
  refundEligible,
}: {
  amountPaid: number;
  serviceFeeAmount: number;
  isOrganizerCancellation?: boolean;
  refundEligible: boolean;
}) => {
  if (isOrganizerCancellation) {
    return Math.max(0, amountPaid);
  }

  if (!refundEligible) {
    return 0;
  }

  return Math.max(0, amountPaid - serviceFeeAmount);
};

export const getRefundInfo = (
  cancellationPolicy: string | null | undefined,
  eventDate: string,
  eventTime: string,
  amountPaid = 0,
  serviceFeeAmount = NON_REFUNDABLE_SERVICE_FEE_EUR
): {
  policy: PolicyType;
  policyLabel: string;
  refundEligible: boolean;
  refundPercentage: number;
  refundAmount: number;
  hoursUntilEvent: number;
  requiredHours: number | null;
  message: string;
} => {
  const policyDef = getPolicyDefinition(cancellationPolicy);
  const eventStart = new Date(`${eventDate}T${eventTime}`);
  const now = new Date();
  const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  const requiredHours = policyDef.requiredHours;
  const refundEligible = requiredHours !== null && hoursUntilEvent >= requiredHours;
  const refundPercentage = refundEligible ? 100 : 0;
  const refundAmount = calculateRefundAmount({
    amountPaid,
    serviceFeeAmount,
    refundEligible,
  });

  let message: string;
  if (policyDef.type === "non_refundable") {
    message = "Secondo la policy di questo evento non è previsto alcun rimborso.";
  } else if (refundEligible) {
    message = "Riceverai il rimborso dell'importo versato, escluso il costo del servizio di 1€.";
  } else {
    message = "Secondo la policy di questo evento non è previsto alcun rimborso.";
  }

  return {
    policy: policyDef.type,
    policyLabel: policyDef.labelIt,
    refundEligible,
    refundPercentage,
    refundAmount,
    hoursUntilEvent,
    requiredHours,
    message,
  };
};

export const getCancellationDialogMessage = (
  refundInfo: ReturnType<typeof getRefundInfo> | null
): string | null => {
  if (!refundInfo) return null;

  if (refundInfo.refundEligible) {
    return "Riceverai il rimborso dell'importo versato, escluso il costo del servizio di 1€.";
  }

  return "Secondo la policy di questo evento non è previsto alcun rimborso.";
};
