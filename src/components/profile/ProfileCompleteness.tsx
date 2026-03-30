import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { UserCheck, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileField {
  label: string;
  completed: boolean;
  group: "profile" | "preferences";
}

interface ProfileCompletenessProps {
  onCompleteProfile?: () => void;
}

const ProfileCompleteness = ({ onCompleteProfile }: ProfileCompletenessProps) => {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const pointsAwardedRef = useRef(false);

  const fields: ProfileField[] = profile ? [
    { label: "Nome e cognome", completed: !!(profile.first_name && profile.last_name), group: "profile" },
    { label: "Telefono", completed: !!profile.phone, group: "profile" },
    { label: "Foto profilo", completed: !!profile.avatar_url, group: "profile" },
    { label: "Bio", completed: !!profile.bio, group: "profile" },
    { label: "Livello esperienza", completed: !!profile.self_level, group: "preferences" },
    { label: "Esperienza trekking", completed: !!profile.trekking_experience, group: "preferences" },
    { label: "Frequenza attività", completed: !!profile.activity_frequency, group: "preferences" },
    { label: "Interessi", completed: !!(profile.interests && profile.interests.length > 0), group: "preferences" },
    { label: "Automunito", completed: !!profile.has_car, group: "preferences" },
  ] : [];

  const completedCount = fields.filter(f => f.completed).length;
  const percentage = fields.length > 0 ? Math.round((completedCount / fields.length) * 100) : 0;

  // Award points when profile reaches 100% — only once ever
  useEffect(() => {
    if (percentage !== 100 || !user || pointsAwardedRef.current) return;
    pointsAwardedRef.current = true;

    let cancelled = false;
    const awardPoints = async () => {
      try {
        // Check if already awarded in DB (single source of truth)
        const { data: existing } = await supabase
          .from("points_history")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "profile_complete")
          .maybeSingle();

        if (existing || cancelled) return;

        await supabase.rpc("add_user_points", {
          p_user_id: user.id,
          p_value: 10,
          p_type: "profile_complete",
          p_description: "Profilo completato al 100%",
        });

        if (!cancelled) {
          toast({ title: "Profilo completato! +10 punti 🎉" });
        }
      } catch (e) {
        // Silent fail - points not critical
      }
    };
    awardPoints();
    return () => { cancelled = true; };
  }, [percentage, user]);

  if (!profile) return null;
  // Don't show if fully complete
  if (percentage === 100) return null;

  const missingProfile = fields.filter(f => !f.completed && f.group === "profile");
  const missingPreferences = fields.filter(f => !f.completed && f.group === "preferences");
  const completedFields = fields.filter(f => f.completed);

  const handleClick = () => {
    if (onCompleteProfile) {
      onCompleteProfile();
    }
  };

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

        {/* Missing fields grouped */}
        <div className="space-y-2.5 mb-3">
          {missingProfile.length > 0 && (
            <div>
              <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-wider mb-1">Profilo</p>
              <div className="space-y-1">
                {missingProfile.map((field) => (
                  <div key={field.label} className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-destructive/70 flex-shrink-0" />
                    <span className="text-xs font-body text-muted-foreground">{field.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {missingPreferences.length > 0 && (
            <div>
              <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-wider mb-1">Preferenze</p>
              <div className="space-y-1">
                {missingPreferences.map((field) => (
                  <div key={field.label} className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-destructive/70 flex-shrink-0" />
                    <span className="text-xs font-body text-muted-foreground">{field.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show some completed fields */}
          {completedFields.slice(0, 3).map((field) => (
            <div key={field.label} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
              <span className="text-xs font-body text-foreground">{field.label}</span>
            </div>
          ))}
        </div>

        {/* CTA: Opens profile edit (not onboarding) */}
        {missingProfile.length > 0 ? (
          <Button
            onClick={handleClick}
            size="sm"
            className="w-full bg-primary text-primary-foreground font-body font-semibold"
          >
            Completa profilo
          </Button>
        ) : missingPreferences.length > 0 ? (
          <Button
            onClick={handleClick}
            size="sm"
            variant="outline"
            className="w-full font-body font-semibold"
          >
            Completa preferenze
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default ProfileCompleteness;
