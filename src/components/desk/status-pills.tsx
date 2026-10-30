import { statusParts } from "@/lib/cm/labels";
import { FLAG, type ParsedSave, type PlayerRec } from "@/lib/cm/types";

export function StatusPills({
  player,
  save,
  onClub,
}: {
  player: PlayerRec;
  save: ParsedSave;
  onClub?: (clubId: number) => void;
}) {
  const parts = statusParts(player, save);
  if (!parts.length) return <span className="text-faint">–</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {parts.map((part) => {
        const loanClubId =
          part.kind === "loan" && (player.flags & FLAG.loan) !== 0 && player.loanFromClubId >= 0
            ? player.loanFromClubId
            : -1;
        if (loanClubId >= 0 && onClub) {
          return (
            <button
              key={part.kind}
              type="button"
              className={`status-pill status-${part.kind} cursor-pointer hover:opacity-90`}
              onClick={() => onClub(loanClubId)}
            >
              {part.label}
            </button>
          );
        }
        return (
          <span key={part.kind} className={`status-pill status-${part.kind}`}>
            {part.label}
          </span>
        );
      })}
    </span>
  );
}
