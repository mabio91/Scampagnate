import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ConsentType = "terms" | "age" | "marketing" | "media";

export interface UserConsent {
  consent_type: ConsentType;
  granted: boolean;
  version: string | null;
  granted_at: string | null;
  updated_at: string | null;
}

const CURRENT_VERSION = "2026-04-01";

export const useUserConsents = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["user-consents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_consents")
        .select("consent_type, granted, version, granted_at, updated_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as UserConsent[];
    },
    enabled: !!user,
  });

  const getConsent = (type: ConsentType): boolean => {
    return query.data?.find((c) => c.consent_type === type)?.granted ?? false;
  };

  return { ...query, getConsent };
};

export const useToggleConsent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ type, granted }: { type: ConsentType; granted: boolean }) => {
      if (!user) throw new Error("Non autenticato");

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("user_consents")
        .upsert(
          {
            user_id: user.id,
            consent_type: type,
            granted,
            version: CURRENT_VERSION,
            granted_at: granted ? now : null,
            revoked_at: granted ? null : now,
            updated_at: now,
          },
          { onConflict: "user_id,consent_type" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-consents", user?.id] });
    },
  });
};

/** Save all 4 consents at registration time */
export const saveRegistrationConsents = async (
  userId: string,
  consents: { terms: boolean; age: boolean; marketing: boolean; media: boolean }
) => {
  const now = new Date().toISOString();
  const rows = (Object.entries(consents) as [ConsentType, boolean][]).map(([type, granted]) => ({
    user_id: userId,
    consent_type: type,
    granted,
    version: CURRENT_VERSION,
    granted_at: granted ? now : null,
    revoked_at: granted ? null : now,
    updated_at: now,
  }));

  const { error } = await supabase.from("user_consents").upsert(rows, { onConflict: "user_id,consent_type" });
  if (error) throw error;
};
