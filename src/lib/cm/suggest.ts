import { CA_DEPENDENT, caDependentFloat, displayAttr } from "./attr-display.ts";
import { circleSpots, isPureGoalkeeper, playedSpots, positionFit, type PitchSpot } from "./positions.ts";
import type { MatchLineup } from "./match.ts";
import { ATTRS, ATTR_INDEX, type AttrKey, type ClubRec, type ParsedSave, type PlayerRec, type TacticSlot } from "./types.ts";
import type { Hit } from "./query.ts";

/** Eleven circles for a 4-4-2 when the save has no shape. */
export const FALLBACK_SHAPE: readonly TacticSlot[] = [
  { row: 0, col: 2 },
  { row: 2, col: 0 },
  { row: 2, col: 1 },
  { row: 2, col: 3 },
  { row: 2, col: 4 },
  { row: 4, col: 0 },
  { row: 4, col: 1 },
  { row: 4, col: 3 },
  { row: 4, col: 4 },
  { row: 6, col: 1 },
  { row: 6, col: 3 },
];

export type SuggestedPick = {
  index: number;
  player: PlayerRec;
  /** 0–100 after condition, morale, and where he is asked to play. */
  score: number;
  natural: boolean;
};

export type MatchSuggestion = {
  slots: TacticSlot[];
  shapeName: string;
  /** True when the club has no decoded shape and a 4-4-2 was used. */
  fallbackShape: boolean;
  pitch: (SuggestedPick | null)[];
  bench: SuggestedPick[];
};

/**
 * Best side for the next match.
 * The position rating uses in-match attributes. Condition under 90% is marked
 * down, because a tired player’s rolls lose ground as fitness falls. Morale
 * is a smaller tilt. Consistency shades how often he reaches those attributes.
 * Recent ratings are not stored as an input to the next match, so they are
 * not used. Important matches is left out: the save does not say whether the
 * next game is one of those.
 */
/** The shape on screen, or the club tactic, or a 4-4-2 when neither decoded. */
export function suggestionFor(save: ParsedSave, club: ClubRec, lineup: MatchLineup, hits: Hit[]): MatchSuggestion {
  const shown = lineup.tactic?.slots?.length === 11 ? lineup.tactic : null;
  const stored = !shown && club.tacticId >= 0 ? save.tactics[club.tacticId] : undefined;
  const tactic = shown ?? (stored?.slots?.length === 11 ? stored : null);
  return suggestMatch(save, hits, tactic?.slots ?? [], tactic?.name ?? "");
}

export function suggestMatch(save: ParsedSave, hits: Hit[], slots: readonly TacticSlot[], shapeName: string): MatchSuggestion {
  const shape = slots.length === 11 ? slots : FALLBACK_SHAPE;
  const fallbackShape = slots.length !== 11;
  const picked = assign(save, hits, shape);
  const used = new Set(picked.filter((index) => index >= 0));
  const pitch = shape.map((slot, place) => {
    const at = picked[place] ?? -1;
    const hit = at >= 0 ? hits[at] : undefined;
    if (!hit) return null;
    return ratePick(save, hit, slot);
  });
  return {
    slots: [...shape],
    shapeName: fallbackShape ? "4-4-2" : shapeName,
    fallbackShape,
    pitch,
    bench: benchOf(save, hits, used),
  };
}

function assign(save: ParsedSave, hits: Hit[], slots: readonly TacticSlot[]): number[] {
  const chosen = new Array<number>(slots.length).fill(-1);
  const used = new Set<number>();
  const open = slots.map((_, index) => index);
  while (open.length > 0) {
    let takeSlot = -1;
    let takePlayer = -1;
    let gap = -Infinity;
    let bestScore = -Infinity;
    for (const slot of open) {
      const circle = slots[slot];
      if (!circle) continue;
      const ranked = hits
        .map((hit, index) => ({ index, score: used.has(index) ? -1 : ratePick(save, hit, circle).score }))
        .filter((row) => row.score >= 0)
        .sort((a, b) => b.score - a.score || hits[a.index]!.player.sortName.localeCompare(hits[b.index]!.player.sortName));
      const top = ranked[0];
      if (!top) continue;
      const lead = top.score - (ranked[1]?.score ?? 0);
      if (lead > gap || (lead === gap && top.score > bestScore)) {
        gap = lead;
        bestScore = top.score;
        takeSlot = slot;
        takePlayer = top.index;
      }
    }
    if (takeSlot < 0) break;
    chosen[takeSlot] = takePlayer;
    if (takePlayer >= 0) used.add(takePlayer);
    open.splice(open.indexOf(takeSlot), 1);
  }
  return chosen;
}

function benchOf(save: ParsedSave, hits: Hit[], used: Set<number>): SuggestedPick[] {
  const rest = hits
    .map((hit, index) => ({ hit, index }))
    .filter((row) => !used.has(row.index))
    .map((row) => bestRole(save, row.hit))
    .sort((a, b) => b.score - a.score || a.player.sortName.localeCompare(b.player.sortName));
  const bench = rest.slice(0, 5);
  const keeper = rest.find((row) => (row.player.posMask & 1) !== 0);
  if (keeper && !bench.some((row) => (row.player.posMask & 1) !== 0)) {
    return [...bench.slice(0, 4), keeper];
  }
  return bench;
}

