import { Component, lazy, Suspense, useMemo, type ComponentType, type ErrorInfo, type ReactNode } from "react";
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
import { reloadOnceForChunkError } from "@/lib/chunkRecovery";
import Index from "./pages/Index";

type LazyRouteModule = { default: ComponentType };

const lazyWithChunkRecovery = (loader: () => Promise<LazyRouteModule>) =>
  lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      if (reloadOnceForChunkError(error)) {
        return new Promise<LazyRouteModule>(() => undefined);
      }

      throw error;
    }
  });

// Lazy-loaded routes for code splitting
const EventDetail = lazyWithChunkRecovery(() => import("./pages/EventDetail"));
const MyEvents = lazyWithChunkRecovery(() => import("./pages/MyEvents"));
const Merch = lazyWithChunkRecovery(() => import("./pages/Merch"));
const ProductDetail = lazyWithChunkRecovery(() => import("./pages/ProductDetail"));
const Profile = lazyWithChunkRecovery(() => import("./pages/Profile"));
const Auth = lazyWithChunkRecovery(() => import("./pages/Auth"));
const ResetPassword = lazyWithChunkRecovery(() => import("./pages/ResetPassword"));
const NotFound = lazyWithChunkRecovery(() => import("./pages/NotFound"));
const OrganizerDashboard = lazyWithChunkRecovery(() => import("./pages/OrganizerDashboard"));
const EventForm = lazyWithChunkRecovery(() => import("./pages/EventForm"));
const EventManage = lazyWithChunkRecovery(() => import("./pages/EventManage"));
const Notifications = lazyWithChunkRecovery(() => import("./pages/Notifications"));
const EventCalendar = lazyWithChunkRecovery(() => import("./pages/EventCalendar"));
const ProfileSetup = lazyWithChunkRecovery(() => import("./pages/ProfileSetup"));
const OrganizerProfile = lazyWithChunkRecovery(() => import("@/pages/OrganizerProfile"));
const MembershipSuccess = lazyWithChunkRecovery(() => import("./pages/MembershipSuccess"));
const PaymentSuccess = lazyWithChunkRecovery(() => import("./pages/PaymentSuccess"));
const Privacy = lazyWithChunkRecovery(() => import("./pages/Privacy"));
const Terms = lazyWithChunkRecovery(() => import("./pages/Terms"));
const DeleteAccount = lazyWithChunkRecovery(() => import("./pages/DeleteAccount"));
const EventParticipants = lazyWithChunkRecovery(() => import("./pages/EventParticipants"));
const EventStaff = lazyWithChunkRecovery(() => import("./pages/EventStaff"));
const ContentPage = lazyWithChunkRecovery(() => import("./pages/ContentPage"));
const Rewards = lazyWithChunkRecovery(() => import("./pages/Rewards"));

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

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; isReloading: boolean }
> {
  state = { hasError: false, isReloading: false };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      isReloading: reloadOnceForChunkError(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Route rendering failed", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {this.state.isReloading ? "Aggiornamento in corso" : "Qualcosa non si è caricato"}
          </h1>
          <p className="mt-3 text-sm font-body text-muted-foreground leading-relaxed">
            {this.state.isReloading
              ? "Stiamo aggiornando la pagina con l'ultima versione disponibile."
              : "Ricarica la pagina per riprendere da dove eri rimasto."}
          </p>
          {!this.state.isReloading && (
            <button
              type="button"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-body font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              Ricarica
            </button>
          )}
        </div>
      </div>
    );
  }
}

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
                <RouteErrorBoundary key={location.pathname}>
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
                </RouteErrorBoundary>
              </PageTransition>
            </AnimatePresence>
          </main>
          <BottomNav />
        </div>
      )}
      {fullScreen && (
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <RouteErrorBoundary key={location.pathname}>
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
            </RouteErrorBoundary>
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
