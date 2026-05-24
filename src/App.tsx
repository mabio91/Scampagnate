import { lazy, Suspense, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RestrictionBanner } from "@/components/RestrictionBanner";
import PageTransition from "@/components/PageTransition";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import OnboardingGuard from "@/components/layout/OnboardingGuard";
import Index from "./pages/Index";

// Lazy-loaded routes for code splitting
const EventDetail = lazy(() => import("./pages/EventDetail"));
const MyEvents = lazy(() => import("./pages/MyEvents"));
const Merch = lazy(() => import("./pages/Merch"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OrganizerDashboard = lazy(() => import("./pages/OrganizerDashboard"));
const EventForm = lazy(() => import("./pages/EventForm"));
const EventManage = lazy(() => import("./pages/EventManage"));
const Notifications = lazy(() => import("./pages/Notifications"));
const EventCalendar = lazy(() => import("./pages/EventCalendar"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const OrganizerProfile = lazy(() => import("@/pages/OrganizerProfile"));
const MembershipSuccess = lazy(() => import("./pages/MembershipSuccess"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const EventParticipants = lazy(() => import("./pages/EventParticipants"));
const EventStaff = lazy(() => import("./pages/EventStaff"));
const ContentPage = lazy(() => import("./pages/ContentPage"));
const Rewards = lazy(() => import("./pages/Rewards"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Routes that should NOT show header/bottom nav
const FULL_SCREEN_ROUTES = ["/auth", "/reset-password", "/profile-setup", "/membership-success", "/payment-success"];

const isFullScreenRoute = (pathname: string) => {
  if (FULL_SCREEN_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/event/")) return true;
  return false;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const fullScreen = useMemo(() => isFullScreenRoute(location.pathname), [location.pathname]);

  return (
    <>
      <OnboardingGuard />
      {!fullScreen && (
        <div className="min-h-screen min-h-[100dvh] bg-background">
          <Header />
          <main className="max-w-lg mx-auto pb-24">
            <AnimatePresence mode="wait" initial={false}>
              <PageTransition key={location.pathname}>
                <Routes location={location}>
                  <Route path="/" element={<Index />} />
                  <Route path="/my-events" element={<MyEvents />} />
                  <Route path="/shop" element={<Merch />} />
                  <Route path="/shop/:id" element={<ProductDetail />} />
                  <Route path="/merch" element={<Merch />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/calendar" element={<EventCalendar />} />
                  <Route path="/organizer" element={<OrganizerDashboard />} />
                  <Route path="/organizer/:id" element={<OrganizerProfile />} />
                  <Route path="/organizer/events/new" element={<EventForm />} />
                  <Route path="/organizer/events/:id" element={<EventManage />} />
                  <Route path="/organizer/events/:id/edit" element={<EventForm />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/delete-account" element={<DeleteAccount />} />
                  <Route path="/page/:slug" element={<ContentPage />} />
                  <Route path="/guida-difficolta-trekking" element={<ContentPage />} />
                  <Route path="/rewards" element={<Rewards />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PageTransition>
            </AnimatePresence>
          </main>
          <BottomNav />
        </div>
      )}
      {fullScreen && (
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/event/:id" element={<EventDetail />} />
              <Route path="/event/:id/staff" element={<EventStaff />} />
              <Route path="/event/:id/participants" element={<EventParticipants />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/profile-setup" element={<ProfileSetup />} />
              <Route path="/membership-success" element={<MembershipSuccess />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      )}
    </>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
        <SearchProvider>
        <TooltipProvider>
          <Toaster />
          <Analytics />
          <RestrictionBanner />
          <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <Suspense fallback={<PageFallback />}>
              <AnimatedRoutes />
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </SearchProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
