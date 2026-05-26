import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfDay, startOfMonth, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import CategoryFilter from "@/components/events/CategoryFilter";
import EventCard from "@/components/events/EventCard";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveDiscounts } from "@/hooks/useActiveDiscounts";
import { useCategories, useEvents } from "@/hooks/useEvents";
import { cn } from "@/lib/utils";
import { isEventUpcomingByDate } from "@/lib/eventDates";

const hiddenStatuses = new Set(["draft", "unpublished", "past", "completed", "cancelled"]);

const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");

const EventCalendar = () => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const { data: events, isLoading, isFetching } = useEvents(selectedCategories);
  const { data: categories } = useCategories();
  const { data: discountMap } = useActiveDiscounts();

  const visibleEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => (
      isEventUpcomingByDate(event.date) && !hiddenStatuses.has(String(event.status || ""))
    ));
  }, [events]);

  const eventsByDate = useMemo(() => {
    return visibleEvents.reduce<Record<string, typeof visibleEvents>>((acc, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [visibleEvents]);

  const days = useMemo(() => {
    const monthDays = eachDayOfInterval({ start: startOfMonth(visibleMonth), end: endOfMonth(visibleMonth) });
    const mondayBasedOffset = (getDay(monthDays[0]) + 6) % 7;
    return [
      ...Array.from({ length: mondayBasedOffset }, () => null as Date | null),
      ...monthDays,
    ];
  }, [visibleMonth]);

  const selectedEvents = eventsByDate[toDateKey(selectedDate)] || [];
  const monthLabel = format(visibleMonth, "MMMM yyyy", { locale: it });

  return (
    <div className="overflow-x-hidden pt-4 pb-6">
      <div className="px-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-body font-semibold uppercase tracking-wide text-muted-foreground">Scopri</p>
            <h1 className="font-display text-2xl font-bold text-foreground">Calendario eventi</h1>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/">Lista</Link>
          </Button>
        </div>
      </div>

      <CategoryFilter
        categories={categories || []}
        selected={selectedCategories}
        onToggle={(category) => {
          setSelectedCategories((current) =>
            current.includes(category) ? current.filter((value) => value !== category) : [...current, category]
          );
        }}
        onClear={() => setSelectedCategories([])}
      />

      <div className="px-4">
        <div className="rounded-2xl border border-border/50 bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between px-1 pb-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
              aria-label="Mese precedente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-display text-lg font-bold capitalize text-foreground">{monthLabel}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              aria-label="Mese successivo"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-body font-bold text-muted-foreground">
            {["L", "M", "M", "G", "V", "S", "D"].map((day, index) => (
              <div key={`${day}-${index}`} className="py-1">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="aspect-square" />;
              const key = toDateKey(day);
              const count = eventsByDate[key]?.length || 0;
              const selected = isSameDay(day, selectedDate);
              const today = isSameDay(day, new Date());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(startOfDay(day))}
                  className={cn(
                    "aspect-square rounded-xl text-sm font-body font-semibold transition-all active:scale-95",
                    "flex flex-col items-center justify-center gap-1",
                    selected ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted",
                    today && !selected && "text-primary",
                  )}
                >
                  <span>{format(day, "d")}</span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, dotIndex) => (
                      <span
                        key={dotIndex}
                        className={cn("h-1 w-1 rounded-full", selected ? "bg-primary-foreground" : "bg-secondary")}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 mt-5">
        <h2 className="font-display text-lg font-bold text-foreground mb-3">
          Eventi del {format(selectedDate, "d MMMM", { locale: it })}
          <span className="ml-2 text-sm font-body font-normal text-muted-foreground">({selectedEvents.length})</span>
        </h2>

        <div className={`transition-opacity duration-200 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {isLoading && !events ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
            </div>
          ) : selectedEvents.length > 0 ? (
            <div className="space-y-2.5">
              {selectedEvents.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={index}
                  discount={discountMap?.[event.id] || discountMap?.["__all__"] || null}
                />
              ))}
            </div>
          ) : (
            <div className="py-8">
              <EmptyState
                icon={SearchX}
                title="Nessun evento in questa data"
                description="Scegli un altro giorno con un indicatore oppure cambia mese."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCalendar;
