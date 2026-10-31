export const ATTRS = [
  { key: "handling", label: "Handling", group: "goalkeeping" },
  { key: "reflexes", label: "Reflexes", group: "goalkeeping" },
  { key: "oneOnOnes", label: "One on ones", group: "goalkeeping" },
  { key: "jumping", label: "Jumping", group: "physical" },
  { key: "acceleration", label: "Acceleration", group: "physical" },
  { key: "pace", label: "Pace", group: "physical" },
  { key: "agility", label: "Agility", group: "physical" },
  { key: "balance", label: "Balance", group: "physical" },
  { key: "strength", label: "Strength", group: "physical" },
  { key: "stamina", label: "Stamina", group: "physical" },
  { key: "naturalFitness", label: "Natural fitness", group: "physical" },
  { key: "corners", label: "Corners", group: "technical" },
  { key: "crossing", label: "Crossing", group: "technical" },
  { key: "dribbling", label: "Dribbling", group: "technical" },
  { key: "finishing", label: "Finishing", group: "technical" },
  { key: "heading", label: "Heading", group: "technical" },
  { key: "longShots", label: "Long shots", group: "technical" },
  { key: "marking", label: "Marking", group: "technical" },
  { key: "passing", label: "Passing", group: "technical" },
  { key: "penalties", label: "Penalties", group: "technical" },
  { key: "tackling", label: "Tackling", group: "technical" },
  { key: "technique", label: "Technique", group: "technical" },
  { key: "throwIns", label: "Throw ins", group: "technical" },
  { key: "freeKicks", label: "Free kicks", group: "technical" },
  { key: "aggression", label: "Aggression", group: "mental" },
  { key: "anticipation", label: "Anticipation", group: "mental" },
  { key: "bravery", label: "Bravery", group: "mental" },
  { key: "decisions", label: "Decisions", group: "mental" },
  { key: "flair", label: "Flair", group: "mental" },
  { key: "leadership", label: "Leadership", group: "mental" },
  { key: "movement", label: "Movement", group: "mental" },
  { key: "positioning", label: "Positioning", group: "mental" },
  { key: "teamwork", label: "Teamwork", group: "mental" },
  { key: "vision", label: "Vision", group: "mental" },
  { key: "workRate", label: "Work rate", group: "mental" },
  { key: "consistency", label: "Consistency", group: "hidden" },
  { key: "dirtiness", label: "Dirtiness", group: "hidden" },
  { key: "importantMatches", label: "Important matches", group: "hidden" },
  { key: "injuryProneness", label: "Injury proneness", group: "hidden" },
  { key: "versatility", label: "Versatility", group: "hidden" },
  { key: "adaptability", label: "Adaptability", group: "hidden" },
  { key: "ambition", label: "Ambition", group: "hidden" },
  { key: "determination", label: "Determination", group: "hidden" },
  { key: "loyalty", label: "Loyalty", group: "hidden" },
  { key: "pressure", label: "Pressure", group: "hidden" },
  { key: "professionalism", label: "Professionalism", group: "hidden" },
  { key: "sportsmanship", label: "Sportsmanship", group: "hidden" },
  { key: "temperament", label: "Temperament", group: "hidden" },
] as const;

export type AttrKey = (typeof ATTRS)[number]["key"];
export type AttrGroup = (typeof ATTRS)[number]["group"];

export const ATTR_INDEX: Record<AttrKey, number> = Object.fromEntries(
  ATTRS.map((attr, index) => [attr.key, index]),
) as Record<AttrKey, number>;

export const GROUPS: { id: AttrGroup; label: string }[] = [
  { id: "goalkeeping", label: "Goalkeeping" },
  { id: "technical", label: "Technical" },
  { id: "mental", label: "Mental" },
  { id: "physical", label: "Physical" },
  { id: "hidden", label: "Hidden" },
];

/**
 * Positions the desk shows. The save still has a sweeper byte, but this
 * database has no sweepers, so that role is not a position here.
 */
export const ROLES = [
  { bit: 1, label: "GK", title: "Goalkeeper" },
  { bit: 4, label: "D", title: "Defender" },
  { bit: 8, label: "DM", title: "Defensive mid" },
  { bit: 16, label: "M", title: "Midfielder" },
  { bit: 32, label: "AM", title: "Attacking mid" },
  { bit: 64, label: "F", title: "Forward" },
] as const;

/** Bits that still count as a position. Drops a leftover sweeper bit on an old search. */
export const ROLE_MASK = ROLES.reduce((mask, role) => mask | role.bit, 0);

export const FLAG = {
  free: 1,
  loan: 2,
  listed: 4,
  request: 8,
  listLoan: 16,
  bosman: 32,
  arranged: 64,
  unprotected: 128,
  /** Staff job byte 16. Needs a 16-bit column; the lower eight bits are taken. */
  retired: 256,
} as const;

