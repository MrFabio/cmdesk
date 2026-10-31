import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Hit, SortDir, SortKey } from "@/lib/cm/query";
import { bandOf, conditionText, money, personLabel, wageText, type Lookups } from "@/lib/cm/labels";
import { attrOf } from "@/lib/cm/parse";
import { lineAttributes, SQUAD_LINES, type SquadLineId } from "@/lib/cm/positions";
import { COLUMN_DEFS, type ColumnId, useSettings } from "@/lib/cm/settings";
import type { ParsedSave } from "@/lib/cm/types";
import { MoraleText, Stat } from "./stat";
import { InjuryTag, StatusPills } from "./status-pills";
import { chipClass } from "./ui";

const WIDTH: Record<ColumnId, number> = {
  name: 16,
  pos: 5.5,
  rating: 7.5,
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

const RIGHT = new Set<ColumnId>(["age", "rating", "ca", "pa", "wage", "value", "condition"]);

type ShownColumn = {
  id: string;
  sort: SortKey;
  label: string;
  rem: number;
  align: "start" | "end";
  title?: string;
  cell: (hit: Hit) => ReactNode;
};

function attrRem(label: string): number {
  return Math.max(4.25, Math.min(7.25, label.length * 0.42 + 2.1));
}

export function SquadLineBar({
  line,
  onChange,
}: {
  line: SquadLineId;
  onChange: (line: SquadLineId) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
      <span className="text-xs text-faint">Line</span>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Position line">
        {SQUAD_LINES.map((item) => {
          const on = line === item.id;
          const attrs = item.id === "all" ? "" : lineAttributes(item.id).map((attr) => attr.label).join(", ");
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={attrs ? `${item.title}. ${attrs}.` : item.title}
              className={chipClass(on)}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SquadTable({
  save,
  rows,
  lookups,
  showClub,
  empty,
  highlight,
  line,
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
  empty?: string;
  highlight: number;
  line: SquadLineId;
  sortKey: SortKey;
  sortDir: SortDir;
  onHighlight: (index: number) => void;
  onOpen: (playerIndex: number) => void;
  onSort: (column: SortKey) => void;
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
      name: (hit) => (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-medium">{personLabel(hit.player, nameStyle)}</span>
          <InjuryTag days={hit.player.injuryDays} />
        </span>
      ),
      pos: (hit) => <span className="truncate font-mono text-xs">{hit.player.pos}</span>,
      rating: (hit) => <RatingCell hit={hit} />,
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
    const base: ShownColumn[] = COLUMN_DEFS.filter((column) => {
      if (!columnsOn[column.id]) return false;
      if (column.id === "pa" && !showPa) return false;
      if (column.id === "club" && !showClub) return false;
      return true;
    }).map((column) => ({
      id: column.id,
      sort: column.id,
      label: column.label,
      rem: column.id === "wage" ? (wagePeriod === "year" ? 8.25 : wagePeriod === "month" ? 7.5 : 6.75) : WIDTH[column.id],
      align: RIGHT.has(column.id) ? "end" : "start",
      title: column.id === "rating" ? "Highlighted attributes for that position, plus a little stamina" : undefined,
      cell: cells[column.id],
    }));
    const extras: ShownColumn[] = lineAttributes(line).map((attr) => ({
      id: attr.key,
      sort: attr.key,
      label: attr.label,
      rem: attrRem(attr.label),
      align: "end",
      title:
        attr.rank === "primary"
          ? `${attr.label}. Main attribute for this line.`
          : `${attr.label}. Also used for this line.`,
      cell: (hit) => <Stat value={attrOf(save, hit.index, attr.key)} kind="attr" />,
    }));
    const afterRating = base.findIndex((column) => column.id === "rating");
    const afterPos = base.findIndex((column) => column.id === "pos");
    const at = afterRating >= 0 ? afterRating + 1 : afterPos >= 0 ? afterPos + 1 : 1;
    return [...base.slice(0, at), ...extras, ...base.slice(at)];
  }, [columnsOn, showPa, showClub, nameStyle, lookups, save, currency, wagePeriod, line]);

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
            const active = sortKey === column.sort;
            const heading = column.label === "Ability" ? "CA" : column.label === "Potential" ? "PA" : column.label;
            const end = column.align === "end";
            return (
              <button
                key={column.id}
                type="button"
                title={column.title}
                aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => onSort(column.sort)}
                className={`inline-flex w-full min-w-0 items-center gap-0.5 overflow-hidden px-2 py-2 ${end ? "justify-end" : "justify-start"} ${active ? "text-fg" : ""}`}
              >
                <span className="min-w-0 truncate">{heading}</span>
                {active ? (
                  sortDir === "asc" ? (
                    <ChevronUp className="size-3 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                  )
                ) : null}
              </button>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-sm text-muted">{empty ?? "No players match."}</p>
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
                    <span key={column.id} className={`min-w-0 px-2 ${column.align === "end" ? "text-right" : "text-left"}`}>
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

function RatingCell({ hit }: { hit: Hit }) {
  const value = hit.rating ?? -1;
  if (value < 0) return <span className="font-mono text-faint">–</span>;
  const band = bandOf(value);
  return (
    <span className="inline-flex items-baseline justify-end gap-1" title={hit.ratingTitle || undefined}>
      <span className={band ? `font-mono attr-b${band}` : "font-mono"}>{value.toFixed(1)}</span>
      {hit.ratingSlot ? <span className="font-mono text-[10px] text-faint">{hit.ratingSlot}</span> : null}
    </span>
  );
}
