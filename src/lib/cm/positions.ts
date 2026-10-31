import { ATTRS, ROLE_MASK, ROLES, type AttrKey } from "./types.ts";

/** Side bytes in player.dat: right +23, left +24, centre +25. Set when the byte is >= 15. */
export const SIDE = { right: 1, left: 2, centre: 4 } as const;

type Slot = "GK" | "DC" | "DL" | "DMC" | "DML" | "MC" | "ML" | "AMC" | "AML" | "FC";

/**
 * Position-rating weights from the CM 01/02 fit.
 * Primary is weight >= 0.10. Secondary is 0.05 up to 0.10.
 * The save stores GK/D/DM/M/AM/F plus side, so wide and central slots are
 * chosen from that. Wide attacking mid has no separate fit and uses the wide
 * mid weights. Every forward uses the central-forward weights. The wide-player
 * foot rating (about 0.06–0.08) is left out; feet are shown on their own.
 */
const PRIMARY = 0.1;
const SECONDARY = 0.05;

export type AttrRank = "primary" | "secondary";

/**
 * Hidden attributes the match reads for every player. They are not in the
 * position-rating fit. Primary changes the level he plays at. Secondary is
 * read in a narrower case: out of position, a foul, or a tense moment.
 * Dirtiness and Injury proneness stay unmarked because a higher number is worse.
 */
const HIDDEN: Partial<Record<AttrKey, AttrRank>> = {
  consistency: "primary",
  importantMatches: "primary",
  versatility: "secondary",
  temperament: "secondary",
  pressure: "secondary",
};

const HIDDEN_TITLE: Partial<Record<AttrKey, string>> = {
  consistency: "How often he plays to his attributes",
  importantMatches: "How he plays in a big game",
  versatility: "Shrinks the out-of-position penalty",
  temperament: "Whether a challenge becomes a foul",
  pressure: "How he handles a tense moment",
};

const WEIGHTS: Record<Slot, Partial<Record<AttrKey, number>>> = {
  GK: { handling: 0.159, agility: 0.069, reflexes: 0.06 },
  DC: {
    marking: 0.115,
    positioning: 0.114,
    teamwork: 0.04,
    passing: 0.031,
    jumping: 0.027,
    aggression: 0.024,
    workRate: 0.022,
    pace: 0.019,
  },
  DL: {
    positioning: 0.195,
    technique: 0.17,
    dribbling: 0.143,
    teamwork: 0.098,
    passing: 0.072,
    jumping: 0.056,
    movement: 0.055,
    stamina: 0.048,
    workRate: 0.038,
    pace: 0.029,
    aggression: 0.014,
  },
  DMC: {
    positioning: 0.2,
    vision: 0.09,
    passing: 0.087,
    workRate: 0.078,
    movement: 0.057,
    technique: 0.047,
    tackling: 0.046,
    pace: 0.041,
    dribbling: 0.037,
    aggression: 0.03,
    teamwork: 0.018,
    stamina: 0.017,
  },
  DML: {
    positioning: 0.182,
    technique: 0.168,
    dribbling: 0.141,
    teamwork: 0.112,
    movement: 0.077,
    passing: 0.073,
    stamina: 0.053,
    jumping: 0.052,
    workRate: 0.035,
    pace: 0.029,
    aggression: 0.02,
  },
  MC: {
    technique: 0.187,
    dribbling: 0.159,
    movement: 0.154,
    positioning: 0.117,
    stamina: 0.08,
    jumping: 0.065,
    passing: 0.064,
    workRate: 0.055,
    pace: 0.039,
    vision: 0.035,
    teamwork: 0.013,
  },
  ML: {
    movement: 0.249,
    technique: 0.158,
    dribbling: 0.131,
    teamwork: 0.099,
    passing: 0.072,
    stamina: 0.068,
    workRate: 0.036,
    aggression: 0.018,
    pace: 0.012,
  },
  AMC: {
    technique: 0.203,
    dribbling: 0.193,
    movement: 0.155,
    positioning: 0.124,
    stamina: 0.079,
    workRate: 0.078,
    passing: 0.067,
    pace: 0.046,
    jumping: 0.045,
    crossing: 0.025,
    teamwork: 0.022,
  },
  AML: {
    movement: 0.249,
    technique: 0.158,
    dribbling: 0.131,
    teamwork: 0.099,
    passing: 0.072,
    stamina: 0.068,
    workRate: 0.036,
    aggression: 0.018,
    pace: 0.012,
  },
  FC: {
    movement: 0.177,
    technique: 0.141,
    jumping: 0.111,
    positioning: 0.092,
    stamina: 0.083,
    dribbling: 0.08,
    passing: 0.063,
    workRate: 0.04,
    pace: 0.03,
    heading: 0.029,
    finishing: 0.024,
    teamwork: 0.023,
  },
};

function rankForWeight(weight: number): AttrRank | null {
  if (weight >= PRIMARY) return "primary";
  if (weight >= SECONDARY) return "secondary";
  return null;
}

