export type HealthSafetyStatus = "" | "none" | "has_info";
export type EmergencyMedicationAnswer = "" | "yes" | "no";

export interface HealthSafetyValue {
  status: HealthSafetyStatus;
  notes: string;
  emergencyMedicationHas: EmergencyMedicationAnswer;
  emergencyMedicationNotes: string;
  helpNotes: string;
}

export interface HealthSafetyErrors {
  status?: boolean;
  notes?: boolean;
  emergencyMedicationHas?: boolean;
  emergencyMedicationNotes?: boolean;
}

interface HealthSafetyProfile {
  health_safety_status?: string | null;
  health_safety_notes?: string | null;
  emergency_medication_has?: boolean | null;
  emergency_medication_notes?: string | null;
  health_safety_help_notes?: string | null;
}

export const emptyHealthSafetyValue: HealthSafetyValue = {
  status: "",
  notes: "",
  emergencyMedicationHas: "",
  emergencyMedicationNotes: "",
  helpNotes: "",
};

export const getHealthSafetyValueFromProfile = (profile?: HealthSafetyProfile | null): HealthSafetyValue => ({
  status: profile?.health_safety_status === "none" || profile?.health_safety_status === "has_info"
    ? profile.health_safety_status
    : "",
  notes: profile?.health_safety_notes || "",
  emergencyMedicationHas:
    profile?.emergency_medication_has === true
      ? "yes"
      : profile?.emergency_medication_has === false
        ? "no"
        : "",
  emergencyMedicationNotes: profile?.emergency_medication_notes || "",
  helpNotes: profile?.health_safety_help_notes || "",
});

export const hasCompletedHealthSafety = (profile?: HealthSafetyProfile | null) =>
  profile?.health_safety_status === "none" || profile?.health_safety_status === "has_info";

export const validateHealthSafety = (value: HealthSafetyValue) => {
  const errors: HealthSafetyErrors = {};

  if (!value.status) errors.status = true;

  if (value.status === "has_info") {
    if (!value.notes.trim()) errors.notes = true;
    if (!value.emergencyMedicationHas) errors.emergencyMedicationHas = true;
    if (value.emergencyMedicationHas === "yes" && !value.emergencyMedicationNotes.trim()) {
      errors.emergencyMedicationNotes = true;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const buildHealthSafetyPayload = (value: HealthSafetyValue) => {
  if (value.status === "none") {
    return {
      health_safety_status: "none",
      health_safety_notes: null,
      emergency_medication_has: null,
      emergency_medication_notes: null,
      health_safety_help_notes: null,
      health_safety_updated_at: new Date().toISOString(),
    };
  }

  return {
    health_safety_status: "has_info",
    health_safety_notes: value.notes.trim(),
    emergency_medication_has: value.emergencyMedicationHas === "yes",
    emergency_medication_notes:
      value.emergencyMedicationHas === "yes" ? value.emergencyMedicationNotes.trim() : null,
    health_safety_help_notes: value.helpNotes.trim() || null,
    health_safety_updated_at: new Date().toISOString(),
  };
};

export const formatHealthSafetyStatus = (status?: string | null) => {
  if (status === "none") return "Nessuna informazione da segnalare";
  if (status === "has_info") return "Ha informazioni da segnalare";
  return "Non ancora compilato";
};
