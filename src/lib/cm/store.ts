import { create } from "zustand";
import { emptyFilters, type Filters, type SortDir, type SortKey } from "./query.ts";
import type { ParsedSave, ProgressUpdate } from "./types.ts";

export type Place = { kind: "club"; clubId: number } | { kind: "free" } | { kind: "search" };

type DeskState = {
  save: ParsedSave | null;
  busy: ProgressUpdate | null;
  error: string | null;
  place: Place;
  playerIndex: number | null;
  settingsOpen: boolean;
  treeOpen: boolean;
  query: string;
  filters: Filters;
  sortKey: SortKey;
  sortDir: SortDir;
  highlight: number;
  openSave: (save: ParsedSave) => void;
  setBusy: (busy: ProgressUpdate | null) => void;
  setError: (error: string | null) => void;
  showClub: (clubId: number) => void;
  setHumanClub: (clubId: number) => void;
  showFree: () => void;
  showSearch: () => void;
  setQuery: (query: string) => void;
  patchFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  applySearch: (filters: Filters, query: string) => void;
  setSort: (sortKey: SortKey, sortDir: SortDir) => void;
  openPlayer: (index: number) => void;
  closePlayer: () => void;
  setHighlight: (highlight: number) => void;
  setSettingsOpen: (open: boolean) => void;
  setTreeOpen: (open: boolean) => void;
  closeCareer: () => void;
};

export const useDesk = create<DeskState>((set) => ({
  save: null,
  busy: null,
  error: null,
  place: { kind: "search" },
  playerIndex: null,
  settingsOpen: false,
  treeOpen: false,
  query: "",
  filters: emptyFilters(),
  sortKey: "pos",
  sortDir: "asc",
  highlight: 0,
  openSave: (save) =>
    set({
      save,
      busy: null,
      error: null,
      place:
        save.humanClubId >= 0
          ? { kind: "club", clubId: save.humanClubId }
          : save.clubs[0]
            ? { kind: "club", clubId: save.clubs[0].id }
            : { kind: "free" },
      playerIndex: null,
      settingsOpen: false,
      treeOpen: false,
      query: "",
      filters: emptyFilters(),
      highlight: 0,
    }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error, busy: null }),
  showClub: (clubId) =>
    set({ place: { kind: "club", clubId }, query: "", playerIndex: null, highlight: 0, treeOpen: false, settingsOpen: false }),
  setHumanClub: (clubId) =>
    set((state) => {
      if (!state.save) return state;
      return {
        save: { ...state.save, humanClubId: clubId },
        place: { kind: "club" as const, clubId },
        query: "",
        playerIndex: null,
        highlight: 0,
        treeOpen: false,
        settingsOpen: false,
      };
    }),
  showFree: () =>
    set({ place: { kind: "free" }, query: "", playerIndex: null, highlight: 0, treeOpen: false, settingsOpen: false }),
  showSearch: () => set({ place: { kind: "search" }, playerIndex: null, highlight: 0, treeOpen: false, settingsOpen: false }),
  setQuery: (query) => set({ query, place: { kind: "search" }, highlight: 0, settingsOpen: false }),
  patchFilters: (patch) =>
    set((state) => ({ filters: { ...state.filters, ...patch }, place: { kind: "search" }, highlight: 0, settingsOpen: false })),
  resetFilters: () => set({ filters: emptyFilters(), query: "", highlight: 0 }),
  applySearch: (filters, query) =>
    set({
      filters: { ...emptyFilters(), ...filters },
      query,
      place: { kind: "search" },
      playerIndex: null,
      highlight: 0,
      settingsOpen: false,
      treeOpen: false,
    }),
  setSort: (sortKey, sortDir) => set({ sortKey, sortDir, highlight: 0 }),
  openPlayer: (playerIndex) => set({ playerIndex, settingsOpen: false }),
  closePlayer: () => set({ playerIndex: null }),
  setHighlight: (highlight) => set({ highlight }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen, treeOpen: false }),
  setTreeOpen: (treeOpen) => set({ treeOpen }),
  closeCareer: () =>
    set({
      save: null,
      busy: null,
      error: null,
      playerIndex: null,
      settingsOpen: false,
      treeOpen: false,
      query: "",
      highlight: 0,
    }),
}));
