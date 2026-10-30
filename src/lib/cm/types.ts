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

/** Outfield / goalkeeper role bits, threshold 15 in the file. */
export const ROLES = [
  { bit: 1, label: "GK", title: "Goalkeeper" },
  { bit: 2, label: "SW", title: "Sweeper" },
  { bit: 4, label: "D", title: "Defender" },
  { bit: 8, label: "DM", title: "Defensive mid" },
  { bit: 16, label: "M", title: "Midfielder" },
  { bit: 32, label: "AM", title: "Attacking mid" },
  { bit: 64, label: "F", title: "Forward" },
] as const;

export const FLAG = {
  free: 1,
  loan: 2,
  listed: 4,
  request: 8,
  listLoan: 16,
  bosman: 32,
  arranged: 64,
  unprotected: 128,
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

export type ClubRec = {
  id: number;
  name: string;
  short: string;
  nationId: number;
  divisionId: number;
  reputation: number;
  cash: number;
  manager: string;
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

export type ParsedSave = {
  fileName: string;
  compressed: boolean;
  byteLength: number;
  blockCount: number;
  blockNames: string[];
  gameDateLabel: string;
  gameOrd: number;
  gameYear: number;
  humanClubId: number;
  nations: NationRec[];
  comps: CompRec[];
  clubs: ClubRec[];
  players: PlayerRec[];
  /** Int8 attribute values, row-major, ATTRS.length per player. -1 unknown. */
  attrs: Int8Array;
  warnings: string[];
};

export type ProgressUpdate = { pct: number; label: string };