export type NationRec = {
  id: number;
  name: string;
  short: string;
  code: string;
  nationality: string;
};

export type CompRec = {
  id: number;
  name: string;
  short: string;
  nationId: number;
};

/** One overview circle. Row 0 is the goalkeeper, row 6 the attack. Column 0 is left. */
export type TacticSlot = { row: number; col: number };

export type TacticRec = {
  /** Record index in `tactics.dat`. `ClubRec.tacticId` uses this index. */
  id: number;
  name: string;
  /** Eleven overview circles, or null when those words do not decode. */
  slots: TacticSlot[] | null;
};

/**
 * A team picked in `human_manager.dat`. The club record's match squad can
 * stay empty after friendlies; this is the eleven with a position on each player.
 */
export type HumanPick = {
  tacticName: string;
  pitch: { staffId: number; slot: TacticSlot }[];
  /** Staff ids after the eleven. A value below 0 is an empty bench slot. */
  bench: number[];
};

export type ClubRec = {
  id: number;
  name: string;
  short: string;
  nationId: number;
  divisionId: number;
  reputation: number;
  cash: number;
  manager: string;
  /** Twenty staff ids. A value below 0 is an empty slot. */
  matchSquad: number[];
  /** Four training tactic ids. Stored only. */
  trainingTactics: number[];
  /** Index into `tactics`. Below 0 means no tactic selected. */
  tacticId: number;
};

export type PlayerRec = {
  id: number;
  name: string;
  fullName: string;
  sortName: string;
  nationId: number;
  secondNationId: number;
  clubId: number;
  pos: string;
  posMask: number;
  sideMask: number;
  age: number;
  ca: number;
  pa: number;
  wage: number;
  value: number;
  expiresOrd: number;
  flags: number;
  arrangedClubId: number;
  loanFromClubId: number;
  squadNo: number;
  morale: number;
  /** Match condition, 0–100. Below 0 when the save has no fitness table. */
  condition: number;
  /** Days until he is fit. Below 0 when he is not injured. */
  injuryDays: number;
  dobLabel: string;
  joinedLabel: string;
  expiresLabel: string;
  intApps: number;
  intGoals: number;
  homeRep: number;
  currentRep: number;
  worldRep: number;
  squadStatus: string;
  releaseFee: number;
  leftFoot: number;
  rightFoot: number;
};

/**
 * One row per player, stored as columns so a large database is a handful of
 * typed arrays plus the name strings. A `PlayerRec` is built only for a row
 * the screen is actually showing. Club membership is `clubPlayers` sliced by
 * the sorted `clubKeys` / `clubOffsets` pair.
 */
export type Roster = {
  count: number;
  id: Int32Array;
  nationId: Int32Array;
  secondNationId: Int32Array;
  clubId: Int32Array;
  posMask: Uint8Array;
  sideMask: Uint8Array;
  age: Int16Array;
  ca: Int16Array;
  pa: Int16Array;
  wage: Int32Array;
  value: Int32Array;
  expiresOrd: Int32Array;
  flags: Uint16Array;
  arrangedClubId: Int32Array;
  loanFromClubId: Int32Array;
  squadNo: Uint8Array;
  morale: Uint8Array;
  condition: Int16Array;
  /** Days until fit, or -1. Parallel to `condition`. */
  injuryDays: Int16Array;
  intApps: Uint8Array;
  intGoals: Uint8Array;
  homeRep: Uint16Array;
  currentRep: Uint16Array;
  worldRep: Uint16Array;
  releaseFee: Int32Array;
  leftFoot: Int8Array;
  rightFoot: Int8Array;
  name: string[];
  fullName: string[];
  sortName: string[];
  pos: string[];
  dobLabel: string[];
  joinedLabel: string[];
  expiresLabel: string[];
  squadStatus: string[];
  clubKeys: Int32Array;
  clubOffsets: Int32Array;
  clubPlayers: Int32Array;
  freePlayers: Int32Array;
};

export type ParsedSave = {
  fileName: string;
  compressed: boolean;
  byteLength: number;
  blockCount: number;
  blockNames: string[];
  gameDateLabel: string;
  gameOrd: number;
  gameYear: number;
  /** 0-based day of year of the game date. Below 0 when the date is missing. */
  gameDay: number;
  humanClubId: number;
  nations: NationRec[];
  comps: CompRec[];
  clubs: ClubRec[];
  tactics: TacticRec[];
  /**
   * Raw `human_manager.dat`. The picked eleven is decoded for the club on
   * screen, not for every club in the file. Null when the block is absent.
   * Owns its buffer, so the rest of the file can be discarded.
   */
  humanManager: Uint8Array | null;
  roster: Roster;
  /** Int8 attribute values, row-major, ATTRS.length per player. -1 unknown. */
  attrs: Int8Array;
  warnings: string[];
};

export type ProgressUpdate = { pct: number; label: string };
