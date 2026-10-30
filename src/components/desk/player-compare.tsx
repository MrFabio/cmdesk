import { useEffect, useMemo, useState } from "react";
import { attrOf } from "@/lib/cm/parse";
import { money, personLabel, wageText } from "@/lib/cm/labels";
import { squadOf } from "@/lib/cm/query";
import { ATTRS, GROUPS, ROLES, type ParsedSave, type PlayerRec } from "@/lib/cm/types";
import { useSettings } from "@/lib/cm/settings";
import { Stat } from "./stat";
import { control } from "./ui";

export function PlayerCompare({ save, index }: { save: ParsedSave; index: number }) {
  const showPa = useSettings((state) => state.showPa);
  const nameStyle = useSettings((state) => state.nameStyle);
  const currency = useSettings((state) => state.currency);
  const wagePeriod = useSettings((state) => state.wagePeriod);
  const player = save.players[index];
  const [otherIndex, setOtherIndex] = useState<number | null>(null);

  const clubId = save.humanClubId;
  const clubName = clubId >= 0 ? (save.clubs.find((club) => club.id === clubId)?.name ?? "Your club") : null;

  const candidates = useMemo(() => {
    if (!player || clubId < 0) return [];
    return squadOf(save, clubId)
      .filter((hit) => hit.index !== index && sharesPosition(player, hit.player))
      .sort((a, b) => b.player.ca - a.player.ca || a.player.sortName.localeCompare(b.player.sortName));
  }, [save, clubId, index, player]);

  useEffect(() => {
    setOtherIndex(null);
  }, [index]);

  useEffect(() => {
    if (otherIndex !== null && !candidates.some((hit) => hit.index === otherIndex)) {
      setOtherIndex(null);
    }
  }, [candidates, otherIndex]);

  if (!player) return null;
  if (clubId < 0) {
    return (
      <section className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-medium">Compare with squad</h3>
        <p className="mt-1 text-xs text-muted">Mark a club as yours to compare against its squad.</p>
      </section>
    );
  }

  const other = otherIndex !== null ? save.players[otherIndex] : null;
  const isGk = (player.posMask & 1) !== 0 || !!(other && (other.posMask & 1) !== 0);
  const groups = GROUPS.filter((group) => group.id !== "goalkeeping" || isGk);

  return (
    <section className="border-b border-line px-4 py-3">
      <h3 className="text-sm font-medium">Compare with squad</h3>
      <p className="mt-1 text-xs text-muted">
        Same position at {clubName}
        {roleSummary(player.posMask) ? ` · ${roleSummary(player.posMask)}` : ""}.
      </p>
      {candidates.length === 0 ? (
        <p className="mt-2 text-xs text-faint">No one else in your squad shares this position.</p>
      ) : (
        <label className="mt-2 block text-xs text-faint">
          Squad player
          <select
            className={`${control} mt-1`}
            value={otherIndex ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setOtherIndex(value === "" ? null : Number(value));
            }}
          >
            <option value="">Choose a player</option>
            {candidates.map((hit) => (
              <option key={hit.index} value={hit.index}>
                {personLabel(hit.player, nameStyle)} · {hit.player.pos} · CA {hit.player.ca}
              </option>
            ))}
          </select>
        </label>
      )}

      {other && otherIndex !== null ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 text-xs">
            <p className="min-w-0 truncate font-medium">{personLabel(player, nameStyle)}</p>
            <p className="text-faint">vs</p>
            <p className="min-w-0 truncate text-right font-medium">{personLabel(other, nameStyle)}</p>
            <p className="text-faint">{player.pos}</p>
            <span />
            <p className="text-right text-faint">{other.pos}</p>
          </div>

          <ul className="divide-y divide-line border-y border-line text-sm">
            <CompareAbility label="CA" left={player.ca} right={other.ca} />
            {showPa ? <CompareAbility label="PA" left={player.pa} right={other.pa} /> : null}
            <ComparePlain label="Age" left={player.age || "—"} right={other.age || "—"} />
            <ComparePlain
              label="Wage"
              left={wageText(player.wage, currency, wagePeriod)}
              right={wageText(other.wage, currency, wagePeriod)}
              delta={player.wage - other.wage}
              invertDelta
            />
            <ComparePlain
              label="Value"
              left={money(player.value, currency)}
              right={money(other.value, currency)}
              delta={player.value - other.value}
            />
          </ul>

          {groups.map((group) => (
            <div key={group.id}>
              <h4 className="mb-1 text-xs text-faint">{group.label}</h4>
              <ul className="divide-y divide-line border-y border-line">
                {ATTRS.filter((attr) => attr.group === group.id).map((attr) => (
                  <CompareAttr
                    key={attr.key}
                    label={attr.label}
                    left={attrOf(save, index, attr.key)}
                    right={attrOf(save, otherIndex, attr.key)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function sharesPosition(a: PlayerRec, b: PlayerRec): boolean {
  if (a.posMask & b.posMask) return true;
  // Fall back to primary role label overlap when masks are sparse.
  return primaryRoleBit(a.posMask) !== 0 && primaryRoleBit(a.posMask) === primaryRoleBit(b.posMask);
}

function primaryRoleBit(mask: number): number {
  for (const role of ROLES) {
    if (mask & role.bit) return role.bit;
  }
  return 0;
}

function roleSummary(mask: number): string {
  return ROLES.filter((role) => mask & role.bit)
    .map((role) => role.label)
    .join("/");
}

function CompareAbility({ label, left, right }: { label: string; left: number; right: number }) {
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5">
      <span className="text-right font-mono">
        <Stat value={left} kind="ability" />
      </span>
      <span className="w-16 text-center text-xs text-faint">
        {label}
        <Delta value={left - right} />
      </span>
      <span className="font-mono">
        <Stat value={right} kind="ability" />
      </span>
    </li>
  );
}

function CompareAttr({ label, left, right }: { label: string; left: number; right: number }) {
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 text-sm">
      <span className="text-right">
        <Stat value={left} kind="attr" />
      </span>
      <span className="w-28 text-center text-xs text-muted">
        {label}
        <Delta value={left >= 0 && right >= 0 ? left - right : 0} />
      </span>
      <span>
        <Stat value={right} kind="attr" />
      </span>
    </li>
  );
}

function ComparePlain({
  label,
  left,
  right,
  delta,
  invertDelta = false,
}: {
  label: string;
  left: string | number;
  right: string | number;
  delta?: number;
  invertDelta?: boolean;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5">
      <span className="truncate text-right font-mono text-xs">{left}</span>
      <span className="w-16 text-center text-xs text-faint">
        {label}
        {delta !== undefined ? <Delta value={invertDelta ? -delta : delta} /> : null}
      </span>
      <span className="truncate font-mono text-xs">{right}</span>
    </li>
  );
}

function Delta({ value }: { value: number }) {
  if (!value) return null;
  const better = value > 0;
  return (
    <span className={`mt-0.5 block font-mono ${better ? "attr-b5" : "attr-b1"}`}>
      {better ? `+${value}` : value}
    </span>
  );
}
