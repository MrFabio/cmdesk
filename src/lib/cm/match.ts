import { readHumanPick } from "./parse.ts";
import type { ClubRec, ParsedSave, PlayerRec, TacticRec } from "./types.ts";

export type MatchSpot = {
  /** Index into `save.players`, for `openPlayer`. */
  index: number;
  player: PlayerRec;
  /** Index in the club's 20 match-squad ids. */
  squadIndex: number;
};

export type MatchLineup = {
  /** No id in the 20 resolved to a player at this club. */
  empty: boolean;
  /** Selected tactic whose eleven overview slots decoded. */
  tactic: TacticRec | null;
  /** Slots 0–10. Null is an empty id, an unknown id, or a player at another club. */
  pitch: (MatchSpot | null)[];
  /** Slots 11–19 that resolved. */
  bench: MatchSpot[];
  /** Pitch and bench, in squad order, with holes removed. */
  list: MatchSpot[];
};

/**
 * Prefer the club's 20 match-squad ids when any of them resolve: slot 0 is
 * tactic slot 0, and slots 11–19 are the bench. When that list is empty, use
 * a picked eleven from `human_manager.dat` for this club only. Each of those
 * players carries his own overview circle. Unknown ids and players at
 * another club stay off the pitch and the bench.
 */
export function matchLineup(save: ParsedSave, club: ClubRec): MatchLineup {
  const byId = new Map<number, number>();
  save.players.forEach((player, index) => {
    if (player.clubId !== club.id || byId.has(player.id)) return;
    byId.set(player.id, index);
  });
  const spotFor = (staffId: number, squadIndex: number): MatchSpot | null => {
    if (staffId < 0) return null;
    const index = byId.get(staffId);
    if (index === undefined) return null;
    const player = save.players[index];
    if (!player) return null;
    return { index, player, squadIndex };
  };
  const spots = Array.from({ length: 20 }, (_, squadIndex) => spotFor(club.matchSquad[squadIndex] ?? -1, squadIndex));
  const listed = spots.filter((spot) => spot !== null);
  if (listed.length > 0) {
    const selected = club.tacticId >= 0 ? save.tactics[club.tacticId] : undefined;
    const tactic = selected?.slots?.length === 11 ? selected : null;
    return {
      empty: false,
      tactic,
      pitch: spots.slice(0, 11),
      bench: spots.slice(11).filter((spot) => spot !== null),
      list: listed,
    };
  }
  const pick = save.humanManager ? readHumanPick(save.humanManager, new Set(byId.keys())) : null;
  if (!pick) {
    return { empty: true, tactic: null, pitch: spots.slice(0, 11), bench: [], list: [] };
  }
  const pitch = pick.pitch.map((entry, squadIndex) => spotFor(entry.staffId, squadIndex));
  const bench = pick.bench
    .map((staffId, index) => spotFor(staffId, 11 + index))
    .filter((spot) => spot !== null);
  const list = [...pitch, ...bench].filter((spot) => spot !== null);
  return {
    empty: list.length === 0,
    tactic: {
      id: -1,
      name: pick.tacticName,
      slots: pick.pitch.map((entry) => entry.slot),
    },
    pitch,
    bench,
    list,
  };
}
