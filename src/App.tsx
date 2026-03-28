import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
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
import PersistentLayout from "@/components/layout/PersistentLayout";
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
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const OrganizerProfile = lazy(() => import("@/pages/OrganizerProfile"));
const MembershipSuccess = lazy(() => import("./pages/MembershipSuccess"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const EventParticipants = lazy(() => import("./pages/EventParticipants"));
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

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location.pathname}>
        <Routes location={location}>
          {/* Routes WITH persistent header & bottom nav */}
          <Route path="/" element={<PersistentLayout><Index /></PersistentLayout>} />
          <Route path="/my-events" element={<PersistentLayout><MyEvents /></PersistentLayout>} />
          <Route path="/shop" element={<PersistentLayout><Merch /></PersistentLayout>} />
          <Route path="/shop/:id" element={<PersistentLayout><ProductDetail /></PersistentLayout>} />
          <Route path="/merch" element={<PersistentLayout><Merch /></PersistentLayout>} />
          <Route path="/profile" element={<PersistentLayout><Profile /></PersistentLayout>} />
          <Route path="/notifications" element={<PersistentLayout><Notifications /></PersistentLayout>} />
          <Route path="/organizer" element={<PersistentLayout><OrganizerDashboard /></PersistentLayout>} />
          <Route path="/organizer/:id" element={<PersistentLayout><OrganizerProfile /></PersistentLayout>} />
          <Route path="/organizer/events/new" element={<PersistentLayout><EventForm /></PersistentLayout>} />
          <Route path="/organizer/events/:id" element={<PersistentLayout><EventManage /></PersistentLayout>} />
          <Route path="/organizer/events/:id/edit" element={<PersistentLayout><EventForm /></PersistentLayout>} />
          <Route path="/privacy" element={<PersistentLayout><Privacy /></PersistentLayout>} />
          <Route path="/terms" element={<PersistentLayout><Terms /></PersistentLayout>} />
          <Route path="/page/:slug" element={<PersistentLayout><ContentPage /></PersistentLayout>} />
          <Route path="/rewards" element={<PersistentLayout><Rewards /></PersistentLayout>} />

          {/* Routes WITHOUT layout (full-screen pages) */}
          <Route path="/event/:id" element={<EventDetail />} />
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
          <Sonner />
          <Analytics />
          <RestrictionBanner />
          <BrowserRouter>
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