const ATTR_LABEL = new Map(ATTRS.map((attr) => [attr.key, attr.label]));

/**
 * Extra weight on stamina for the comparison rating only.
 * About one marking point for every six stamina points on a centre-back,
 * so a fitter player edges ahead when the highlighted attributes are close.
 */
const STAMINA_PREFERENCE = 0.02;

export type RoleRating = {
  /** One decimal on the 1–20 scale the player page shows. */
  value: number;
  /** Slot the number belongs to, so two DCs can be compared with each other. */
  slot: string;
  /** Highlighted attributes, heaviest first. */
  attrs: string[];
};

/**
 * One number for comparing players in the same position.
 * Uses the attributes the player page highlights (weight 0.05 and up),
 * weighted the same way, on the displayed 1–20 values. Stamina then gets a
 * small extra weight. Hidden attributes stay out. With several slots, the
 * highest wins. A search focus limits the slots to the position and side
 * being searched.
 */
export function roleRating(
  posMask: number,
  sideMask: number,
  valueOf: (key: AttrKey) => number,
  focus?: { posMask: number; sideMask: number },
): RoleRating | null {
  const wanted = (focus?.posMask ?? 0) & ROLE_MASK;
  const pos = wanted ? posMask & wanted : posMask;
  if (!pos) return null;
  const side = focus?.sideMask ? focus.sideMask : sideMask;
  let best: { scored: RoleRating; slot: Slot } | null = null;
  for (const slot of slotsFor(pos, side)) {
    const scored = scoreSlot(slot, valueOf);
    if (!scored || (best && scored.value <= best.scored.value)) continue;
    best = { scored, slot };
  }
  if (!best) return null;
  return { ...best.scored, slot: slotLabel(best.slot, side) };
}

/** Wide weights are shared. The label follows the side that was scored. */
function slotLabel(slot: Slot, sideMask: number): string {
  if (slot === "FC") return "F";
  const stem = slot === "DL" ? "D" : slot === "DML" ? "DM" : slot === "ML" ? "M" : slot === "AML" ? "AM" : "";
  if (!stem) return slot;
  const right = (sideMask & SIDE.right) !== 0;
  const left = (sideMask & SIDE.left) !== 0;
  if (right && !left) return `${stem}R`;
  if (left && !right) return `${stem}L`;
  if (right && left) return `${stem} RL`;
  return slot;
}

function scoreSlot(slot: Slot, valueOf: (key: AttrKey) => number): RoleRating | null {
  const weights = WEIGHTS[slot];
  const used: { key: AttrKey; weight: number; value: number }[] = [];
  for (const key of Object.keys(weights) as AttrKey[]) {
    const weight = weights[key] ?? 0;
    if (weight < SECONDARY) continue;
    const value = valueOf(key);
    if (!Number.isFinite(value) || value < 0) continue;
    used.push({ key, weight, value });
  }
  const stamina = valueOf("stamina");
  if (Number.isFinite(stamina) && stamina >= 0) {
    const existing = used.find((row) => row.key === "stamina");
    if (existing) existing.weight += STAMINA_PREFERENCE;
    else used.push({ key: "stamina", weight: STAMINA_PREFERENCE, value: stamina });
  }
  if (used.length === 0) return null;
  let sum = 0;
  let weightSum = 0;
  for (const row of used) {
    sum += row.weight * row.value;
    weightSum += row.weight;
  }
  if (weightSum <= 0) return null;
  used.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
  return {
    value: Math.round((sum / weightSum) * 10) / 10,
    slot,
    attrs: used.map((row) => ATTR_LABEL.get(row.key) ?? row.key),
  };
}

function roleBit(label: (typeof ROLES)[number]["label"]): number {
  const role = ROLES.find((entry) => entry.label === label);
  if (!role) throw new Error(`Missing role ${label}`);
  return role.bit;
}

const GK = roleBit("GK");
const D = roleBit("D");
const DM = roleBit("DM");
const M = roleBit("M");
const AM = roleBit("AM");
const F = roleBit("F");

const WIDE = SIDE.right | SIDE.left;

function slotsFor(posMask: number, sideMask: number): Slot[] {
  const wide = (sideMask & WIDE) !== 0;
  const central = sideMask === 0 || (sideMask & SIDE.centre) !== 0;
  const slots: Slot[] = [];
  if (posMask & GK) slots.push("GK");
  if (posMask & D) {
    if (central) slots.push("DC");
    if (wide) slots.push("DL");
  }
  if (posMask & DM) {
    if (central) slots.push("DMC");
    if (wide) slots.push("DML");
  }
  if (posMask & M) {
    if (central) slots.push("MC");
    if (wide) slots.push("ML");
  }
  if (posMask & AM) {
    if (central) slots.push("AMC");
    if (wide) slots.push("AML");
  }
  if (posMask & F) slots.push("FC");
  return slots;
}

/**
 * Strongest rank for each attribute across the positions this player can play.
 * A primary mark from one position wins over a secondary mark from another.
 */
