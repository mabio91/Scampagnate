import { useMemo, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
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
import { format, isThisWeek, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "@/contexts/SearchContext";
import { UI_LABELS } from "@/lib/labels";

// Interest-to-keyword map for personalized recommendations
const INTEREST_KEYWORDS: Record<string, string[]> = {
  "Trekking e camminate": ["trekking", "outdoor", "escursion"],
  "Aperitivi e tramonti": ["aperitiv", "tramont", "social"],
  "Cene e momenti conviviali": ["cena", "convivial", "social"],
  "Eventi social": ["social", "evento"],
  "Esperienze outdoor particolari": ["outdoor", "esperien", "special"],
  "Sport e movimento": ["sport", "movimento", "fitness"],
  "Eventi serali": ["seral", "nott", "sera"],
  "Avventura e sfida": ["avventur", "sfida", "outdoor", "trekking"],
};

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
  } = useSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();

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
    const userInterests = profile?.interests as string[] | null;
    if (!userInterests || userInterests.length === 0 || !profile?.onboarding_completed) return [];

    const getScore = (event: any) => {
      let score = 0;
      const searchText = `${(event.category?.name || "").toLowerCase()} ${event.title.toLowerCase()} ${event.description.toLowerCase()}`;
      for (const interest of userInterests) {
        const keywords = INTEREST_KEYWORDS[interest] || [];
        for (const kw of keywords) {
          if (searchText.includes(kw)) { score += 1; break; }
        }
      }
      return score;
    };

    return allUpcoming
      .map(e => ({ event: e, score: getScore(e) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || new Date(a.event.date).getTime() - new Date(b.event.date).getTime())
      .map(x => x.event)
      .slice(0, 3);
  }, [allUpcoming, profile]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = allUpcoming;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      );
    }
    if (dateFilter) {
      filtered = filtered.filter(e => e.date === format(dateFilter, "yyyy-MM-dd"));
    }
    if (priceFilter === "free") filtered = filtered.filter(e => Number(e.price) === 0);
    if (priceFilter === "paid") filtered = filtered.filter(e => Number(e.price) > 0);

    // Quick filters
    if (quickFilters.includes("featured")) filtered = filtered.filter(e => e.featured);
    if (quickFilters.includes("lastSpots")) filtered = filtered.filter(e => (e.spots_taken / e.spots_total) > 0.8 && e.status !== "full");
    if (quickFilters.includes("thisWeek")) filtered = filtered.filter(e => isThisWeek(new Date(e.date), { weekStartsOn: 1 }));
    if (quickFilters.includes("free")) filtered = filtered.filter(e => Number(e.price) === 0);

    return filtered;
  }, [allUpcoming, searchQuery, dateFilter, priceFilter, quickFilters]);

  // Group events: this week vs later
  const { thisWeekEvents, laterEvents } = useMemo(() => {
    const tw: typeof filteredEvents = [];
    const later: typeof filteredEvents = [];
    for (const e of filteredEvents) {
      if (isThisWeek(new Date(e.date), { weekStartsOn: 1 })) {
        tw.push(e);
      } else {
        later.push(e);
      }
    }
    return { thisWeekEvents: tw, laterEvents: later };
  }, [filteredEvents]);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter(undefined);
    setPriceFilter("all");
    setSelectedCategory(null);
    setQuickFilters([]);
  };

  return (
    <AppLayout>
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

                          {(["all", "free", "paid"] as PriceFilter[]).map(p => (
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
            {!hasActiveFilters && recommended.length > 0 && (
              <div className="mt-4">
                <RecommendedSection events={recommended} />
              </div>
            )}

            {/* Event list */}
            <div className="px-4 mt-4">
              <h2 className="font-display text-xl font-bold text-foreground mb-3">
                {hasActiveFilters ? "Risultati ricerca" : UI_LABELS.upcomingEvents}
                {hasActiveFilters && (
                  <span className="text-sm font-body font-normal text-muted-foreground ml-2">
                    ({filteredEvents.length})
                  </span>
                )}
              </h2>

              <div className={`transition-opacity duration-200 ${isFetching ? "opacity-50" : "opacity-100"}`}>
                {filteredEvents.length > 0 ? (
                  <>
                    {/* This week */}
                    {thisWeekEvents.length > 0 && (
                      <div className="mb-4">
                        {laterEvents.length > 0 && (
                          <h3 className="font-display text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            {UI_LABELS.thisWeek}
                          </h3>
                        )}
                        <div className="space-y-2.5">
                          {thisWeekEvents.map((event, i) => {
                            const discount = discountMap?.[event.id] || discountMap?.["__all__"] || null;
                            return <EventCard key={event.id} event={event} index={i} discount={discount} />;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Later */}
                    {laterEvents.length > 0 && (
                      <div className="mb-4">
                        {thisWeekEvents.length > 0 && (
                          <h3 className="font-display text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            {UI_LABELS.later}
                          </h3>
                        )}
                        <div className="space-y-2.5">
                          {laterEvents.map((event, i) => {
                            const discount = discountMap?.[event.id] || discountMap?.["__all__"] || null;
                            return <EventCard key={event.id} event={event} index={i + thisWeekEvents.length} discount={discount} />;
                          })}
                        </div>
                      </div>
                    )}
                  </>
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
    </AppLayout>
  );
};

export default Index;
