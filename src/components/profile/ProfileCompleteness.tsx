import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { UserCheck, CheckCircle2, XCircle } from "lucide-react";

interface ProfileField {
  label: string;
  completed: boolean;
}

const ProfileCompleteness = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;

  const fields: ProfileField[] = [
    { label: "Nome e cognome", completed: !!(profile.first_name && profile.last_name) },
    { label: "Telefono", completed: !!profile.phone },
    { label: "Foto profilo", completed: !!profile.avatar_url },
    { label: "Bio", completed: !!profile.bio },
    { label: "Livello esperienza", completed: !!profile.self_level },
    { label: "Esperienza trekking", completed: !!profile.trekking_experience },
    { label: "Frequenza attività", completed: !!profile.activity_frequency },
    { label: "Interessi", completed: !!(profile.interests && profile.interests.length > 0) },
    { label: "Automunito", completed: !!profile.has_car },
  ];

  const completedCount = fields.filter(f => f.completed).length;
  const percentage = Math.round((completedCount / fields.length) * 100);

  // Don't show if fully complete
  if (percentage === 100) return null;

  const missingFields = fields.filter(f => !f.completed);

  return (
    <div className="mb-6">
      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-display font-bold text-foreground">Completa il tuo profilo</h3>
          <span className="ml-auto text-sm font-display font-bold text-primary">{percentage}%</span>
        </div>

        <Progress value={percentage} className="h-2 mb-3" />

        <p className="text-xs font-body text-muted-foreground mb-3">
          Completa il profilo per migliorare i suggerimenti e accedere a tutti gli eventi
        </p>

        {/* Show missing + completed fields */}
        <div className="space-y-1.5 mb-3">
          {missingFields.slice(0, 4).map((field) => (
            <div key={field.label} className="flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 text-destructive/70 flex-shrink-0" />
              <span className="text-xs font-body text-muted-foreground">{field.label}</span>
            </div>
          ))}
          {missingFields.length > 4 && (
            <p className="text-[10px] font-body text-muted-foreground ml-5">
              +{missingFields.length - 4} altri campi
            </p>
          )}
          {fields.filter(f => f.completed).slice(0, 3).map((field) => (
            <div key={field.label} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
              <span className="text-xs font-body text-foreground">{field.label}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={() => navigate("/profile-setup")}
          size="sm"
          className="w-full bg-primary text-primary-foreground font-body font-semibold"
        >
          Completa profilo
        </Button>
      </div>
    </div>
  );
};

export default ProfileCompleteness;
