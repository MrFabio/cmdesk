import { useEffect, useRef } from "react";
import { conditionText, personLabel } from "@/lib/cm/labels";
import type { MatchLineup, MatchSpot } from "@/lib/cm/match";
import type { MatchSuggestion, SuggestedPick } from "@/lib/cm/suggest";
import type { TacticSlot } from "@/lib/cm/types";
import { useSettings } from "@/lib/cm/settings";
import { PitchOutline } from "./pitch";
import { MoraleText } from "./stat";
import { chipClass } from "./ui";

function place(row: number, col: number, nudge: number): { x: number; y: number } {
  return {
    x: 12 + col * 19 + nudge,
    y: 88 - row * 12.2,
  };
}

export function MatchView({
  lineup,
  suggestion,
  mode,
  onMode,
  highlight,
  onHighlight,
  onOpen,
}: {
  lineup: MatchLineup;
  suggestion: MatchSuggestion | null;
  mode: "picked" | "suggested";
  onMode: (mode: "picked" | "suggested") => void;
  highlight: number;
  onHighlight: (index: number) => void;
  onOpen: (playerIndex: number) => void;
}) {
  const nameStyle = useSettings((state) => state.nameStyle);
  const scroller = useRef<HTMLDivElement>(null);
  const shown = mode === "suggested" && suggestion ? suggestionLineup(suggestion) : lineup;
  const shape = shown.tactic?.slots ?? null;

  useEffect(() => {
    const row = scroller.current?.querySelector(`[data-rank="${highlight}"]`);
    if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest" });
  }, [highlight, shown.tactic?.id, mode]);

  function open(spot: MatchSpot, rank: number) {
    onHighlight(rank);
    onOpen(spot.index);
  }

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
      <div className="flex gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Match team">
        <button type="button" role="tab" aria-selected={mode === "picked"} className={chipClass(mode === "picked")} onClick={() => onMode("picked")}>
          Picked
        </button>
        <button type="button" role="tab" aria-selected={mode === "suggested"} className={chipClass(mode === "suggested")} onClick={() => onMode("suggested")}>
          Suggested
        </button>
      </div>
      {mode === "suggested" && suggestion ? (
        <SuggestedBoard
          suggestion={suggestion}
          lineup={shown}
          highlight={highlight}
          nameStyle={nameStyle}
          onOpen={open}
        />
      ) : shown.empty ? (
        <p className="px-3 py-8 text-sm text-muted">
          No picked team is stored for this club. Suggested picks a side from the squad.
        </p>
      ) : !shape ? (
        <SquadList
          spots={shown.list}
          highlight={highlight}
          nameStyle={nameStyle}
          note="The shape is not in this save."
          onOpen={open}
        />
      ) : (
        <div className="px-3 py-3">
          {shown.tactic?.name ? (
            <p className="mb-2 text-xs text-muted">{shown.tactic.name}</p>
          ) : null}
          <div className="relative mx-auto w-full max-w-sm">
            <PitchOutline orientation="portrait" label="Match pitch" />
            <Dots
              lineup={shown}
              slots={shape}
              highlight={highlight}
              nameStyle={nameStyle}
              onOpen={open}
            />
          </div>
          {shown.bench.length > 0 ? (
            <div className="mx-auto mt-4 w-full max-w-sm">
              <p className="mb-1 text-xs text-faint">Bench</p>
              <SquadList
                spots={shown.bench}
                highlight={highlight}
                nameStyle={nameStyle}
                inset={false}
                rankOf={(spot) => shown.list.indexOf(spot)}
                onOpen={open}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function suggestionLineup(suggestion: MatchSuggestion): MatchLineup {
  const pitch = suggestion.pitch.map((pick, squadIndex) => (pick ? toSpot(pick, squadIndex) : null));
  const bench = suggestion.bench.map((pick, index) => toSpot(pick, 11 + index));
  const list = [...pitch, ...bench].filter((spot) => spot !== null);
  return {
    empty: list.length === 0,
    tactic: { id: -2, name: suggestion.shapeName, slots: suggestion.slots },
    pitch,
    bench,
    list,
  };
}

function toSpot(pick: SuggestedPick, squadIndex: number): MatchSpot {
  return { index: pick.index, player: pick.player, squadIndex };
}

function SuggestedBoard({
  suggestion,
  lineup,
  highlight,
  nameStyle,
  onOpen,
}: {
  suggestion: MatchSuggestion;
  lineup: MatchLineup;
  highlight: number;
  nameStyle: "common" | "full";
  onOpen: (spot: MatchSpot, rank: number) => void;
}) {
  const shape = suggestion.slots;
  const meta = new Map<number, SuggestedPick>();
  for (const pick of suggestion.pitch) if (pick) meta.set(pick.index, pick);
  for (const pick of suggestion.bench) meta.set(pick.index, pick);
  return (
    <div className="px-3 py-3">
      <p className="mb-2 text-xs text-muted">
        {suggestion.fallbackShape
          ? "No shape is stored, so this is a 4-4-2. "
          : suggestion.shapeName
            ? `${suggestion.shapeName}. `
            : ""}
        Attributes, condition, morale, and consistency. Under 90% condition is marked down. Recent ratings are not in the save.
      </p>
      {lineup.empty ? (
        <p className="py-8 text-sm text-muted">No players in this squad.</p>
      ) : (
        <>
          <div className="relative mx-auto w-full max-w-sm">
            <PitchOutline orientation="portrait" label="Suggested pitch" />
            <Dots lineup={lineup} slots={shape} highlight={highlight} nameStyle={nameStyle} onOpen={onOpen} />
          </div>
          <SuggestedList
            title="Starts"
            spots={lineup.pitch.filter((spot) => spot !== null)}
            meta={meta}
            highlight={highlight}
            nameStyle={nameStyle}
            rankOf={(spot) => lineup.list.indexOf(spot)}
            onOpen={onOpen}
          />
          {lineup.bench.length > 0 ? (
            <SuggestedList
              title="Bench"
              spots={lineup.bench}
              meta={meta}
              highlight={highlight}
              nameStyle={nameStyle}
              rankOf={(spot) => lineup.list.indexOf(spot)}
              onOpen={onOpen}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function SuggestedList({
  title,
  spots,
  meta,
  highlight,
  nameStyle,
  rankOf,
  onOpen,
}: {
  title: string;
  spots: MatchSpot[];
  meta: Map<number, SuggestedPick>;
  highlight: number;
  nameStyle: "common" | "full";
  rankOf: (spot: MatchSpot) => number;
  onOpen: (spot: MatchSpot, rank: number) => void;
}) {
  return (
    <div className="mx-auto mt-4 w-full max-w-sm">
      <p className="mb-1 text-xs text-faint">{title}</p>
      <ul>
        {spots.map((spot) => {
          const rank = rankOf(spot);
          const pick = meta.get(spot.index);
          const active = rank === highlight;
          return (
            <li key={spot.squadIndex}>
              <button
                type="button"
                data-rank={rank}
                onClick={() => onOpen(spot, rank)}
                className={`flex w-full items-baseline gap-2 border-b border-line py-2 text-left hover:bg-surface-2 ${active ? "bg-surface-2" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{personLabel(spot.player, nameStyle)}</span>
                <span className={`shrink-0 font-mono text-xs ${pick && !pick.natural ? "text-secondary" : "text-muted"}`}>
                  {spot.player.pos}
                  {pick && !pick.natural ? " · out" : ""}
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-muted">{conditionText(spot.player.condition)}</span>
                <MoraleText value={spot.player.morale} compact />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Dots({
  lineup,
  slots,
  highlight,
  nameStyle,
  onOpen,
}: {
  lineup: MatchLineup;
  slots: TacticSlot[];
  highlight: number;
  nameStyle: "common" | "full";
  onOpen: (spot: MatchSpot, rank: number) => void;
}) {
  const used = new Map<string, number>();
  return (
    <>
      {lineup.pitch.map((spot, slot) => {
        if (!spot) return null;
        const circle = slots[slot];
        if (!circle) return null;
        const key = `${circle.row}:${circle.col}`;
        const nudge = used.get(key) ?? 0;
        used.set(key, nudge + 1);
        const point = place(circle.row, circle.col, nudge === 0 ? 0 : nudge % 2 === 1 ? 5 : -5);
        const rank = lineup.list.indexOf(spot);
        return (
          <PlayerDot
            key={spot.squadIndex}
            spot={spot}
            rank={rank}
            active={rank === highlight}
            x={point.x}
            y={point.y}
            name={personLabel(spot.player, nameStyle)}
            onOpen={onOpen}
          />
        );
      })}
    </>
  );
}

function PlayerDot({
  spot,
  rank,
  active,
  x,
  y,
  name,
  onOpen,
}: {
  spot: MatchSpot;
  rank: number;
  active: boolean;
  x: number;
  y: number;
  name: string;
  onOpen: (spot: MatchSpot, rank: number) => void;
}) {
  const number = spot.player.squadNo > 0 ? String(spot.player.squadNo) : "";
  return (
    <button
      type="button"
      data-rank={rank}
      title={name}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={() => onOpen(spot, rank)}
      className={`absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center ${active ? "z-10" : ""}`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-accent font-mono text-xs font-medium text-accent-ink ${active ? "outline outline-2 outline-offset-2 outline-fg" : ""}`}
      >
        {number}
      </span>
      <span className="mt-0.5 max-w-full truncate text-center text-[10px] leading-tight text-fg">{name}</span>
    </button>
  );
}

function SquadList({
  spots,
  highlight,
  nameStyle,
  note,
  inset = true,
  rankOf,
  onOpen,
}: {
  spots: MatchSpot[];
  highlight: number;
  nameStyle: "common" | "full";
  note?: string;
  inset?: boolean;
  rankOf?: (spot: MatchSpot) => number;
  onOpen: (spot: MatchSpot, rank: number) => void;
}) {
  return (
    <div>
      {note ? <p className="border-b border-line px-3 py-2 text-xs text-muted">{note}</p> : null}
      <ul>
        {spots.map((spot, index) => {
          const rank = rankOf ? rankOf(spot) : index;
          const active = rank === highlight;
          const number = spot.player.squadNo > 0 ? spot.player.squadNo : "";
          return (
            <li key={spot.squadIndex}>
              <button
                type="button"
                data-rank={rank}
                onClick={() => onOpen(spot, rank)}
                className={`flex w-full items-baseline gap-2 border-b border-line py-2 text-left hover:bg-surface-2 ${inset ? "px-3" : ""} ${active ? "bg-surface-2" : ""}`}
              >
                <span className="w-6 shrink-0 font-mono text-xs text-faint">{number}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{personLabel(spot.player, nameStyle)}</span>
                <span className="shrink-0 font-mono text-xs text-muted">{spot.player.pos}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
