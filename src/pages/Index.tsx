import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import FeaturedEvent from "@/components/events/FeaturedEvent";
import CategoryFilter from "@/components/events/CategoryFilter";
import EventCard from "@/components/events/EventCard";
import { mockEvents, EventCategory } from "@/data/mockEvents";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);

  const featured = mockEvents.find((e) => e.featured);
  const filteredEvents = mockEvents.filter((e) => {
    if (selectedCategory && e.category !== selectedCategory) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="pt-4">
        {featured && <FeaturedEvent event={featured} />}

        <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />

        <div className="px-4">
          <h2 className="font-display text-xl font-bold text-foreground mb-3">
            Prossimi Eventi
          </h2>
          <div className="space-y-2">
            {filteredEvents.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </div>
          {filteredEvents.length === 0 && (
            <p className="text-center text-muted-foreground font-body py-8">
              Nessun evento trovato in questa categoria.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
