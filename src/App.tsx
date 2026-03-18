import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RestrictionBanner } from "@/components/RestrictionBanner";
import Index from "./pages/Index";

// Lazy-loaded routes for code splitting
const EventDetail = lazy(() => import("./pages/EventDetail"));
const MyEvents = lazy(() => import("./pages/MyEvents"));
const Merch = lazy(() => import("./pages/Merch"));
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
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/event/:id" element={<EventDetail />} />
                <Route path="/my-events" element={<MyEvents />} />
                <Route path="/merch" element={<Merch />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile-setup" element={<ProfileSetup />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/organizer" element={<OrganizerDashboard />} />
                <Route path="/organizer/:id" element={<OrganizerProfile />} />
                <Route path="/organizer/events/new" element={<EventForm />} />
                <Route path="/organizer/events/:id" element={<EventManage />} />
                <Route path="/organizer/events/:id/edit" element={<EventForm />} />
                <Route path="/membership-success" element={<MembershipSuccess />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
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
