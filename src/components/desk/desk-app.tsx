import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Menu, Search, Settings } from "lucide-react";
import { buildSample } from "@/lib/cm/sample";
import { loadSave } from "@/lib/cm/load";
import { buildLookups, money } from "@/lib/cm/labels";
import { activeFilterCount, defaultSortDir, freeAgents, searchPlayers, sortHits, squadOf } from "@/lib/cm/query";
import { useDesk } from "@/lib/cm/store";
import { useSettings } from "@/lib/cm/settings";
import type { ColumnId } from "@/lib/cm/settings";
import { FilterBar } from "./filters";
import { OpenView } from "./open-view";
import { PlayerView } from "./player-view";
import { SettingsView } from "./settings-view";
import { Sidebar } from "./sidebar";
import { SquadTable } from "./squad-table";
import { button, control } from "./ui";

export function DeskApp() {
  const save = useDesk((state) => state.save);
  const busy = useDesk((state) => state.busy);
  const error = useDesk((state) => state.error);
  const place = useDesk((state) => state.place);
  const playerIndex = useDesk((state) => state.playerIndex);
  const settingsOpen = useDesk((state) => state.settingsOpen);
  const treeOpen = useDesk((state) => state.treeOpen);
  const query = useDesk((state) => state.query);
  const filters = useDesk((state) => state.filters);
  const sortKey = useDesk((state) => state.sortKey);
  const sortDir = useDesk((state) => state.sortDir);
  const highlight = useDesk((state) => state.highlight);
  const openSave = useDesk((state) => state.openSave);
  const setBusy = useDesk((state) => state.setBusy);
  const setError = useDesk((state) => state.setError);
  const showClub = useDesk((state) => state.showClub);
  const setHumanClub = useDesk((state) => state.setHumanClub);
  const showFree = useDesk((state) => state.showFree);
  const showSearch = useDesk((state) => state.showSearch);
  const setQuery = useDesk((state) => state.setQuery);
  const patchFilters = useDesk((state) => state.patchFilters);
  const resetFilters = useDesk((state) => state.resetFilters);
  const applySearch = useDesk((state) => state.applySearch);
  const setSort = useDesk((state) => state.setSort);
  const openPlayer = useDesk((state) => state.openPlayer);
  const closePlayer = useDesk((state) => state.closePlayer);
  const setHighlight = useDesk((state) => state.setHighlight);
  const setSettingsOpen = useDesk((state) => state.setSettingsOpen);
  const setTreeOpen = useDesk((state) => state.setTreeOpen);
  const closeCareer = useDesk((state) => state.closeCareer);

  const pack = useSettings((state) => state.pack);
  const theme = useSettings((state) => state.theme);
  const showPa = useSettings((state) => state.showPa);
  const currency = useSettings((state) => state.currency);
  const wagePeriod = useSettings((state) => state.wagePeriod);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [warnOn, setWarnOn] = useState(true);

  useEffect(() => {
    const apply = () => {
      const settings = useSettings.getState();
      document.documentElement.dataset.pack = settings.pack;
      document.documentElement.dataset.theme = settings.theme;
      if (!settings.rememberSort) return;
      const desk = useDesk.getState();
      if (desk.sortKey === "pos" && desk.sortDir === "asc") desk.setSort(settings.sortKey, settings.sortDir);
    };
    const unsub = useSettings.persist.onFinishHydration(apply);
    if (useSettings.persist.hasHydrated()) apply();
    return unsub;
  }, [pack, theme]);

  const lookups = useMemo(() => (save ? buildLookups(save) : null), [save]);
  const rows = useMemo(() => {
    if (!save || !lookups) return [];
    const hits =
      place.kind === "club"
        ? squadOf(save, place.clubId)
        : place.kind === "free"
          ? freeAgents(save)
          : searchPlayers(save, filters, query, { currency, wagePeriod });
    const key = sortKey === "pa" && !showPa ? "ca" : sortKey;
    const dir = sortKey === "pa" && !showPa ? "desc" : sortDir;
    return sortHits(hits, key, dir, save, lookups);
  }, [save, lookups, place, filters, query, showPa, sortKey, sortDir, currency, wagePeriod]);
  const filterCount = activeFilterCount(filters);

  function cycleSort(column: ColumnId) {
    const nextDir = sortKey === column ? (sortDir === "asc" ? "desc" : "asc") : defaultSortDir(column);
    setSort(column, nextDir);
    if (useSettings.getState().rememberSort) useSettings.getState().setSavedSort(column, nextDir);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (event.key === "/" && !typing && save) {
        event.preventDefault();
        showSearch();
        document.getElementById(window.matchMedia("(min-width: 768px)").matches ? "desk-search" : "desk-search-mobile")?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false);
        else if (playerIndex !== null) closePlayer();
        else if (treeOpen) setTreeOpen(false);
        else if (typing) target?.blur();
        return;
      }
      if (!save || typing || settingsOpen) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight(Math.min(rows.length - 1, Math.max(0, highlight) + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight(Math.max(0, highlight - 1));
      } else if (event.key === "Enter") {
        const row = rows[highlight];
        if (row) openPlayer(row.index);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, rows, highlight, settingsOpen, playerIndex, treeOpen, showSearch, setSettingsOpen, closePlayer, setTreeOpen, setHighlight, openPlayer]);

  async function take(file: File) {
    if (file.size > 120_000_000) {
      setError("That file is larger than CMdesk will open.");
      return;
    }
    setBusy({ pct: 1, label: "Reading the file" });
    setWarnOn(true);
    try {
      const buffer = await file.arrayBuffer();
      openSave(await loadSave(buffer, file.name, setBusy));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that save.");
    }
  }

  async function takeSample() {
    setBusy({ pct: 2, label: "Building the sample career" });
    setWarnOn(true);
    try {
      const buffer = buildSample(true);
      openSave(await loadSave(buffer, "Sample career.sav", setBusy));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build the sample.");
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void take(file);
  }

  if (!save || !lookups) {
    return (
      <div onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <input ref={fileRef} type="file" className="sr-only" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void take(file);
        }} />
        <OpenView busy={busy} error={error} over={over} onPick={() => fileRef.current?.click()} onSample={() => void takeSample()} />
      </div>
    );
  }

  const club = place.kind === "club" ? save.clubs.find((row) => row.id === place.clubId) : undefined;
  const showList = !settingsOpen;
  const sample = save.fileName.startsWith("Sample");

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input ref={fileRef} type="file" className="sr-only" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void take(file);
      }} />
      <header className="border-b border-line bg-surface">
        <div className="flex items-center gap-2 px-3 py-2">
          <button type="button" className={`${button} px-2 md:hidden`} onClick={() => setTreeOpen(true)} aria-label="Clubs">
            <Menu className="size-4" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">CMdesk</p>
            <p className="truncate font-mono text-xs text-faint">
              {save.gameDateLabel}
              {club ? ` · ${club.short || club.name}` : ""}
            </p>
          </div>
          <form
            className="relative ml-auto hidden min-w-0 flex-1 md:block"
            onSubmit={(event) => {
              event.preventDefault();
              const row = rows[highlight];
              if (place.kind === "search" && row) openPlayer(row.index);
              else showSearch();
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
            <input
              id="desk-search"
              className={`${control} pl-8`}
              placeholder="Search players"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={showSearch}
              aria-label="Search players"
            />
          </form>
          <button type="button" className={button} onClick={() => fileRef.current?.click()}>
            Open
          </button>
          <button type="button" className={`${button} px-2`} onClick={() => setSettingsOpen(!settingsOpen)} aria-label="Settings" aria-pressed={settingsOpen}>
            <Settings className="size-4" aria-hidden="true" />
          </button>
        </div>
        <form
          className="px-3 pb-2 md:hidden"
          onSubmit={(event) => {
            event.preventDefault();
            showSearch();
          }}
        >
          <input
            id="desk-search-mobile"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search players"
          />
        </form>
      </header>

      {busy ? (
        <div className="border-b border-line bg-surface-2 px-3 py-2" aria-live="polite">
          <div className="mb-1 flex justify-between font-mono text-xs text-muted">
            <span>{busy.label}</span>
            <span>{busy.pct}%</span>
          </div>
          <div className="h-1 bg-bg">
            <div className="h-1 bg-accent" style={{ width: `${Math.max(2, Math.min(100, busy.pct))}%` }} />
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="flex items-center justify-between gap-3 border-b border-danger px-3 py-2 text-sm text-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="text-xs underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
      {sample ? (
        <p className="border-b border-line bg-surface px-3 py-2 text-xs text-muted">
          Fictional sample career. Not a real 01/02 database.
        </p>
      ) : null}
      {warnOn && save.warnings.length ? (
        <p className="flex items-start justify-between gap-3 border-b border-line px-3 py-2 text-xs text-muted">
          <span>{save.warnings[0]}</span>
          <button type="button" className="shrink-0 underline" onClick={() => setWarnOn(false)}>
            Hide
          </button>
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {treeOpen ? (
          <button type="button" className="fixed inset-0 z-20 bg-bg md:hidden" aria-label="Close clubs" onClick={() => setTreeOpen(false)} />
        ) : null}
        <aside
          className={`${treeOpen ? "fixed inset-y-0 left-0 z-30 flex w-72" : "hidden"} min-h-0 flex-col border-r border-line bg-surface md:static md:z-0 md:flex md:w-60`}
        >
          <Sidebar
            save={save}
            place={place}
            filterCount={filterCount}
            onClub={showClub}
            onSetHumanClub={setHumanClub}
            onFree={showFree}
            onSearch={showSearch}
          />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1">
          {settingsOpen ? <SettingsView onClose={() => setSettingsOpen(false)} /> : null}
          {showList ? (
            <section className={`flex min-h-0 min-w-0 flex-1 flex-col ${playerIndex !== null ? "max-xl:hidden" : ""}`}>
              {place.kind === "search" ? (
                <FilterBar
                  save={save}
                  filters={filters}
                  showPa={showPa}
                  count={rows.length}
                  query={query}
                  onChange={patchFilters}
                  onReset={resetFilters}
                  onApply={applySearch}
                />
              ) : (
                <div className="border-b border-line px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-base font-semibold">
                        {place.kind === "free" ? "Free agents" : club?.name ?? "Squad"}
                        {place.kind === "club" && club && club.id === save.humanClubId ? (
                          <span className="ml-2 text-xs font-normal text-accent">Your club</span>
                        ) : null}
                      </h1>
                      <p className="mt-1 text-xs text-muted">
                        {place.kind === "free"
                          ? `${rows.length} without a club`
                          : club
                            ? `${lookups.nation(club.nationId)} · ${lookups.compName(club.divisionId)}${club.manager ? ` · ${club.manager}` : ""} · ${money(club.cash, currency)} · ${rows.length} players`
                            : `${rows.length} players`}
                      </p>
                    </div>
                    {place.kind === "club" && club && club.id !== save.humanClubId ? (
                      <button type="button" className={`${button} shrink-0 text-xs`} onClick={() => setHumanClub(club.id)}>
                        Set as your club
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
              <SquadTable
                save={save}
                rows={rows}
                lookups={lookups}
                showClub={place.kind !== "club"}
                highlight={highlight}
                sortKey={sortKey}
                sortDir={sortDir}
                onHighlight={setHighlight}
                onOpen={openPlayer}
                onSort={cycleSort}
              />
            </section>
          ) : null}
          {playerIndex !== null && !settingsOpen ? (
            <div className="min-h-0 w-full border-line bg-bg xl:w-2/5 xl:max-w-xl xl:border-l">
              <PlayerView save={save} index={playerIndex} onClose={closePlayer} onClub={showClub} />
            </div>
          ) : null}
        </div>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-line px-3 py-1.5 text-xs text-faint">
        <span className="min-w-0 truncate">/ search · Enter opens · Esc back · file stays on this computer</span>
        <button type="button" className="shrink-0 underline" onClick={closeCareer}>
          Close file
        </button>
      </footer>
    </div>
  );
}
