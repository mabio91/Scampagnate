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
    colorClass: "text-green-600",
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
  },
  moderate: {
    type: "moderate",
    label: "Moderate",
    labelIt: "Moderata",
    icon: Clock,
    description: "Full refund up to 48 hours before the event.",
    descriptionIt: "Rimborso completo fino a 48 ore prima dell'evento.",
    colorClass: "text-amber-600",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
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
