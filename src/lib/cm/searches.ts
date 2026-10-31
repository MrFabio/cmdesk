import { create } from "zustand";
import { persist } from "zustand/middleware";
import { emptyFilters, type Filters } from "./query.ts";
import { renamedStorage } from "./settings.ts";

export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  filters: Filters;
};

function preset(name: string, patch: Partial<Filters>): SavedSearch {
  return { id: `default-${name}`, name, query: "", filters: { ...emptyFilters(), ...patch } };
}

export const DEFAULT_SEARCHES: SavedSearch[] = [
  preset("Free agents", { free: true }),
  preset("Bosman", { bosman: true }),
  preset("Unprotected", { unprotected: true }),
  preset("Expiring soon", { expiring: true }),
  preset("Listed", { listed: true }),
  preset("Loan list", { listLoan: true }),
  preset("Requests", { request: true }),
  preset("On loan", { loan: true }),
  preset("Youth, high PA", { ageMax: "21", paMin: "150" }),
];

const FILTER_KEYS = Object.keys(emptyFilters()) as (keyof Filters)[];

export function sameSearch(filters: Filters, query: string, saved: SavedSearch): boolean {
  if (query.trim() !== saved.query.trim()) return false;
  return FILTER_KEYS.every((key) => filters[key] === saved.filters[key]);
}

type SearchState = {
  custom: SavedSearch[];
  saveSearch: (name: string, filters: Filters, query: string) => void;
  removeSearch: (id: string) => void;
};

export const useSearches = create<SearchState>()(
  persist(
    (set) => ({
      custom: [],
      saveSearch: (name, filters, query) => {
        const trimmed = name.trim().slice(0, 40);
        if (!trimmed) return;
        const next: SavedSearch = {
          id: `custom-${Date.now()}`,
          name: trimmed,
          query: query.trim(),
          filters: { ...emptyFilters(), ...filters },
        };
        set((state) => ({ custom: [...state.custom, next] }));
      },
      removeSearch: (id) => set((state) => ({ custom: state.custom.filter((search) => search.id !== id) })),
    }),
    {
      name: "cmdesk-searches",
      storage: renamedStorage("savedesk-searches"),
      partialize: (state) => ({ custom: state.custom }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { custom?: SavedSearch[] };
        const custom = (saved.custom ?? [])
          .filter((search) => search && typeof search.name === "string" && search.filters)
          .map((search) => ({
            id: search.id || `custom-${search.name}`,
            name: search.name.slice(0, 40),
            query: search.query ?? "",
            filters: { ...emptyFilters(), ...search.filters },
          }));
        return { ...current, custom };
      },
    },
  ),
);
