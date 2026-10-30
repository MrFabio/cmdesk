import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Hit, SortDir, SortKey } from "@/lib/cm/query";
import { conditionText, money, personLabel, wageText, type Lookups } from "@/lib/cm/labels";
import { COLUMN_DEFS, type ColumnId, useSettings } from "@/lib/cm/settings";
import type { ParsedSave } from "@/lib/cm/types";
import { MoraleText, Stat } from "./stat";
import { StatusPills } from "./status-pills";

const WIDTH: Record<ColumnId, number> = {
  name: 12,
  pos: 5.5,
  age: 3,
  nat: 3.5,
  club: 8,
  ca: 3.25,
  pa: 3.25,
  wage: 4.75,
  value: 5.25,
  expires: 6.25,
  status: 14,
  morale: 4.5,
  condition: 5.25,
};

export function SquadTable({
  save,
  rows,
  lookups,
  showClub,
  highlight,
  sortKey,
  sortDir,
  onHighlight,
  onOpen,
  onSort,
}: {
  save: ParsedSave;
  rows: Hit[];
  lookups: Lookups;
  showClub: boolean;
  highlight: number;
  sortKey: SortKey;
  sortDir: SortDir;
  onHighlight: (index: number) => void;
  onOpen: (playerIndex: number) => void;
  onSort: (column: ColumnId) => void;
}) {
  const columnsOn = useSettings((state) => state.columns);
  const showPa = useSettings((state) => state.showPa);
  const nameStyle = useSettings((state) => state.nameStyle);
  const density = useSettings((state) => state.density);
  const currency = useSettings((state) => state.currency);
  const wagePeriod = useSettings((state) => state.wagePeriod);
  const rowHeight = density === "compact" ? 32 : 44;
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(480);

  const columns = useMemo(() => {
    const cells: Record<ColumnId, (hit: Hit) => ReactNode> = {
      name: (hit) => <span className="truncate font-medium">{personLabel(hit.player, nameStyle)}</span>,
      pos: (hit) => <span className="truncate font-mono text-xs">{hit.player.pos}</span>,
      age: (hit) => <span className="font-mono">{hit.player.age || "–"}</span>,
      nat: (hit) => <span className="truncate font-mono text-xs">{lookups.nationCode(hit.player.nationId)}</span>,
      club: (hit) => <span className="truncate">{lookups.clubShort(hit.player.clubId)}</span>,
      ca: (hit) => <Stat value={hit.player.ca} kind="ability" />,
      pa: (hit) => <Stat value={hit.player.pa} kind="ability" />,
      wage: (hit) => <span className="font-mono text-xs">{wageText(hit.player.wage, currency, wagePeriod)}</span>,
      value: (hit) => <span className="font-mono text-xs">{money(hit.player.value, currency)}</span>,
      expires: (hit) => <span className="truncate font-mono text-xs">{hit.player.expiresLabel || "–"}</span>,
      status: (hit) => <StatusPills player={hit.player} save={save} />,
      morale: (hit) => <MoraleText value={hit.player.morale} compact />,
      condition: (hit) => <span className="font-mono text-xs">{conditionText(hit.player.condition)}</span>,
    };
    return COLUMN_DEFS.filter((column) => {
      if (!columnsOn[column.id]) return false;
      if (column.id === "pa" && !showPa) return false;
      if (column.id === "club" && !showClub) return false;
      return true;
    }).map((column) => ({
      ...column,
      rem: column.id === "wage" ? (wagePeriod === "year" ? 8.25 : wagePeriod === "month" ? 7.5 : 6.75) : WIDTH[column.id],
      cell: cells[column.id],
    }));
  }, [columnsOn, showPa, showClub, nameStyle, lookups, save, currency, wagePeriod]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight || 480);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el || highlight < 0) return;
    const top = highlight * rowHeight;
    const bottom = top + rowHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }, [highlight, rowHeight]);

  const template = columns.map((column) => `${column.rem}rem`).join(" ");
  const minWidth = `${columns.reduce((sum, column) => sum + column.rem, 0)}rem`;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 8);
  const count = Math.ceil(height / rowHeight) + 16;
  const slice = rows.slice(start, start + count);
  const right = new Set(["age", "ca", "pa", "wage", "value", "condition"]);

  return (
    <div
      ref={scroller}
      className="min-h-0 flex-1 overflow-auto"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ minWidth }}>
        <div
          className="sticky top-0 z-10 grid border-b border-line bg-surface text-xs text-faint"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((column) => {
            const active = sortKey === column.id;
            const heading = column.label === "Ability" ? "CA" : column.label === "Potential" ? "PA" : column.label;
            return (
              <button
                key={column.id}
                type="button"
                aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => onSort(column.id)}
                className={`inline-flex w-full items-center gap-0.5 px-2 py-2 ${right.has(column.id) ? "justify-end" : "justify-start"} ${active ? "text-fg" : ""}`}
              >
                {heading}
                {active ? (
                  sortDir === "asc" ? (
                    <ChevronUp className="size-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3" aria-hidden="true" />
                  )
                ) : null}
              </button>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-sm text-muted">No players match.</p>
        ) : (
          <div className="relative" style={{ height: rows.length * rowHeight }}>
            {slice.map((hit, offset) => {
              const rowIndex = start + offset;
              const active = rowIndex === highlight;
              return (
                <button
                  key={hit.index}
                  type="button"
                  onClick={() => {
                    onHighlight(rowIndex);
                    onOpen(hit.index);
                  }}
                  className={`absolute right-0 left-0 grid items-center border-b border-line text-left hover:bg-surface-2 ${active ? "bg-surface-2" : "bg-bg"} ${density === "compact" ? "text-xs" : "text-sm"}`}
                  style={{ top: rowIndex * rowHeight, height: rowHeight, gridTemplateColumns: template }}
                >
                  {columns.map((column) => (
                    <span key={column.id} className={`min-w-0 px-2 ${right.has(column.id) ? "text-right" : "text-left"}`}>
                      {column.cell(hit)}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
