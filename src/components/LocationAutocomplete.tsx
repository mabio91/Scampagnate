import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  error?: boolean;
}

const LocationAutocomplete = ({
  value,
  onChange,
  placeholder = "Cerca luogo...",
  id,
  className,
  error,
}: LocationAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dummyDiv = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Initialize services once Google Maps is loaded
  const ensureServices = useCallback(() => {
    if (!window.google?.maps?.places) return false;
    if (!autocompleteService.current) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
    }
    if (!placesService.current) {
      if (!dummyDiv.current) {
        dummyDiv.current = document.createElement("div");
      }
      placesService.current = new google.maps.places.PlacesService(dummyDiv.current);
    }
    if (!sessionToken.current) {
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    }
    return true;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchLocations = useCallback(
    async (query: string) => {
      if (query.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      if (!ensureServices()) return;

      setLoading(true);
      try {
        autocompleteService.current!.getPlacePredictions(
          {
            input: query,
            componentRestrictions: { country: "it" },
            sessionToken: sessionToken.current!,
            types: ["geocode", "establishment"],
          },
          (predictions, status) => {
            setLoading(false);
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              predictions
            ) {
              setSuggestions(predictions);
              setIsOpen(predictions.length > 0);
            } else {
              setSuggestions([]);
              setIsOpen(false);
            }
          }
        );
      } catch {
        setLoading(false);
        setSuggestions([]);
      }
    },
    [ensureServices]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 300);
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!ensureServices()) return;

    placesService.current!.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["formatted_address", "geometry", "name"],
        sessionToken: sessionToken.current!,
      },
      (place, status) => {
        // Reset session token after getDetails (billing best practice)
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();

        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const displayName = place.formatted_address || place.name || prediction.description;
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          setInputValue(displayName!);
          onChange(displayName!, lat, lng);
        } else {
          setInputValue(prediction.description);
          onChange(prediction.description);
        }
      }
    );
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "pl-9",
            error && "border-destructive ring-destructive/20 ring-2",
            className
          )}
          autoComplete="off"
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((s) => {
            const main = s.structured_formatting.main_text;
            const secondary = s.structured_formatting.secondary_text;
            return (
              <button
                key={s.place_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
              >
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground truncate">
                    {main}
                  </p>
                  {secondary && (
                    <p className="text-xs font-body text-muted-foreground truncate">
                      {secondary}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
