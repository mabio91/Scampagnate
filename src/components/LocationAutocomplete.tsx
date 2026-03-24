import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

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
  placeholder = "Search location...",
  id,
  className,
  error,
}: LocationAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=it`,
        { headers: { "Accept-Language": "it" } }
      );
      const data: LocationSuggestion[] = await res.json();
      setSuggestions(data);
      setIsOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 300);
  };

  const handleSelect = (suggestion: LocationSuggestion) => {
    const displayName = suggestion.display_name;
    setInputValue(displayName);
    onChange(displayName, parseFloat(suggestion.lat), parseFloat(suggestion.lon));
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
            const parts = s.display_name.split(", ");
            const main = parts[0];
            const secondary = parts.slice(1, 3).join(", ");
            return (
              <button
                key={s.place_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
              >
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground truncate">{main}</p>
                  {secondary && (
                    <p className="text-xs font-body text-muted-foreground truncate">{secondary}</p>
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
