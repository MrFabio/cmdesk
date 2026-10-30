import { useEffect, useRef } from "react";
import { personLabel } from "@/lib/cm/labels";
import { inMatchOver, type RankedTaker, type SetPiece } from "@/lib/cm/set-pieces";
import { useSettings } from "@/lib/cm/settings";
import { ATTRS } from "@/lib/cm/types";
import { Stat } from "./stat";

export function SetPieceView({
  piece,
  rows,
  highlight,
  onHighlight,
  onOpen,
}: {
  piece: SetPiece;
  rows: RankedTaker[];
  highlight: number;
  onHighlight: (index: number) => void;
  onOpen: (playerIndex: number) => void;
}) {
  const nameStyle = useSettings((state) => state.nameStyle);
  const scroller = useRef<HTMLDivElement>(null);
  const primaryLabel = ATTRS.find((attr) => attr.key === piece.primary)?.label ?? piece.label;

  useEffect(() => {
    const row = scroller.current?.querySelector(`[data-rank="${highlight}"]`);
    if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest" });
  }, [highlight, piece.id]);

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
      <div className="border-b border-line px-3 py-2">
        <p className="text-xs text-muted">{piece.lead}</p>
        <p className="mt-1 text-xs text-faint">
          {rows.length} outfield {rows.length === 1 ? "player" : "players"} · goalkeepers left off
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-sm text-muted">No outfield players in this squad.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5 text-xs text-faint">
            <span className="w-5 shrink-0" />
            <span className="min-w-0 flex-1">Player</span>
            <span className="w-20 shrink-0 text-right">{primaryLabel}</span>
          </div>
          <ol>
          {rows.map((row, index) => {
            const active = index === highlight;
            const over = inMatchOver(row.primary, row.engine);
            return (
              <li key={row.index}>
                <button
                  type="button"
                  data-rank={index}
                  onClick={() => {
                    onHighlight(index);
                    onOpen(row.index);
                  }}
                  className={`w-full border-b border-line px-3 py-2 text-left hover:bg-surface-2 ${active ? "bg-surface-2" : ""}`}
                >
                  <span className="flex items-baseline gap-2">
                    <span
                      className={`w-5 shrink-0 font-mono text-xs ${index === 0 ? "font-medium text-accent" : "text-faint"}`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {personLabel(row.player, nameStyle)}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted">{row.player.pos}</span>
                    <span className="w-20 shrink-0 text-right">
                      <Stat value={row.primary} kind="attr" />
                      {over !== null ? (
                        <span className="ml-1 font-mono text-xs text-faint" title="In-match value">
                          {over}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-7 text-xs text-muted">
                    {row.support.map((attr) => (
                      <span key={attr.key}>
                        {attr.label} <Stat value={attr.value} kind="attr" />
                      </span>
                    ))}
                    {piece.feet ? (
                      <span>
                        L {row.player.leftFoot} · R {row.player.rightFoot}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          </ol>
        </>
      )}
    </div>
  );
}
