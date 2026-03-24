import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string | null;
  bio: string | null;
  total_points: number;
  trekking_experience?: string;
  activity_frequency?: string;
  experience_grade?: number;
  membership_id?: number;
  membership_status?: string;
  membership_registration_date?: string;
  membership_year?: number;
  account_status?: 'Active' | 'Suspended' | 'Banned';
  self_level?: string;
  has_car?: string;
  interests?: string[];
  onboarding_completed?: boolean;
  event_motivation?: string;
  phone_verified?: boolean;
  phone_verified_at?: string;
  phone_verification_method?: string;
}

type AppRole = "admin" | "organizer" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isOrganizer: boolean;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, metadata: { first_name: string; last_name: string; phone: string }) => Promise<{ error: any; session: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  restrictionMessage: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [restrictionMessage, setRestrictionMessage] = useState<string | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    
    const profileData = profileRes.data;
    if (profileData && profileData.account_status && profileData.account_status !== 'Active') {
      const status = profileData.account_status;
      const message = status === 'Banned' 
        ? "Your account is permanently banned. Contact support."
        : "Your account is suspended. Contact support for help.";
      
      // Clear data and sign out
      setProfile(null);
      setRoles([]);
      setUser(null);
      setSession(null);
      setRestrictionMessage(message);
      await supabase.auth.signOut();
      return;
    }

    setRestrictionMessage(null);
    setProfile(profileData);
    setRoles((rolesRes.data || []).map((r) => r.role as AppRole));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, metadata: { first_name: string; last_name: string; phone: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });
    return { error, session: data?.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await fetchUserData(user.id);
  }, [user, fetchUserData]);

  const isOrganizer = roles.includes("organizer") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, isOrganizer, isAdmin, loading, signUp, signIn, signOut, refreshProfile, restrictionMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
