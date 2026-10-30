import type { ReactNode } from "react";
import { X } from "lucide-react";
import { attrOf } from "@/lib/cm/parse";
import { buildLookups, conditionText, money, personLabel, wageText } from "@/lib/cm/labels";
import { attrRanksFor } from "@/lib/cm/positions";
import { ATTRS, FLAG, GROUPS, type ParsedSave } from "@/lib/cm/types";
import { useSettings } from "@/lib/cm/settings";
import { attrRankLabel, attrRankRow, attrRankTitle } from "./ui";
import { PlayerCompare } from "./player-compare";
import { PositionPitch } from "./pitch";
import { MoraleText, Stat } from "./stat";
import { StatusPills } from "./status-pills";

export function PlayerView({
  save,
  index,
  onClose,
  onClub,
}: {
  save: ParsedSave;
  index: number;
  onClose: () => void;
  onClub: (clubId: number) => void;
}) {
  const showPa = useSettings((state) => state.showPa);
  const nameStyle = useSettings((state) => state.nameStyle);
  const currency = useSettings((state) => state.currency);
  const wagePeriod = useSettings((state) => state.wagePeriod);
  const player = save.players[index];
  if (!player) return null;
  const lookups = buildLookups(save);
  const isGk = (player.posMask & 1) !== 0;
  const ranks = attrRanksFor(player.posMask, player.sideMask);
  const onLoan = (player.flags & FLAG.loan) !== 0;
  const loanFrom =
    onLoan && player.loanFromClubId >= 0
      ? (save.clubs.find((club) => club.id === player.loanFromClubId) ?? null)
      : null;
  const club =
    player.clubId >= 0 ? (save.clubs.find((row) => row.id === player.clubId) ?? null) : null;

  const facts: { label: string; node: ReactNode }[] = [
    {
      label: "Club",
      node: club ? (
        <ClubLink name={club.name} onClick={() => onClub(club.id)} />
      ) : (
        <span>{lookups.clubName(player.clubId)}</span>
      ),
    },
    ...(onLoan
      ? [
          {
            label: "Loaned from",
            node: loanFrom ? (
              <ClubLink name={loanFrom.name} onClick={() => onClub(loanFrom.id)} />
            ) : (
              <span>Unknown club</span>
            ),
          },
        ]
      : []),
    { label: "Born", node: <span>{player.dobLabel || "—"}</span> },
    { label: "Joined", node: <span>{player.joinedLabel || "—"}</span> },
    { label: "Expires", node: <span>{player.expiresLabel || "—"}</span> },
    { label: "Squad status", node: <span>{player.squadStatus || "—"}</span> },
    { label: "Morale", node: <MoraleText value={player.morale} /> },
    { label: "Condition", node: <span>{conditionText(player.condition)}</span> },
    {
      label: "Release",
      node: <span>{player.releaseFee > 0 ? money(player.releaseFee, currency) : "—"}</span>,
    },
    {
      label: "Caps",
      node: <span>{player.intApps ? `${player.intApps} (${player.intGoals})` : "—"}</span>,
    },
    {
      label: "Reputation",
      node: <span>{`${player.homeRep} / ${player.currentRep} / ${player.worldRep}`}</span>,
    },
    { label: "Feet", node: <span>{`${player.leftFoot} / ${player.rightFoot}`}</span> },
  ];

  return (
    <article className="flex h-full min-h-0 flex-col overflow-y-auto">
      <header className="@container sticky top-0 z-10 border-b border-line bg-surface px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{personLabel(player, nameStyle)}</h2>
            {nameStyle === "common" && player.fullName && player.fullName !== player.name ? (
              <p className="truncate text-xs text-faint">{player.fullName}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted">
              {player.age ? `${player.age} years` : "—"} · {lookups.nation(player.nationId)}
              {player.squadNo ? ` · No. ${player.squadNo}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-sm border border-line hover:bg-surface-2"
            aria-label="Close player"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2">
            <Metric label="CA">
              <Stat value={player.ca} kind="ability" />
            </Metric>
            {showPa ? (
              <Metric label="PA">
                <Stat value={player.pa} kind="ability" />
              </Metric>
            ) : (
              <span />
            )}
            <Metric label="Value">{money(player.value, currency)}</Metric>
            <Metric label="Wage">{wageText(player.wage, currency, wagePeriod)}</Metric>
          </div>
          <PositionPitch posMask={player.posMask} sideMask={player.sideMask} label={player.pos} />
        </div>
        <div className="mt-2">
          <StatusPills player={player} save={save} onClub={onClub} />
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-xs text-faint">{fact.label}</dt>
            <dd className="truncate font-mono text-xs">{fact.node}</dd>
          </div>
        ))}
      </dl>
      <PlayerCompare save={save} index={index} />
      <div className="px-4 pb-6">
        {ranks.size > 0 ? <AttrRankKey /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {GROUPS.filter((group) => group.id !== "goalkeeping" || isGk).map((group) => (
            <section key={group.id}>
              <h3 className="mb-1 text-xs text-faint">{group.label}</h3>
              <ul className="divide-y divide-line border-y border-line">
                {ATTRS.filter((attr) => attr.group === group.id).map((attr) => {
                  const rank = ranks.get(attr.key);
                  return (
                    <li
                      key={attr.key}
                      title={attrRankTitle(rank)}
                      className={`flex items-center justify-between py-1 text-sm ${rank ? "px-2" : ""} ${attrRankRow(rank)}`}
                    >
                      <span className={attrRankLabel(rank)}>{attr.label}</span>
                      <Stat value={attrOf(save, index, attr.key)} kind="attr" />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

function AttrRankKey() {
  return (
    <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
      <span className="inline-flex items-center gap-1.5">
        <i className="h-3 w-0.5 bg-accent" aria-hidden="true" />
        0.10 and up
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="h-3 w-0.5 bg-secondary" aria-hidden="true" />
        0.05–0.10
      </span>
    </p>
  );
}

function ClubLink({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="truncate underline decoration-line underline-offset-2 hover:text-accent"
    >
      {name}
    </button>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="min-w-0">
      <span className="block text-xs text-faint">{label}</span>
      <span className="block truncate font-mono text-base font-medium leading-tight @min-[32rem]:text-xl">{children}</span>
    </p>
  );
}
