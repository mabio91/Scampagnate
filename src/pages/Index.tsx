import { useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import FeaturedEvent from "@/components/events/FeaturedEvent";
import CategoryFilter from "@/components/events/CategoryFilter";
import EventCard from "@/components/events/EventCard";
import QuickFilters from "@/components/events/QuickFilters";
import RecommendedSection from "@/components/events/RecommendedSection";
import ProposalSuggestionCard from "@/components/ProposalSuggestionCard";
import EmptyState from "@/components/EmptyState";
import { useEvents, useCategories } from "@/hooks/useEvents";
import { useActiveDiscounts } from "@/hooks/useActiveDiscounts";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, SlidersHorizontal, Lightbulb, SearchX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isThisWeek, startOfWeek, endOfWeek, addWeeks, getDay, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "@/contexts/SearchContext";
import { UI_LABELS } from "@/lib/labels";
import { calculateEventFitScore } from "@/hooks/useEventFitScore";

const Index = () => {
  const {
    searchOpen,
    selectedCategory, setSelectedCategory,
    searchQuery, setSearchQuery,
    dateFilter, setDateFilter,
    priceFilter, setPriceFilter,
    showFilters, setShowFilters,
    quickFilters, toggleQuickFilter,
    hasActiveFilters,
    clearAllFilters,
    closeSearch,
  } = useSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { profile, user } = useAuth();

  // Reset search status on unmount
  useEffect(() => {
    return () => {
      closeSearch();
    };
  }, [closeSearch]);

  // Fetch user's active registrations for "Iscritto" status
  const { data: userRegisteredEventIds } = useQuery({
    queryKey: ["user-registered-events", user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("user_id", user.id)
        .in("status", ["registered", "paid", "waitlist"]);
      return new Set((data || []).map((r: any) => r.event_id));
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setDateFilter(undefined);
      setPriceFilter("all");
      setShowFilters(false);
    }
  }, [searchOpen, setSearchQuery, setDateFilter, setPriceFilter, setShowFilters]);

  const { data: events, isLoading, isFetching } = useEvents(selectedCategory);
  const { data: categories } = useCategories();
  const { data: discountMap } = useActiveDiscounts();

  const normalizeSearchText = (value: string | null | undefined) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  // All upcoming, non-draft/past/cancelled events
  const allUpcoming = useMemo(() => {
    if (!events) return [];
    const now = startOfDay(new Date());
    return events.filter(e => new Date(e.date) >= now && e.status !== "draft" && e.status !== "past" && e.status !== "cancelled");
  }, [events]);

  // Featured event
  const featured = useMemo(() => {
    const manual = allUpcoming.find(e => e.featured);
    if (manual) return manual;
    return allUpcoming.length > 0 ? allUpcoming[0] : null;
  }, [allUpcoming]);

  // Personalized recommendations
  const recommended = useMemo(() => {
    const personalizedRecommendations = profile?.onboarding_completed
      ? allUpcoming
      .map((event) => {
        const fitScoreMainCategory =
          (event.additional_fields as any)?.fit_score_main_category || event.category?.name || null;
        const fitScoreSecondaryCategories =
          ((event.additional_fields as any)?.fit_score_secondary_categories as string[] | undefined) || [];
        const fitScore = calculateEventFitScore(
          {
            interests: (profile.interests as string[] | null | undefined) || [],
            self_level: profile.self_level,
          },
          {
            difficulty: event.difficulty,
            category: fitScoreMainCategory ? { name: fitScoreMainCategory } : null,
            secondaryCategories: fitScoreSecondaryCategories,
          }
        );

        return { event, score: fitScore.score, hidden: fitScore.hidden, profileIncomplete: fitScore.profileIncomplete };
      })
      .filter((item) => !item.hidden && !item.profileIncomplete && item.score >= 75)
      .sort((a, b) => b.score - a.score || new Date(a.event.date).getTime() - new Date(b.event.date).getTime())
      .map(x => x.event)
      .slice(0, 3)
      : [];

    if (personalizedRecommendations.length > 0) {
      return personalizedRecommendations;
    }

    return allUpcoming
      .filter((event) => event.id !== featured?.id)
      .slice(0, 3);
  }, [allUpcoming, featured?.id, profile]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = allUpcoming;

    if (searchQuery) {
      const q = normalizeSearchText(searchQuery);
      filtered = filtered.filter(e =>
        [
          e.title,
          e.location,
          e.description,
          (e as any).location_label,
          e.category?.name,
        ].some((value) => normalizeSearchText(value).includes(q))
      );
    }
    if (dateFilter) {
      filtered = filtered.filter(e => e.date === format(dateFilter, "yyyy-MM-dd"));
    }
    if (priceFilter === "free") filtered = filtered.filter(e => Number(e.price) === 0);
    if (priceFilter === "paid") filtered = filtered.filter(e => Number(e.price) > 0);

    // Quick filters (combinable)
    if (quickFilters.includes("featured")) filtered = filtered.filter(e => e.featured);
    if (quickFilters.includes("lastSpots")) filtered = filtered.filter(e => (e.spots_taken / e.spots_total) > 0.8 && e.status !== "full");
    if (quickFilters.includes("thisWeek")) filtered = filtered.filter(e => isThisWeek(new Date(e.date), { weekStartsOn: 1 }));
    if (quickFilters.includes("nextWeek")) {
      const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
      const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
      filtered = filtered.filter(e => {
        const d = new Date(e.date);
        return d >= nextWeekStart && d <= nextWeekEnd;
      });
    }
    if (quickFilters.includes("weekend")) {
      filtered = filtered.filter(e => {
        const day = getDay(new Date(e.date));
        return day === 5 || day === 6 || day === 0; // Fri, Sat, Sun
      });
    }

    return filtered;
  }, [allUpcoming, searchQuery, dateFilter, priceFilter, quickFilters]);

  const clearFilters = clearAllFilters;

  return (
    <>
      <div className="pt-4 pb-4 scroll-smooth">
        {isLoading && !events ? (
          <div className="px-4">
            <Skeleton className="w-full h-64 rounded-2xl mb-4" />
            <Skeleton className="w-full h-10 rounded-full mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="w-full h-28 rounded-xl" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Search bar */}
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 mb-2">
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          placeholder="Cerca eventi..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-8 rounded-full bg-muted border-none font-body focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                      <Button
                        variant={showFilters ? "default" : "outline"}
                        size="icon"
                        className="rounded-full flex-shrink-0"
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "rounded-full text-xs font-body",
                                  dateFilter && "bg-primary text-primary-foreground border-primary"
                                )}
                              >
                                {dateFilter ? format(dateFilter, "d MMM", { locale: it }) : "Data"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateFilter}
                                onSelect={setDateFilter}
                                className="p-3 pointer-events-auto"
                                disabled={date => date < startOfDay(new Date())}
                              />
                              {dateFilter && (
                                <div className="px-3 pb-3">
                                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateFilter(undefined)}>
                                    Cancella filtro
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>

                          {(["all", "free", "paid"] as const).map(p => (
                            <Button
                              key={p}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "rounded-full text-xs font-body capitalize",
                                priceFilter === p && "bg-primary text-primary-foreground border-primary"
                              )}
                              onClick={() => setPriceFilter(p)}
                            >
                              {p === "all" ? "Tutti i prezzi" : p === "free" ? UI_LABELS.free : "A pagamento"}
                            </Button>
                          ))}

                          {hasActiveFilters && (
                            <Button variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={clearFilters}>
                              <X className="h-3 w-3 mr-1" /> Cancella tutto
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hero */}
            {!hasActiveFilters && featured && <FeaturedEvent event={featured} />}

            {/* Category filters */}
            <CategoryFilter
              categories={categories || []}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            {/* Quick filters */}
            <QuickFilters active={quickFilters} onToggle={toggleQuickFilter} />

            {/* Personalized recommendations */}
            {recommended.length > 0 && (
              <div className="mt-4">
                <RecommendedSection events={recommended} />
              </div>
            )}

            {/* Event list */}
            <div className="px-3 sm:px-4 mt-4">
              <h2 className="font-display text-lg font-bold text-foreground mb-3">
                {hasActiveFilters ? "Risultati ricerca" : UI_LABELS.upcomingEvents}
                {hasActiveFilters && (
                  <span className="text-sm font-body font-normal text-muted-foreground ml-2">
                    ({filteredEvents.length})
                  </span>
                )}
              </h2>

              <div className={`transition-opacity duration-200 ${isFetching ? "opacity-50" : "opacity-100"}`}>
                {filteredEvents.length > 0 ? (
                  <div className="space-y-2.5">
                    {filteredEvents.map((event, i) => {
                      const discount = discountMap?.[event.id] || discountMap?.["__all__"] || null;
                      return <EventCard key={event.id} event={event} index={i} discount={discount} isUserRegistered={!!userRegisteredEventIds?.has(event.id)} />;
                    })}
                  </div>
                ) : (
                  /* Empty states */
                  !isFetching && (
                    <div className="py-8">
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={SearchX}
                          title={UI_LABELS.noResultsTitle}
                          description={UI_LABELS.noResultsDesc}
                          ctaLabel={UI_LABELS.showAll}
                          onCtaClick={clearFilters}
                        />
                      ) : (
                        <EmptyState
                          icon={Search}
                          title={UI_LABELS.noEventsTitle}
                          description={UI_LABELS.noEventsDesc}
                          ctaLabel={UI_LABELS.proposeActivity}
                          ctaTo="/profile"
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Proposal card at bottom */}
            {filteredEvents.length > 0 && (
              <div className="mt-6 mb-4">
                <ProposalSuggestionCard />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Index;
