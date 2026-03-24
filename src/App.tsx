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