function bestRole(save: ParsedSave, hit: Hit): SuggestedPick {
  const played = [...playedSpots(hit.player.posMask, hit.player.sideMask)];
  const home = played[0];
  if (!home) return ratePick(save, hit, { row: 4, col: 2 });
  return ratePick(save, hit, slotForSpot(home));
}

function slotForSpot(spot: PitchSpot): TacticSlot {
  const table: Record<PitchSpot, TacticSlot> = {
    GK: { row: 0, col: 2 },
    SW: { row: 1, col: 2 },
    DL: { row: 2, col: 0 },
    DC: { row: 2, col: 2 },
    DR: { row: 2, col: 4 },
    DML: { row: 3, col: 0 },
    DMC: { row: 3, col: 2 },
    DMR: { row: 3, col: 4 },
    ML: { row: 4, col: 0 },
    MC: { row: 4, col: 2 },
    MR: { row: 4, col: 4 },
    AML: { row: 5, col: 0 },
    AMC: { row: 5, col: 2 },
    AMR: { row: 5, col: 4 },
    FL: { row: 6, col: 0 },
    FC: { row: 6, col: 2 },
    FR: { row: 6, col: 4 },
  };
  return table[spot];
}

function ratePick(save: ParsedSave, hit: Hit, slot: TacticSlot): SuggestedPick {
  const fit = positionFit(slot.row, slot.col, (key) => engineValue(save, hit.index, key, hit.player.ca));
  const natural = isNatural(hit.player, circleSpots(slot.row, slot.col));
  const versatility = engineValue(save, hit.index, "versatility", hit.player.ca);
  const where = placeFactor(hit.player, circleSpots(slot.row, slot.col), versatility, natural);
  const score =
    fit *
    where *
    conditionFactor(hit.player.condition) *
    moraleFactor(hit.player.morale) *
    consistencyFactor(engineValue(save, hit.index, "consistency", hit.player.ca)) *
    fitnessHold(engineValue(save, hit.index, "naturalFitness", hit.player.ca));
  return { index: hit.index, player: hit.player, score: Math.round(score * 10) / 10, natural };
}

function isNatural(player: PlayerRec, spots: readonly PitchSpot[]): boolean {
  const played = playedSpots(player.posMask, player.sideMask);
  return spots.some((spot) => played.has(spot));
}

function placeFactor(player: PlayerRec, spots: readonly PitchSpot[], versatility: number, natural: boolean): number {
  if (natural || spots.length === 0) return 1;
  const played = playedSpots(player.posMask, player.sideMask);
  const gkSlot = spots.includes("GK");
  const gkPlayer = played.has("GK");
  let raw = 0.62;
  if (gkSlot !== gkPlayer && (gkSlot || isPureGoalkeeper(player.posMask))) raw = 0.2;
  else if (sameLine(played, spots)) raw = 0.82;
  const vers = versatility < 0 ? 10 : Math.max(0, Math.min(20, versatility));
  const gap = 1 - raw;
  return 1 - gap * (1 - 0.7 * (vers / 20));
}

function sameLine(played: Set<PitchSpot>, spots: readonly PitchSpot[]): boolean {
  const want = lineOf(spots[0]!);
  for (const spot of played) if (lineOf(spot) === want) return true;
  return false;
}

function lineOf(spot: PitchSpot): string {
  if (spot === "GK" || spot === "SW") return spot;
  if (spot.startsWith("DM")) return "DM";
  if (spot.startsWith("AM")) return "AM";
  if (spot.startsWith("D")) return "D";
  if (spot.startsWith("M")) return "M";
  return "F";
}

/** Full value from 90% up. Below that the rolls lose ground as fitness falls. */
export function conditionFactor(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return 1;
  const pct = Math.max(0, Math.min(100, percent));
  if (pct >= 90) return 1;
  if (pct >= 80) return 0.9 + (pct - 80) / 100;
  if (pct >= 70) return 0.75 + (pct - 70) * 0.015;
  return Math.max(0.35, (0.75 * pct) / 70);
}

/** A smaller tilt than condition. Ok is the middle of the squad-screen words. */
export function moraleFactor(morale: number): number {
  if (!Number.isFinite(morale) || morale <= 0) return 1;
  if (morale < 4) return 0.88;
  if (morale < 8) return 0.94;
  if (morale < 12) return 1;
  if (morale < 15) return 1.02;
  if (morale < 18) return 1.04;
  return 1.06;
}

function consistencyFactor(consistency: number): number {
  if (!Number.isFinite(consistency) || consistency < 0) return 1;
  const value = Math.max(1, Math.min(20, consistency));
  return 0.75 + 0.25 * (value / 20);
}

/** How well he holds condition. Small beside the condition he has today. */
function fitnessHold(naturalFitness: number): number {
  if (!Number.isFinite(naturalFitness) || naturalFitness < 0) return 1;
  const value = Math.max(1, Math.min(20, naturalFitness));
  return 0.94 + 0.06 * (value / 20);
}

function engineValue(save: ParsedSave, index: number, key: AttrKey, ca: number): number {
  const intrinsic = save.attrs[index * ATTRS.length + ATTR_INDEX[key]] ?? -1;
  if (!Number.isFinite(intrinsic) || intrinsic === -1) return -1;
  if (CA_DEPENDENT.has(key)) return caDependentFloat(key, intrinsic, ca);
  return displayAttr(key, intrinsic, ca);
}
