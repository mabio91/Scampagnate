import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import FeaturedEvent from "@/components/events/FeaturedEvent";
import CategoryFilter from "@/components/events/CategoryFilter";
import EventCard from "@/components/events/EventCard";
import { useEvents, useCategories } from "@/hooks/useEvents";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: events, isLoading } = useEvents(selectedCategory);
  const { data: categories } = useCategories();

  const featured = events?.find((e) => e.featured);
  const upcomingEvents = events?.filter((e) => new Date(e.date) >= new Date()) || [];

  return (
    <AppLayout>
      <div className="pt-4">
        {isLoading ? (
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
            {featured && <FeaturedEvent event={featured} />}
            <CategoryFilter
              categories={categories || []}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
            <div className="px-4">
              <h2 className="font-display text-xl font-bold text-foreground mb-3">
                Prossimi Eventi
              </h2>
              <div className="space-y-2">
                {upcomingEvents.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} />
                ))}
              </div>
              {upcomingEvents.length === 0 && (
                <p className="text-center text-muted-foreground font-body py-8">
                  Nessun evento trovato in questa categoria.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
