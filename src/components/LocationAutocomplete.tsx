/// <reference types="google.maps" />
import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

interface PlaceAutocompleteSuggestion {
  placePrediction?: {
    placeId: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    text?: { text?: string };
  };
}

interface PlacesAutocompleteResponse {
  suggestions?: PlaceAutocompleteSuggestion[];
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  error?: boolean;
}

const GOOGLE_API_KEY = "AIzaSyCPktJ9nE3SLzugNWgWoh_givCXkl8w2Qg";

const formatSelectedPlaceAddress = (
  placeName?: string,
  formattedAddress?: string,
  fallback?: string
) => {
  const cleanName = placeName?.trim();
  const cleanAddress = formattedAddress?.trim();
  const cleanFallback = fallback?.trim();

  if (cleanName && cleanAddress) {
    const normalizedName = cleanName.toLocaleLowerCase("it-IT");
    const normalizedAddress = cleanAddress.toLocaleLowerCase("it-IT");

    if (normalizedAddress === normalizedName || normalizedAddress.startsWith(`${normalizedName},`)) {
      return cleanAddress;
    }

    return `${cleanName}, ${cleanAddress}`;
  }

  return cleanAddress || cleanName || cleanFallback || "";
};

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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const requestSeqRef = useRef(0);

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
    const requestSeq = ++requestSeqRef.current;

    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      // Use Places API (New) - Autocomplete REST endpoint
      const res = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_API_KEY,
          },
          body: JSON.stringify({
            input: query,
            includedRegionCodes: ["it"],
            languageCode: "it",
          }),
        }
      );

      if (requestSeq !== requestSeqRef.current) return;

      if (!res.ok) {
        console.error("Places Autocomplete error:", res.status);
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      const data = (await res.json()) as PlacesAutocompleteResponse;
      if (requestSeq !== requestSeqRef.current) return;

      const results: Suggestion[] = (data.suggestions || [])
        .filter((s): s is Required<Pick<PlaceAutocompleteSuggestion, "placePrediction">> => Boolean(s.placePrediction))
        .map((s) => ({
          placeId: s.placePrediction.placeId,
          mainText: s.placePrediction.structuredFormat?.mainText?.text || "",
          secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || "",
          fullText: s.placePrediction.text?.text || "",
        }));

      setSuggestions(results);
      setIsOpen(results.length > 0);
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return;
      console.error("Places search error:", err);
      setSuggestions([]);
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    requestSeqRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(false);
    setIsOpen(false);
    setSuggestions([]);
    setInputValue(suggestion.fullText);

    try {
      // Fetch place details for coordinates using Places API (New)
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}?fields=formattedAddress,displayName,location&languageCode=it`,
        {
          headers: {
            "X-Goog-Api-Key": GOOGLE_API_KEY,
          },
        }
      );

      if (res.ok) {
        const place = await res.json();
        const displayName = formatSelectedPlaceAddress(
          place.displayName?.text,
          place.formattedAddress,
          suggestion.fullText
        );
        const lat = place.location?.latitude;
        const lng = place.location?.longitude;
        setInputValue(displayName);
        onChange(displayName, lat, lng);
      } else {
        onChange(suggestion.fullText);
      }
    } catch {
      onChange(suggestion.fullText);
    }
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
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
            >
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-body font-semibold text-foreground truncate">
                  {s.mainText}
                </p>
                {s.secondaryText && (
                  <p className="text-xs font-body text-muted-foreground truncate">
                    {s.secondaryText}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
