// Shared cancellation policy definitions
import { CheckCircle2, Clock, ShieldX, FileEdit, type LucideIcon } from "lucide-react";

export type PolicyType = "flexible" | "moderate" | "strict" | "custom";

export interface PolicyDefinition {
  type: PolicyType;
  label: string;
  icon: LucideIcon;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export const CANCELLATION_POLICIES: Record<PolicyType, PolicyDefinition> = {
  flexible: {
    type: "flexible",
    label: "Flexible",
    icon: CheckCircle2,
    description: "Full refund up to 24 hours before the event. No refund within 24 hours.",
    colorClass: "text-success",
    bgClass: "bg-success/10",
    borderClass: "border-success/20",
  },
  moderate: {
    type: "moderate",
    label: "Moderate",
    icon: Clock,
    description: "Full refund up to 48 hours before the event. No refund within 48 hours.",
    colorClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/20",
  },
  strict: {
    type: "strict",
    label: "Strict",
    icon: ShieldX,
    description: "Non-refundable. No refund will be issued for any cancellation.",
    colorClass: "text-destructive",
    bgClass: "bg-destructive/10",
    borderClass: "border-destructive/20",
  },
  custom: {
    type: "custom",
    label: "Custom",
    icon: FileEdit,
    description: "Organizer-defined policy — see details below.",
    colorClass: "text-secondary",
    bgClass: "bg-secondary/10",
    borderClass: "border-secondary/20",
  },
};

// Parse a stored cancellation_policy string
// Format: "type:custom_text" or just a plain type key like "flexible"
export const parseCancellationPolicy = (raw: string | null | undefined): {
  policyType: PolicyType | null;
  customText: string;
} => {
  if (!raw) return { policyType: null, customText: "" };

  // Check if it's a prefixed format: "type:text"
  const colonIdx = raw.indexOf(":");
  if (colonIdx !== -1) {
    const prefix = raw.slice(0, colonIdx) as PolicyType;
    if (CANCELLATION_POLICIES[prefix]) {
      return { policyType: prefix, customText: raw.slice(colonIdx + 1) };
    }
  }

  // Check if it's a plain policy key (e.g., "flexible")
  if (CANCELLATION_POLICIES[raw as PolicyType]) {
    return { policyType: raw as PolicyType, customText: "" };
  }

  // Legacy: plain text, treat as custom
  return { policyType: "custom", customText: raw };
};

// Serialize to storage format
export const serializeCancellationPolicy = (
  type: PolicyType,
  customText: string
): string => {
  if (type === "custom") return `custom:${customText}`;
  return type;
};
