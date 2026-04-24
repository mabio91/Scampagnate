import { memo, type ReactNode } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface EventCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemClassName?: string;
  className?: string;
}

const EventCarousel = memo(
  <T,>({ items, renderItem, itemClassName, className }: EventCarouselProps<T>) => {
    if (items.length === 0) return null;

    return (
      <div className={cn("w-full", className)}>
        <Carousel
          opts={{
            align: "start",
            containScroll: "trimSnaps",
            dragFree: false,
            skipSnaps: false,
            duration: 24,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-3 items-stretch md:-ml-4">
            {items.map((item, index) => (
              <CarouselItem
                key={index}
                className={cn(
                  "pl-3 md:pl-4 basis-[84%] sm:basis-[68%] lg:basis-[78%] xl:basis-[76%]",
                  itemClassName
                )}
              >
                {renderItem(item, index)}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    );
  }
);

EventCarousel.displayName = "EventCarousel";

export default EventCarousel;
