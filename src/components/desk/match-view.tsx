import { useEffect, useMemo, useRef } from "react";
import { bandOf, conditionText, injurySpan, personLabel } from "@/lib/cm/labels";
import type { MatchLineup, MatchSpot } from "@/lib/cm/match";
import { attrOf } from "@/lib/cm/parse";
import { roleRating, type RoleRating } from "@/lib/cm/positions";
import type { MatchSuggestion, SuggestedPick } from "@/lib/cm/suggest";
import type { ParsedSave, TacticSlot } from "@/lib/cm/types";
import { useSettings } from "@/lib/cm/settings";
import { PitchOutline } from "./pitch";
import { MoraleText, Stat } from "./stat";
import { InjuryTag } from "./status-pills";
import { chipClass } from "./ui";

const boardWidth = "mx-auto w-full max-w-4xl";
const pitchFrame = "relative mx-auto w-full max-w-2xl @container";
const pitchStat = "font-mono text-[10px] leading-tight @min-[28rem]:text-xs @min-[48rem]:text-sm";

function place(row: number, col: number, nudge: number): { x: number; y: number } {
  return {
    x: 12 + col * 19 + nudge,
    y: 88 - row * 12.2,
  };
}

export function MatchView({
  save,
  lineup,
  suggestion,
  mode,
  onMode,
  highlight,
  onHighlight,
  onOpen,
}: {
  save: ParsedSave;
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
  const ratings = useMemo(() => rateSpots(save, shown.list), [save, shown.list]);

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
          ratings={ratings}
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
          ratings={ratings}
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
          <div className={pitchFrame}>
            <PitchOutline orientation="portrait" label="Match pitch" />
            <Dots
              lineup={shown}
              slots={shape}
              ratings={ratings}
              highlight={highlight}
              nameStyle={nameStyle}
              onOpen={open}
            />
          </div>
          {shown.bench.length > 0 ? (
            <div className={`mt-4 ${boardWidth}`}>
              <p className="mb-1 text-xs text-faint">Bench</p>
              <SquadList
                spots={shown.bench}
                ratings={ratings}
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

function rateSpots(save: ParsedSave, spots: MatchSpot[]): Map<number, RoleRating | null> {
  const ratings = new Map<number, RoleRating | null>();
  for (const spot of spots) {
    if (ratings.has(spot.index)) continue;
    ratings.set(
      spot.index,
      roleRating(spot.player.posMask, spot.player.sideMask, (key) => attrOf(save, spot.index, key)),
    );
  }
  return ratings;
}

function toSpot(pick: SuggestedPick, squadIndex: number): MatchSpot {
  return { index: pick.index, player: pick.player, squadIndex };
}

function SuggestedBoard({
  suggestion,
  lineup,
  ratings,
  highlight,
  nameStyle,
  onOpen,
}: {
  suggestion: MatchSuggestion;
  lineup: MatchLineup;
  ratings: Map<number, RoleRating | null>;
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
          <div className={pitchFrame}>
            <PitchOutline orientation="portrait" label="Suggested pitch" />
            <Dots
              lineup={lineup}
              slots={shape}
              ratings={ratings}
              highlight={highlight}
              nameStyle={nameStyle}
              onOpen={onOpen}
              naturalOf={(spot) => meta.get(spot.index)?.natural}
            />
          </div>
          <SuggestedList
            title="Starts"
            spots={lineup.pitch.filter((spot) => spot !== null)}
            meta={meta}
            ratings={ratings}
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
              ratings={ratings}
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
  ratings,
  highlight,
  nameStyle,
  rankOf,
  onOpen,
}: {
  title: string;
  spots: MatchSpot[];
  meta: Map<number, SuggestedPick>;
  ratings: Map<number, RoleRating | null>;
  highlight: number;
  nameStyle: "common" | "full";
  rankOf: (spot: MatchSpot) => number;
  onOpen: (spot: MatchSpot, rank: number) => void;
}) {
  return (
    <div className={`mt-4 ${boardWidth}`}>
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
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="truncate font-medium">{personLabel(spot.player, nameStyle)}</span>
                  <InjuryTag days={spot.player.injuryDays} />
                </span>
                <span className={`shrink-0 font-mono text-xs ${pick && !pick.natural ? "text-secondary" : "text-muted"}`}>
                  {spot.player.pos}
                  {pick && !pick.natural ? " · out" : ""}
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-muted">{conditionText(spot.player.condition)}</span>
                <MoraleText value={spot.player.morale} compact />
                <AgeAbility player={spot.player} rating={ratings.get(spot.index) ?? null} />
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
  ratings,
  highlight,
  nameStyle,
  onOpen,
  naturalOf,
}: {
  lineup: MatchLineup;
  slots: TacticSlot[];
  ratings: Map<number, RoleRating | null>;
  highlight: number;
  nameStyle: "common" | "full";
  onOpen: (spot: MatchSpot, rank: number) => void;
  naturalOf?: (spot: MatchSpot) => boolean | undefined;
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
            rating={ratings.get(spot.index) ?? null}
            natural={naturalOf?.(spot)}
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
  rating,
  natural,
  onOpen,
}: {
  spot: MatchSpot;
  rank: number;
  active: boolean;
  x: number;
  y: number;
  name: string;
  rating: RoleRating | null;
  natural?: boolean;
  onOpen: (spot: MatchSpot, rank: number) => void;
}) {
  const number = spot.player.squadNo > 0 ? String(spot.player.squadNo) : "";
  const condition = conditionText(spot.player.condition);
  const rated = rating ? `${rating.value.toFixed(1)} ${rating.slot}` : "–";
  return (
    <button
      type="button"
      data-rank={rank}
      title={`${name}, ${rated}, CA ${spot.player.ca}, ${spot.player.injuryDays >= 1 ? injurySpan(spot.player.injuryDays) : condition}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={() => onOpen(spot, rank)}
      className={`absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center @min-[28rem]:w-20 @min-[36rem]:w-24 @min-[48rem]:w-32 ${active ? "z-10" : ""}`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-accent font-mono text-xs font-medium text-accent-ink @min-[28rem]:h-8 @min-[28rem]:w-8 @min-[48rem]:h-10 @min-[48rem]:w-10 @min-[48rem]:text-sm ${active ? "outline outline-2 outline-offset-2 outline-fg" : ""}`}
      >
        {number}
      </span>
      <span className="mt-0.5 max-w-full truncate text-center text-[10px] leading-tight text-fg @min-[28rem]:text-xs @min-[48rem]:text-sm">
        {name}
      </span>
      <AgeAbility player={spot.player} rating={rating} pitch />
      {spot.player.injuryDays >= 1 ? (
        <InjuryTag days={spot.player.injuryDays} />
      ) : (
        <span className={`${pitchStat} text-muted`}>{condition}</span>
      )}
      <span className={pitchStat}>
        <MoraleText value={spot.player.morale} compact />
      </span>
      {natural === false ? <span className={`${pitchStat} text-secondary`}>out</span> : null}
    </button>
  );
}

function AgeAbility({
  player,
  rating,
  pitch = false,
}: {
  player: MatchSpot["player"];
  rating: RoleRating | null;
  pitch?: boolean;
}) {
  const band = rating ? bandOf(rating.value) : null;
  const title = rating ? `${rating.slot} · ${rating.attrs.join(", ")}` : undefined;
  return (
    <span
      title={title}
      className={`shrink-0 text-center font-mono leading-tight ${pitch ? "text-[10px] @min-[28rem]:text-xs @min-[48rem]:text-sm" : "text-xs"}`}
    >
      {rating ? <span className={band ? `attr-b${band}` : undefined}>{rating.value.toFixed(1)}</span> : <span className="text-faint">–</span>}
      <span className="text-faint"> · </span>
      <Stat value={player.ca} kind="ability" />
    </span>
  );
}

function SquadList({
  spots,
  ratings,
  highlight,
  nameStyle,
  note,
  inset = true,
  rankOf,
  onOpen,
}: {
  spots: MatchSpot[];
  ratings: Map<number, RoleRating | null>;
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
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="truncate font-medium">{personLabel(spot.player, nameStyle)}</span>
                  <InjuryTag days={spot.player.injuryDays} />
                </span>
                <span className="shrink-0 font-mono text-xs text-muted">{spot.player.pos}</span>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-muted">{conditionText(spot.player.condition)}</span>
                <MoraleText value={spot.player.morale} compact />
                <AgeAbility player={spot.player} rating={ratings.get(spot.index) ?? null} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
