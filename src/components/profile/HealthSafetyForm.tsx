import { AlertTriangle, Check, Info, Pill, ShieldCheck } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EmergencyMedicationAnswer, HealthSafetyErrors, HealthSafetyStatus, HealthSafetyValue } from "@/lib/healthSafety";

interface HealthSafetyFormProps {
  value: HealthSafetyValue;
  onChange: (value: HealthSafetyValue) => void;
  errors?: HealthSafetyErrors;
}

const statusOptions: Array<{ value: HealthSafetyStatus; title: string; description: string }> = [
  {
    value: "none",
    title: "No, nessuna da segnalare",
    description: "Non ci sono informazioni utili da condividere con lo staff.",
  },
  {
    value: "has_info",
    title: "Sì, ho qualcosa da segnalare",
    description: "Condividi solo ciò che può essere utile in caso di necessità.",
  },
];

const medicationOptions: Array<{ value: EmergencyMedicationAnswer; title: string }> = [
  { value: "no", title: "No" },
  { value: "yes", title: "Sì" },
];

const HealthSafetyForm = ({ value, onChange, errors = {} }: HealthSafetyFormProps) => {
  const update = (patch: Partial<HealthSafetyValue>) => onChange({ ...value, ...patch });

  const selectStatus = (status: HealthSafetyStatus) => {
    update(
      status === "none"
        ? {
          status,
          notes: "",
          emergencyMedicationHas: "",
          emergencyMedicationNotes: "",
          helpNotes: "",
        }
        : { status }
    );
  };

  const selectMedication = (answer: EmergencyMedicationAnswer) => {
    update({
      emergencyMedicationHas: answer,
      emergencyMedicationNotes: answer === "yes" ? value.emergencyMedicationNotes : "",
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground font-body">
            Queste informazioni sono visibili solo allo staff autorizzato e agli organizzatori degli eventi a cui partecipi. Non vengono usate per fit score, suggerimenti o blocchi.
          </p>
        </div>
      </div>

      <div className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${errors.status ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
        <Label className={`font-body text-sm font-semibold ${errors.status ? "text-destructive" : ""}`}>
          Hai condizioni di salute, allergie o esigenze particolari che dovremmo conoscere? <span className="text-destructive">*</span>
        </Label>
        <div className="space-y-2">
          {statusOptions.map((option) => {
            const selected = value.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => selectStatus(option.value)}
                className={`relative flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-primary">
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {value.status === "has_info" && (
        <div className="space-y-5">
          <div className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${errors.notes ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
            <Label className={`font-body text-sm font-semibold ${errors.notes ? "text-destructive" : ""}`}>
              Dicci solo ciò che può essere utile sapere in caso di necessità. <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={value.notes}
              onChange={(event) => update({ notes: event.target.value })}
              rows={3}
              placeholder="Es. asma, allergie importanti, problemi cardiaci, farmaci salvavita, epipen, altre informazioni utili."
            />
          </div>

          <div className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${errors.emergencyMedicationHas ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
            <Label className={`font-body text-sm font-semibold ${errors.emergencyMedicationHas ? "text-destructive" : ""}`}>
              Hai con te farmaci o dispositivi da usare in caso di emergenza? <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {medicationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectMedication(option.value)}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${
                    value.emergencyMedicationHas === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/30"
                  }`}
                >
                  {option.value === "yes" ? <Pill className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  {option.title}
                </button>
              ))}
            </div>
          </div>

          {value.emergencyMedicationHas === "yes" && (
            <div className={`space-y-2 rounded-xl p-3 -mx-3 transition-all ${errors.emergencyMedicationNotes ? "bg-destructive/5 ring-2 ring-destructive/30" : ""}`}>
              <Label className={`font-body text-sm font-semibold ${errors.emergencyMedicationNotes ? "text-destructive" : ""}`}>
                Quali? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={value.emergencyMedicationNotes}
                onChange={(event) => update({ emergencyMedicationNotes: event.target.value })}
                rows={2}
                placeholder="Es. epipen, inalatore, farmaci specifici, altro."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-body text-sm font-semibold">In caso di necessità, cosa può essere utile fare o evitare?</Label>
            <Textarea
              value={value.helpNotes}
              onChange={(event) => update({ helpNotes: event.target.value })}
              rows={3}
              placeholder="Es. chiamare subito un contatto, evitare certi cibi o sforzi, sapere dove tengo il dispositivo."
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs leading-relaxed text-muted-foreground font-body">
              Inserisci solo informazioni utili alla gestione dell'attività. Puoi modificarle o cancellarle in qualsiasi momento dal profilo.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground font-body">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>I consensi privacy già presenti coprono il trattamento dei dati di profilo; questa sezione li rende più chiari e aggiornabili.</p>
      </div>
    </div>
  );
};

export default HealthSafetyForm;
