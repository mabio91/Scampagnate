import { useState, useMemo, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import FeaturedEvent from "@/components/events/FeaturedEvent";
import CategoryFilter from "@/components/events/CategoryFilter";
import EventCard from "@/components/events/EventCard";
import { useEvents, useCategories } from "@/hooks/useEvents";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "@/contexts/SearchContext";

type PriceFilter = "all" | "free" | "paid";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const { searchOpen } = useSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync search bar visibility with header search icon
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      // Reset filters when closing
      setSearchQuery("");
      setDateFilter(undefined);
      setPriceFilter("all");
      setShowFilters(false);
    }
  }, [searchOpen]);

  const { data: events, isLoading, isFetching } = useEvents(selectedCategory);
  const { data: categories } = useCategories();

  const hasActiveFilters = searchQuery || dateFilter || priceFilter !== "all";

  const upcomingEvents = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return events
      .filter((e) => new Date(e.date) >= now)
      .filter((e) => e.status !== "draft" && e.status !== "past" && e.status !== "cancelled")
      .filter((e) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
        );
      })
      .filter((e) => {
        if (!dateFilter) return true;
        return e.date === format(dateFilter, "yyyy-MM-dd");
      })
      .filter((e) => {
        if (priceFilter === "all") return true;
        if (priceFilter === "free") return Number(e.price) === 0;
        return Number(e.price) > 0;
      });
  }, [events, searchQuery, dateFilter, priceFilter]);

  // Featured: prefer manually marked, fallback to nearest upcoming
  const featured = useMemo(() => {
    if (!events) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const upcoming = events.filter((e) => new Date(e.date) >= now && e.status !== "draft" && e.status !== "past" && e.status !== "cancelled");
    const manual = upcoming.find((e) => e.featured);
    if (manual) return manual;
    // Auto-select nearest upcoming event
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [events]);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter(undefined);
    setPriceFilter("all");
    setSelectedCategory(null);
  };

  return (
    <AppLayout>
      <div className="pt-4 pb-4">
        {isLoading && !events ? (
          <div className="px-4">
            <Skeleton className="w-full h-64 rounded-2xl mb-4" />
            <Skeleton className="w-full h-10 rounded-full mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="w-full h-28 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Search Bar & Filters - only visible when toggled via header icon */}
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
                          placeholder="Search events..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-8 rounded-full bg-muted border-none font-body focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
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

                  {/* Advanced Filters */}
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
                                {dateFilter ? format(dateFilter, "d MMM", { locale: it }) : "Date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateFilter}
                                onSelect={setDateFilter}
                                className="p-3 pointer-events-auto"
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              />
                              {dateFilter && (
                                <div className="px-3 pb-3">
                                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateFilter(undefined)}>
                                    Clear date
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>

                          {(["all", "free", "paid"] as PriceFilter[]).map((p) => (
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
                              {p === "all" ? "All prices" : p === "free" ? "Free" : "Paid"}
                            </Button>
                          ))}

                          {hasActiveFilters && (
                            <Button variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={clearFilters}>
                              <X className="h-3 w-3 mr-1" /> Clear all
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Featured Event - hide during active search */}
            {!hasActiveFilters && featured && <FeaturedEvent event={featured} />}

            {/* Category Filter */}
            <CategoryFilter
              categories={categories || []}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            {/* Event List */}
            <div className="px-4">
              <h2 className="font-display text-xl font-bold text-foreground mb-3">
                {hasActiveFilters ? "Search Results" : "Upcoming Events"}
                {hasActiveFilters && (
                  <span className="text-sm font-body font-normal text-muted-foreground ml-2">
                    ({upcomingEvents.length})
                  </span>
                )}
              </h2>
              <div className={`space-y-2.5 stagger-children transition-opacity duration-200 ${isFetching ? "opacity-50" : "opacity-100"}`}>
                {upcomingEvents.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} />
                ))}
              </div>
              {!isFetching && upcomingEvents.length === 0 && (
                <div className="text-center py-16 animate-fade-in-up">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <Search className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-muted-foreground font-body font-medium">
                    No events found
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" className="mt-2 text-primary font-body" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
