// Shared cancellation policy definitions
import { CheckCircle2, Clock, CircleMinus, type LucideIcon } from "lucide-react";

export type PolicyType = "flexible" | "moderate" | "non_refundable";

export interface PolicyDefinition {
  type: PolicyType;
  label: string;
  labelIt: string;
  icon: LucideIcon;
  description: string;
  descriptionIt: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export const CANCELLATION_POLICIES: Record<PolicyType, PolicyDefinition> = {
  flexible: {
    type: "flexible",
    label: "Flexible",
    labelIt: "Flessibile",
    icon: CheckCircle2,
    description: "Full refund up to 24 hours before the event.",
    descriptionIt: "Rimborso completo fino a 24 ore prima dell'evento.",
    colorClass: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/30",
    borderClass: "border-green-200 dark:border-green-800",
  },
  moderate: {
    type: "moderate",
    label: "Moderate",
    labelIt: "Moderata",
    icon: Clock,
    description: "Full refund up to 48 hours before the event.",
    descriptionIt: "Rimborso completo fino a 48 ore prima dell'evento.",
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
    descriptionIt: "Nessun rimborso in caso di cancellazione.",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
    borderClass: "border-border",
  },
};

// Parse a stored cancellation_policy string
export const parseCancellationPolicy = (raw: string | null | undefined): {
  policyType: PolicyType | null;
  customText: string;
} => {
  if (!raw) return { policyType: null, customText: "" };

  // Handle legacy "strict" mapping
  if (raw === "strict") return { policyType: "non_refundable", customText: "" };

  // Check if it's a prefixed format: "type:text"
  const colonIdx = raw.indexOf(":");
  if (colonIdx !== -1) {
    const prefix = raw.slice(0, colonIdx) as PolicyType;
    if (CANCELLATION_POLICIES[prefix]) {
      return { policyType: prefix, customText: raw.slice(colonIdx + 1) };
    }
    // Legacy custom format
    if (prefix === ("custom" as string)) {
      return { policyType: "non_refundable", customText: raw.slice(colonIdx + 1) };
    }
  }

  // Check if it's a plain policy key
  if (CANCELLATION_POLICIES[raw as PolicyType]) {
    return { policyType: raw as PolicyType, customText: "" };
  }

  // Legacy fallback
  return { policyType: "flexible", customText: "" };
};

// Serialize to storage format
export const serializeCancellationPolicy = (
  type: PolicyType,
  _customText: string
): string => {
  return type;
};

/**
 * Calculate refund eligibility for a given policy and event start time.
 * Used client-side to show appropriate UI messaging before calling the backend.
 */
export const getRefundInfo = (
  cancellationPolicy: string | null | undefined,
  eventDate: string,
  eventTime: string
): {
  policy: PolicyType;
  policyLabel: string;
  refundEligible: boolean;
  refundPercentage: number;
  hoursUntilEvent: number;
  requiredHours: number | null;
  message: string;
} => {
  const { policyType } = parseCancellationPolicy(cancellationPolicy);
  const policy = policyType || "flexible";

  const eventStart = new Date(`${eventDate}T${eventTime}`);
  const now = new Date();
  const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  const policyDef = CANCELLATION_POLICIES[policy];

  let requiredHours: number | null;
  switch (policy) {
    case "flexible":
      requiredHours = 24;
      break;
    case "moderate":
      requiredHours = 48;
      break;
    case "non_refundable":
      requiredHours = null;
      break;
    default:
      requiredHours = 24;
  }

  const refundEligible = requiredHours !== null && hoursUntilEvent >= requiredHours;
  const refundPercentage = refundEligible ? 100 : 0;

  let message: string;
  if (policy === "non_refundable") {
    message = "Secondo la policy dell'evento, non è previsto alcun rimborso.";
  } else if (refundEligible) {
    message = "Riceverai il rimborso nei prossimi giorni, secondo i tempi previsti dal tuo metodo di pagamento.";
  } else {
    message = `Il termine per il rimborso (${requiredHours}h prima dell'evento) è scaduto. Non è previsto alcun rimborso.`;
  }

  return {
    policy,
    policyLabel: policyDef.labelIt,
    refundEligible,
    refundPercentage,
    hoursUntilEvent,
    requiredHours,
    message,
  };
};

export const getCancellationDialogMessage = (
  refundInfo: ReturnType<typeof getRefundInfo> | null
): string | null => {
  if (!refundInfo) return null;

  if (refundInfo.policy === "flexible") {
    return "💰 Rimborso completo disponibile\nPuoi cancellare gratuitamente fino a 24 ore prima dell’evento";
  }

  if (refundInfo.policy === "moderate") {
    return "💰 Rimborso completo disponibile\nPuoi cancellare gratuitamente fino a 48 ore prima dell’evento";
  }

  return "⚠️ Questo evento non prevede rimborso in caso di cancellazione";
};
