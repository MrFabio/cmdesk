import { create } from "zustand";
import { emptyFilters, type Filters, type SortDir, type SortKey } from "./query.ts";
import type { ParsedSave, ProgressUpdate } from "./types.ts";

type ClubMark = { id: number; name: string };

const CLUB_KEY = "cmdesk-club";

function pickedClub(previous: { humanClubId: number; clubs: ClubMark[] } | ClubMark | null): ClubMark | null {
  if (!previous) return null;
  if ("clubs" in previous) {
    if (previous.humanClubId < 0) return null;
    const club = previous.clubs.find((row) => row.id === previous.humanClubId);
    return club ? { id: club.id, name: club.name } : null;
  }
  if (previous.id < 0 || !previous.name) return null;
  return { id: previous.id, name: previous.name };
}

/** The club marked as yours, when the next file still contains that same club. */
export function keptHumanClub(
  previous: { humanClubId: number; clubs: ClubMark[] } | ClubMark | null,
  next: { clubs: ClubMark[] },
): number | null {
  const picked = pickedClub(previous);
  if (!picked) return null;
  const again = next.clubs.find((club) => club.id === picked.id && club.name === picked.name);
  return again ? again.id : null;
}

export function readKeptClub(): ClubMark | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLUB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClubMark>;
    if (typeof parsed.id !== "number" || !Number.isInteger(parsed.id) || parsed.id < 0) return null;
    if (typeof parsed.name !== "string" || !parsed.name) return null;
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}

function writeKeptClub(club: ClubMark) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLUB_KEY, JSON.stringify({ id: club.id, name: club.name }));
  } catch {
    // Storage can be blocked. The open career still shows the club.
  }
}

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
    set((state) => {
      const kept = keptHumanClub(state.save, save) ?? keptHumanClub(readKeptClub(), save);
      const next = kept == null ? save : { ...save, humanClubId: kept };
      const clubId = next.humanClubId >= 0 ? next.humanClubId : (next.clubs[0]?.id ?? -1);
      return {
        save: next,
        busy: null,
        error: null,
        place: clubId >= 0 ? { kind: "club" as const, clubId } : { kind: "free" as const },
        playerIndex: null,
        settingsOpen: false,
        treeOpen: false,
        query: "",
        filters: emptyFilters(),
        highlight: 0,
      };
    }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error, busy: null }),
  showClub: (clubId) =>
    set({ place: { kind: "club", clubId }, query: "", playerIndex: null, highlight: 0, treeOpen: false, settingsOpen: false }),
  setHumanClub: (clubId) =>
    set((state) => {
      if (!state.save) return state;
      const club = state.save.clubs.find((row) => row.id === clubId);
      if (club) writeKeptClub({ id: club.id, name: club.name });
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
