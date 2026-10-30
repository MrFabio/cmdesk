import { useEffect, useRef } from "react";
import { personLabel } from "@/lib/cm/labels";
import type { MatchLineup, MatchSpot } from "@/lib/cm/match";
import type { TacticSlot } from "@/lib/cm/types";
import { useSettings } from "@/lib/cm/settings";
import { PitchOutline } from "./pitch";

function place(row: number, col: number, nudge: number): { x: number; y: number } {
  return {
    x: 12 + col * 19 + nudge,
    y: 88 - row * 12.2,
  };
}

export function MatchView({
  lineup,
  highlight,
  onHighlight,
  onOpen,
}: {
  lineup: MatchLineup;
  highlight: number;
  onHighlight: (index: number) => void;
  onOpen: (playerIndex: number) => void;
}) {
  const nameStyle = useSettings((state) => state.nameStyle);
  const scroller = useRef<HTMLDivElement>(null);
  const shape = lineup.tactic?.slots ?? null;

  useEffect(() => {
    const row = scroller.current?.querySelector(`[data-rank="${highlight}"]`);
    if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest" });
  }, [highlight, lineup.tactic?.id]);

  function open(spot: MatchSpot, rank: number) {
    onHighlight(rank);
    onOpen(spot.index);
  }

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
      {lineup.empty ? (
        <p className="px-3 py-8 text-sm text-muted">
          No picked team is stored for this club. The full squad is on the Squad tab.
        </p>
      ) : !shape ? (
        <SquadList
          spots={lineup.list}
          highlight={highlight}
          nameStyle={nameStyle}
          note="The shape is not in this save."
          onOpen={open}
        />
      ) : (
        <div className="px-3 py-3">
          {lineup.tactic?.name ? (
            <p className="mb-2 text-xs text-muted">{lineup.tactic.name}</p>
          ) : null}
          <div className="relative mx-auto w-full max-w-sm">
            <PitchOutline orientation="portrait" label="Match pitch" />
            <Dots
              lineup={lineup}
              slots={shape}
              highlight={highlight}
              nameStyle={nameStyle}
              onOpen={open}
            />
          </div>
          {lineup.bench.length > 0 ? (
            <div className="mx-auto mt-4 w-full max-w-sm">
              <p className="mb-1 text-xs text-faint">Bench</p>
              <SquadList
                spots={lineup.bench}
                highlight={highlight}
                nameStyle={nameStyle}
                inset={false}
                rankOf={(spot) => lineup.list.indexOf(spot)}
                onOpen={open}
              />
            </div>
          ) : null}
        </div>
      )}
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
