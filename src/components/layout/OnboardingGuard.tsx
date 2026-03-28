import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const OnboardingGuard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user && profile) {
      const oldOnboardingDone = !!profile.phone && !!profile.trekking_experience && !!profile.activity_frequency;
      const needsOnboarding = !profile.onboarding_completed && !oldOnboardingDone;
      if (needsOnboarding && location.pathname !== "/profile-setup") {
        navigate("/profile-setup", { replace: true });
      }
    }
  }, [user, profile, loading, navigate, location.pathname]);

  return null;
};

export default OnboardingGuard;
