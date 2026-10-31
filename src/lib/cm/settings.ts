import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CURRENCIES, WAGE_PERIODS, type CurrencyId, type WagePeriod } from "./labels.ts";

export type SortDir = "asc" | "desc";

export const PACKS = [
  { id: "classic", label: "Classic", note: "Red through blue, nearer the old match screen." },
  { id: "broadcast", label: "Broadcast", note: "A modern ramp: amber into green." },
  { id: "ink", label: "Ink", note: "Paper tones. Amber only for the very best." },
  { id: "signal", label: "Signal", note: "High contrast for a long list." },
] as const;

export type PackId = (typeof PACKS)[number]["id"];

export const THEMES = [
  { id: "broadsheet", label: "Broadsheet", note: "Paper, black ink, a red rule. The default." },
  { id: "programme", label: "Programme", note: "Cream page and a green spine." },
  { id: "floodlight", label: "Floodlight", note: "Cold night. Red only as the mark." },
  { id: "ledger", label: "Ledger", note: "Grey file with a navy accent." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const COLUMN_DEFS = [
  { id: "name", label: "Name", locked: true },
  { id: "pos", label: "Position", locked: false },
  { id: "rating", label: "Rating", locked: false },
  { id: "age", label: "Age", locked: false },
  { id: "nat", label: "Nation", locked: false },
  { id: "morale", label: "Morale", locked: false },
  { id: "condition", label: "Condition", locked: false },
  { id: "club", label: "Club", locked: false },
  { id: "ca", label: "Ability", locked: false },
  { id: "pa", label: "Potential", locked: false },
  { id: "value", label: "Value", locked: false },
  { id: "wage", label: "Wage", locked: false },
  { id: "expires", label: "Contract", locked: false },
  { id: "status", label: "Status", locked: false },
] as const;

export type ColumnId = (typeof COLUMN_DEFS)[number]["id"];

export const MUTE_STOPS = [0, 8, 11, 15] as const;
export type MuteBelow = (typeof MUTE_STOPS)[number];

function defaultColumns(): Record<ColumnId, boolean> {
  return Object.fromEntries(COLUMN_DEFS.map((column) => [column.id, true])) as Record<ColumnId, boolean>;
}

/** Bumped when a new column should turn on without wiping the rest. */
const COLUMNS_REV = 2;

type Persisted = {
  theme: ThemeId;
  pack: PackId;
  showPa: boolean;
  nameStyle: "common" | "full";
  density: "compact" | "comfortable";
  columns: Record<ColumnId, boolean>;
  columnsRev: number;
  hideGkOutfield: boolean;
  muteBelow: MuteBelow;
  rememberSort: boolean;
  currency: CurrencyId;
  wagePeriod: WagePeriod;
  sortKey: ColumnId;
  sortDir: SortDir;
};

type Settings = Persisted & {
  setPack: (pack: PackId) => void;
  setTheme: (theme: ThemeId) => void;
  setShowPa: (showPa: boolean) => void;
  setNameStyle: (nameStyle: "common" | "full") => void;
  setDensity: (density: "compact" | "comfortable") => void;
  setColumn: (id: ColumnId, on: boolean) => void;
  setHideGkOutfield: (hideGkOutfield: boolean) => void;
  setMuteBelow: (muteBelow: MuteBelow) => void;
  setRememberSort: (rememberSort: boolean) => void;
  setCurrency: (currency: CurrencyId) => void;
  setWagePeriod: (wagePeriod: WagePeriod) => void;
  setSavedSort: (sortKey: ColumnId, sortDir: SortDir) => void;
  reset: () => void;
};

const initial: Persisted = {
  theme: "broadsheet",
  pack: "classic",
  showPa: true,
  nameStyle: "common",
  density: "comfortable",
  columns: defaultColumns(),
  columnsRev: COLUMNS_REV,
  hideGkOutfield: false,
  muteBelow: 0,
  rememberSort: true,
  currency: "gbp",
  wagePeriod: "week",
  sortKey: "pos",
  sortDir: "asc",
};

function asTheme(value: unknown): ThemeId {
  return THEMES.some((item) => item.id === value) ? (value as ThemeId) : "broadsheet";
}

function asSortKey(value: unknown): ColumnId {
  return COLUMN_DEFS.some((column) => column.id === value) ? (value as ColumnId) : "pos";
}

function asCurrency(value: unknown): CurrencyId {
  return CURRENCIES.some((item) => item.id === value) ? (value as CurrencyId) : "gbp";
}

function asPeriod(value: unknown): WagePeriod {
  return WAGE_PERIODS.some((item) => item.id === value) ? (value as WagePeriod) : "week";
}

function asMute(value: unknown): MuteBelow {
  return MUTE_STOPS.some((stop) => stop === value) ? (value as MuteBelow) : 0;
}

/** Reads the current key, and once copies a pre-rename key across. */
export function renamedStorage(legacyKey: string) {
  const memory = {
    getItem(name: string) {
      const current = localStorage.getItem(name);
      if (current != null) return current;
      const old = localStorage.getItem(legacyKey);
      if (old == null) return null;
      localStorage.setItem(name, old);
      localStorage.removeItem(legacyKey);
      return old;
    },
    setItem(name: string, value: string) {
      localStorage.setItem(name, value);
    },
    removeItem(name: string) {
      localStorage.removeItem(name);
    },
  };
  return createJSONStorage(() => memory);
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      ...initial,
      columns: defaultColumns(),
      setPack: (pack) => set({ pack }),
      setTheme: (theme) => set({ theme }),
      setShowPa: (showPa) => set({ showPa }),
      setNameStyle: (nameStyle) => set({ nameStyle }),
      setDensity: (density) => set({ density }),
      setColumn: (id, on) =>
        set((state) => ({
          columns: { ...state.columns, [id]: id === "name" ? true : on },
        })),
      setHideGkOutfield: (hideGkOutfield) => set({ hideGkOutfield }),
      setMuteBelow: (muteBelow) => set({ muteBelow }),
      setRememberSort: (rememberSort) => set({ rememberSort }),
      setCurrency: (currency) => set({ currency }),
      setWagePeriod: (wagePeriod) => set({ wagePeriod }),
      setSavedSort: (sortKey, sortDir) => set({ sortKey, sortDir }),
      reset: () => set({ ...initial, columns: defaultColumns() }),
    }),
    {
      name: "cmdesk-settings",
      version: 5,
      storage: renamedStorage("savedesk-settings"),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<Persisted>;
        if (version < 2) {
          state.columns = { ...defaultColumns(), ...state.columns, name: true, value: true };
        }
        if (version < 5) {
          state.columns = defaultColumns();
          state.columnsRev = COLUMNS_REV;
        }
        return state as Persisted;
      },
      partialize: (state) => ({
        theme: state.theme,
        pack: state.pack,
        showPa: state.showPa,
        nameStyle: state.nameStyle,
        density: state.density,
        columns: state.columns,
        columnsRev: state.columnsRev,
        hideGkOutfield: state.hideGkOutfield,
        muteBelow: state.muteBelow,
        rememberSort: state.rememberSort,
        currency: state.currency,
        wagePeriod: state.wagePeriod,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Persisted>;
        const columns = { ...defaultColumns(), ...saved.columns, name: true };
        if ((saved.columnsRev ?? 0) < 1) {
          for (const column of COLUMN_DEFS) columns[column.id] = true;
        }
        if ((saved.columnsRev ?? 0) < COLUMNS_REV) columns.rating = true;
        return {
          ...current,
          ...saved,
          columns,
          columnsRev: COLUMNS_REV,
          theme: asTheme(saved.theme ?? current.theme),
          muteBelow: asMute(saved.muteBelow ?? current.muteBelow),
          sortKey: asSortKey(saved.sortKey ?? current.sortKey),
          sortDir: saved.sortDir === "desc" ? "desc" : saved.sortDir === "asc" ? "asc" : current.sortDir,
          hideGkOutfield: saved.hideGkOutfield ?? current.hideGkOutfield,
          rememberSort: saved.rememberSort ?? current.rememberSort,
          currency: asCurrency(saved.currency ?? current.currency),
          wagePeriod: asPeriod(saved.wagePeriod ?? current.wagePeriod),
        };
      },
    },
  ),
);
