import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "./Header";
import BottomNav from "./BottomNav";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user && profile) {
      // If missing onboarding fields, force redirect to profile setup
      const needsOnboarding = !profile.phone || !profile.trekking_experience || !profile.activity_frequency;
      if (needsOnboarding && location.pathname !== "/profile-setup") {
        navigate("/profile-setup", { replace: true });
      }
    }
  }, [user, profile, loading, navigate, location.pathname]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      <Header />
      <main className="max-w-lg mx-auto pb-24">{children}</main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
