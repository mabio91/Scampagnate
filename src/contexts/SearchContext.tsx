import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import type { QuickFilterType } from "@/components/events/QuickFilters";

type PriceFilter = "all" | "free" | "paid";

interface SearchContextType {
  searchOpen: boolean;
  toggleSearch: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  // Persisted filter state
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  dateFilter: Date | undefined;
  setDateFilter: (d: Date | undefined) => void;
  priceFilter: PriceFilter;
  setPriceFilter: (f: PriceFilter) => void;
  quickFilters: QuickFilterType[];
  toggleQuickFilter: (f: QuickFilterType) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
}

const SearchContext = createContext<SearchContextType>({
  searchOpen: false,
  toggleSearch: () => {},
  openSearch: () => {},
  closeSearch: () => {},
  selectedCategory: null,
  setSelectedCategory: () => {},
  searchQuery: "",
  setSearchQuery: () => {},
  dateFilter: undefined,
  setDateFilter: () => {},
  priceFilter: "all",
  setPriceFilter: () => {},
  quickFilters: [],
  toggleQuickFilter: () => {},
  showFilters: false,
  setShowFilters: () => {},
  clearAllFilters: () => {},
  hasActiveFilters: false,
});

export const useSearch = () => useContext(SearchContext);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [quickFilters, setQuickFilters] = useState<QuickFilterType[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const toggleQuickFilter = useCallback((f: QuickFilterType) => {
    setQuickFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setDateFilter(undefined);
    setPriceFilter("all");
    setSelectedCategory(null);
    setQuickFilters([]);
    setShowFilters(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const hasActiveFilters = !!(searchQuery || dateFilter || priceFilter !== "all" || quickFilters.length > 0);

  const value = useMemo(() => ({
    searchOpen,
    toggleSearch,
    openSearch,
    closeSearch,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    priceFilter,
    setPriceFilter,
    quickFilters,
    toggleQuickFilter,
    showFilters,
    setShowFilters,
    clearAllFilters,
    hasActiveFilters,
  }), [
    searchOpen,
    toggleSearch,
    openSearch,
    closeSearch,
    selectedCategory,
    searchQuery,
    dateFilter,
    priceFilter,
    quickFilters,
    toggleQuickFilter,
    showFilters,
    clearAllFilters,
    hasActiveFilters,
  ]);

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};
