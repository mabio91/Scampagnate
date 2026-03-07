import { createContext, useContext, useState, ReactNode } from "react";

interface SearchContextType {
  searchOpen: boolean;
  toggleSearch: () => void;
  openSearch: () => void;
}

const SearchContext = createContext<SearchContextType>({ searchOpen: false, toggleSearch: () => {}, openSearch: () => {} });

export const useSearch = () => useContext(SearchContext);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <SearchContext.Provider value={{ searchOpen, toggleSearch: () => setSearchOpen((p) => !p), openSearch: () => setSearchOpen(true) }}>
      {children}
    </SearchContext.Provider>
  );
};