export function attrRanksFor(posMask: number, sideMask: number): Map<AttrKey, AttrRank> {
  const ranks = new Map<AttrKey, AttrRank>();
  for (const slot of slotsFor(posMask, sideMask)) {
    for (const key of Object.keys(WEIGHTS[slot]) as AttrKey[]) {
      const rank = rankForWeight(WEIGHTS[slot][key] ?? 0);
      if (!rank || ranks.get(key) === "primary") continue;
      ranks.set(key, rank);
    }
  }
  for (const key of Object.keys(HIDDEN) as AttrKey[]) {
    const rank = HIDDEN[key];
    if (!rank || ranks.get(key) === "primary") continue;
    ranks.set(key, rank);
  }
  return ranks;
}

/** Hover text for a marked row. Hidden rows explain the match effect. */
export function attrRankTitle(key: AttrKey, rank: AttrRank | undefined): string | undefined {
  if (!rank) return undefined;
  return HIDDEN_TITLE[key] ?? (rank === "primary" ? "Position weight 0.10 or more" : "Position weight 0.05 to 0.10");
}

/** A goalkeeper with no outfield position. Set pieces are not their job. */
export function isPureGoalkeeper(posMask: number): boolean {
  return (posMask & GK) !== 0 && (posMask & ~GK) === 0;
}

/**
 * Every spot on the player pitch. Attack runs to the right; the top edge is
 * the left wing. Forward spots follow side, unlike the attribute weights,
 * which treat every forward as central.
 */
export type PitchSpot =
  | "GK"
  | "DL"
  | "DC"
  | "DR"
  | "DML"
  | "DMC"
  | "DMR"
  | "ML"
  | "MC"
  | "MR"
  | "AML"
  | "AMC"
  | "AMR"
  | "FL"
  | "FC"
  | "FR";

/**
 * Spots this player is listed for. A role with no side is central, same as
 * the attribute map. Goalkeeper ignores side.
 */
export function playedSpots(posMask: number, sideMask: number): Set<PitchSpot> {
  const spots = new Set<PitchSpot>();
  const left = (sideMask & SIDE.left) !== 0;
  const right = (sideMask & SIDE.right) !== 0;
  const centre = sideMask === 0 || (sideMask & SIDE.centre) !== 0;
  if (posMask & GK) spots.add("GK");
  const line = (role: number, onLeft: PitchSpot, onCentre: PitchSpot, onRight: PitchSpot) => {
    if ((posMask & role) === 0) return;
    if (left) spots.add(onLeft);
    if (centre) spots.add(onCentre);
    if (right) spots.add(onRight);
  };
  line(D, "DL", "DC", "DR");
  line(DM, "DML", "DMC", "DMR");
  line(M, "ML", "MC", "MR");
  line(AM, "AML", "AMC", "AMR");
  line(F, "FL", "FC", "FR");
  return spots;
}

const LINE_SPOTS: Partial<Record<number, readonly [PitchSpot, PitchSpot, PitchSpot]>> = {
  2: ["DL", "DC", "DR"],
  3: ["DML", "DMC", "DMR"],
  4: ["ML", "MC", "MR"],
  5: ["AML", "AMC", "AMR"],
  6: ["FL", "FC", "FR"],
};

/**
 * Spots that count as natural for one overview circle.
 * Columns are left, centre-left, centre, centre-right, right.
 * Centre-left accepts a left or a central player. Forwards share one weight set.
 */
export function circleSpots(row: number, col: number): PitchSpot[] {
  if (row === 0) return ["GK"];
  // Tactic files still use row 1 for a sweeper. Rate that circle as a centre-back.
  if (row === 1) return ["DC"];
  const line = LINE_SPOTS[row];
  if (!line) return [];
  const [left, centre, right] = line;
  if (col <= 0) return [left];
  if (col === 1) return [left, centre];
  if (col === 2) return [centre];
  if (col === 3) return [centre, right];
  return [right];
}

function fitSlot(row: number, col: number): Slot {
  if (row <= 0) return "GK";
  if (row === 1) return "DC";
  const wide = col <= 0 || col >= 4;
  if (row === 2) return wide ? "DL" : "DC";
  if (row === 3) return wide ? "DML" : "DMC";
  if (row === 4) return wide ? "ML" : "MC";
  if (row === 5) return wide ? "AML" : "AMC";
  return "FC";
}

/**
 * Position rating for one circle, 0 when no attribute is known.
 * Values may pass 20: that is the in-match figure, and it is not capped.
 */
export function positionFit(row: number, col: number, valueOf: (key: AttrKey) => number): number {
  const weights = WEIGHTS[fitSlot(row, col)];
  let sum = 0;
  let weightSum = 0;
  for (const key of Object.keys(weights) as AttrKey[]) {
    const value = valueOf(key);
    const weight = weights[key] ?? 0;
    if (weight <= 0 || !Number.isFinite(value) || value < 0) continue;
    sum += weight * value;
    weightSum += weight;
  }
  if (weightSum <= 0) return 0;
  return (sum / weightSum) * 5;
}
