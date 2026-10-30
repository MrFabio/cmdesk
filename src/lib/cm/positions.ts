import { ROLES, type AttrKey } from "./types.ts";

/** Side bytes in player.dat: right +23, left +24, centre +25. Set when the byte is >= 15. */
export const SIDE = { right: 1, left: 2, centre: 4 } as const;

type Slot = "GK" | "SW" | "DC" | "DL" | "DMC" | "DML" | "MC" | "ML" | "AMC" | "AML" | "FC";

/**
 * Position-rating weights from the CM 01/02 fit.
 * Primary is weight >= 0.10. Secondary is 0.05 up to 0.10.
 * The save only stores GK/SW/D/DM/M/AM/F plus side, so wide and central slots
 * are chosen from that. Sweeper has no separate fit and uses the central
 * defender weights. Wide attacking mid has no separate fit and uses the wide
 * mid weights. Every forward uses the central-forward weights. The wide-player
 * foot rating (about 0.06–0.08) is left out; feet are shown on their own.
 */
const PRIMARY = 0.1;
const SECONDARY = 0.05;

export type AttrRank = "primary" | "secondary";

const WEIGHTS: Record<Slot, Partial<Record<AttrKey, number>>> = {
  GK: { handling: 0.159, agility: 0.069, reflexes: 0.06 },
  SW: {
    marking: 0.115,
    positioning: 0.114,
    teamwork: 0.04,
    passing: 0.031,
    jumping: 0.027,
    aggression: 0.024,
    workRate: 0.022,
    pace: 0.019,
  },
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

function roleBit(label: (typeof ROLES)[number]["label"]): number {
  const role = ROLES.find((entry) => entry.label === label);
  if (!role) throw new Error(`Missing role ${label}`);
  return role.bit;
}

const GK = roleBit("GK");
const SW = roleBit("SW");
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
  if (posMask & SW) slots.push("SW");
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
  return ranks;
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
  | "SW"
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
 * the attribute map. Sweeper and goalkeeper ignore side.
 */
export function playedSpots(posMask: number, sideMask: number): Set<PitchSpot> {
  const spots = new Set<PitchSpot>();
  const left = (sideMask & SIDE.left) !== 0;
  const right = (sideMask & SIDE.right) !== 0;
  const centre = sideMask === 0 || (sideMask & SIDE.centre) !== 0;
  if (posMask & GK) spots.add("GK");
  if (posMask & SW) spots.add("SW");
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
