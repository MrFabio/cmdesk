import { useMemo } from "react";
import { clubSizes } from "@/lib/cm/players";
import type { Place } from "@/lib/cm/store";
import type { ParsedSave } from "@/lib/cm/types";
import { ClubSelect, clubOptions } from "./club-select";

export function Sidebar({
  save,
  place,
  filterCount,
  onClub,
  onSetHumanClub,
  onFree,
  onSearch,
}: {
  save: ParsedSave;
  place: Place;
  filterCount: number;
  onClub: (clubId: number) => void;
  onSetHumanClub: (clubId: number) => void;
  onFree: () => void;
  onSearch: () => void;
}) {
  const counts = useMemo(() => clubSizes(save.roster), [save]);

  const clubs = useMemo(() => clubOptions(save), [save]);
  const human = save.clubs.find((club) => club.id === save.humanClubId) ?? null;
  const viewing =
    place.kind === "club" ? (save.clubs.find((club) => club.id === place.clubId) ?? null) : null;
  const searchOn = place.kind === "search";
  const canMarkYours = viewing !== null && viewing.id !== human?.id;

  return (
    <nav className="min-h-0 w-full flex-1 overflow-y-auto py-2" aria-label="Clubs">
      <p className="px-3 pt-2 pb-1 text-xs text-faint">Career</p>
      {human ? (
        <NavButton
          active={place.kind === "club" && place.clubId === human.id}
          onClick={() => onClub(human.id)}
          label={human.name}
          mark="Your club"
          count={counts.get(human.id) ?? 0}
        />
      ) : (
        <p className="px-3 py-2 text-sm text-muted">No club marked as yours yet.</p>
      )}
      <NavButton
        active={place.kind === "free"}
        onClick={onFree}
        label="Free agents"
        count={save.roster.freePlayers.length}
      />
      <NavButton
        active={searchOn}
        onClick={onSearch}
        label={filterCount ? `Search · ${filterCount}` : "Search"}
        count={save.roster.count}
      />

      <p className="mt-3 px-3 pb-1 text-xs text-faint">Clubs</p>
      <ClubSelect
        clubs={clubs}
        value={viewing}
        label="Open club"
        placeholder="Search clubs"
        onPick={onClub}
      />
      {canMarkYours ? (
        <button
          type="button"
          className="mx-3 mt-1 mb-1 h-9 w-[calc(100%-1.5rem)] rounded-sm border border-line text-xs text-muted hover:bg-surface-2 hover:text-fg"
          onClick={() => onSetHumanClub(viewing.id)}
        >
          Set {viewing.name} as your club
        </button>
      ) : null}
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  label,
  count,
  mark,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  mark?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-surface-2 ${active ? "border-l-2 border-accent bg-surface-2 pl-2.5 text-fg" : "text-muted"}`}
      aria-current={active ? "page" : undefined}
    >
      <span className="min-w-0 truncate">
        {label}
        {mark ? <span className="ml-2 text-xs text-accent">{mark}</span> : null}
      </span>
      <span className="font-mono text-xs text-faint">{count}</span>
    </button>
  );
}
