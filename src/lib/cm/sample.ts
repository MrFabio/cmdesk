import { intrinsicForDisplay, toSignedByte } from "./attr-display.ts";
import { compressBlock, putCstr } from "./binary.ts";
import type { AttrKey } from "./types.ts";

/** Fictional career. Not a real Championship Manager database. */
const BLOCK = 268;
const STAFF = 110;
const PLAYER = 70;
const NAME = 60;
const CLUB = 581;
const COMP = 107;
const NATION = 290;
const CONTRACT = 80;
const HISTORY = 17;

type Parts = [number, number, number];
type Role = "gk" | "sw" | "d" | "dm" | "m" | "am" | "f" | "r" | "l" | "c";

type ContractIn = {
  club: number;
  wage?: number;
  /** Contract type byte; 6 = loan at this club. */
  type?: number;
  status?: number;
  bosman?: number;
  arranged?: number;
  release?: number;
};

type Person = {
  first: string;
  second: string;
  common?: string;
  nation: number;
  club: number;
  job: number;
  wage: number;
  value: number;
  dob: Parts;
  joined?: Parts;
  expires?: Parts;
  apps?: number;
  goals?: number;
  contracts: ContractIn[];
  history?: { year: number; club: number; onLoan: number }[];
  player: null | {
    squad: number;
    ca: number;
    pa: number;
    morale: number;
    condition?: number;
    /** Days until he is fit. Omit when he is not injured. */
    outFor?: number;
    roles: Partial<Record<Role, number>>;
    attrs: Record<string, number>;
    left: number;
    right: number;
    reps: [number, number, number];
  };
};

const ROLE_AT: Record<Role, number> = {
  gk: 15,
  sw: 16,
  d: 17,
  dm: 18,
  m: 19,
  am: 20,
  f: 21,
  r: 23,
  l: 24,
  c: 25,
};

const ATTR_AT: Record<string, number> = {
  handling: 42,
  reflexes: 58,
  oneOnOnes: 53,
  jumping: 46,
  acceleration: 27,
  pace: 54,
  agility: 29,
  balance: 31,
  strength: 61,
  stamina: 60,
  naturalFitness: 52,
  corners: 34,
  crossing: 35,
  dribbling: 38,
  finishing: 39,
  heading: 43,
  longShots: 49,
  marking: 50,
  passing: 55,
  penalties: 56,
  tackling: 62,
  technique: 64,
  throwIns: 65,
  freeKicks: 41,
  aggression: 28,
  anticipation: 30,
  bravery: 32,
  decisions: 36,
  flair: 40,
  leadership: 47,
  movement: 51,
  positioning: 57,
  teamwork: 63,
  vision: 67,
  workRate: 68,
  consistency: 33,
  dirtiness: 37,
  importantMatches: 44,
  injuryProneness: 45,
  versatility: 66,
};

const HIDDEN = [
  "adaptability",
  "ambition",
  "determination",
  "loyalty",
  "pressure",
  "professionalism",
  "sportsmanship",
  "temperament",
];

function dayIndex(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000);
}

function writeDate(view: DataView, offset: number, parts: Parts) {
  view.setInt16(offset, dayIndex(parts[0], parts[1], parts[2]), true);
  view.setInt16(offset + 2, parts[0], true);
  view.setInt32(offset + 4, 0, true);
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value: number) {
  return Math.max(1, Math.min(20, value));
}

function attrsFrom(ca: number, roll: () => number, bias: Record<string, number> = {}) {
  const base = clamp(Math.round(ca / 10));
  const attrs: Record<string, number> = {};
  for (const key of Object.keys(ATTR_AT)) {
    attrs[key] = clamp(base + (bias[key] ?? 0) + Math.round((roll() - 0.5) * 5));
  }
  for (const key of HIDDEN) attrs[key] = clamp(10 + Math.round((roll() - 0.5) * 6));
  return attrs;
}

function flat(ca: number, value: number) {
  const attrs: Record<string, number> = {};
  for (const key of Object.keys(ATTR_AT)) attrs[key] = value;
  for (const key of HIDDEN) attrs[key] = value;
  void ca;
  return attrs;
}

const FIRST = [
  "Ellis", "Ivo", "Nils", "Pavel", "Omar", "Hugo", "Leif", "Tomas", "Evan", "Colin",
  "Rhys", "Anton", "Marco", "Felix", "Jonas", "Petr", "Callum", "Idris", "Yves", "Otto",
  "Sacha", "Benno", "Arlo", "Malik", "Ruben", "Theo", "Casper", "Noel", "Edvin", "Farid",
];
const SECOND = [
  "Ward", "Moss", "Drake", "Holm", "Varga", "Costa", "Berg", "Novak", "Shaw", "Klein",
  "Duval", "Sato", "Reeves", "Adler", "Moreau", "Lang", "Pietsch", "Baines", "Cho", "Keller",
  "Marin", "Okada", "Navarro", "Frost", "Abebe", "Quill", "Hart", "Silva", "Nemeth", "Crowe",
];

const SHAPES: Partial<Record<Role, number>>[] = [
  { gk: 20 },
  { d: 20, c: 20 },
  { d: 20, r: 20 },
  { d: 20, l: 20 },
  { dm: 20, c: 20 },
  { m: 20, c: 20 },
  { m: 20, r: 20 },
  { am: 20, c: 20 },
  { f: 20, c: 20 },
  { f: 20, l: 20 },
];

function story(): Person[] {
  const roll = rng(20102);
  const people: Person[] = [
    {
      first: "Pat",
      second: "Quinn",
      nation: 0,
      club: 0,
      job: 5,
      wage: 7000,
      value: 0,
      dob: [1958, 4, 2],
      joined: [1999, 6, 1],
      contracts: [],
      player: null,
    },
    {
      first: "Ines",
      second: "Kade",
      nation: 0,
      club: 1,
      job: 5,
      wage: 6000,
      value: 0,
      dob: [1962, 11, 9],
      joined: [2000, 7, 1],
      contracts: [],
      player: null,
    },
    {
      first: "Otto",
      second: "Bram",
      nation: 1,
      club: 2,
      job: 5,
      wage: 2500,
      value: 0,
      dob: [1955, 1, 20],
      joined: [1998, 8, 1],
      contracts: [],
      player: null,
    },
    player({
      first: "Mira",
      second: "Calder",
      nation: 0,
      club: 0,
      wage: 12000,
      value: 4_500_000,
      dob: [1976, 4, 3],
      joined: [1999, 7, 1],
      expires: [2004, 6, 30],
      squad: 1,
      ca: 150,
      pa: 160,
      morale: 9,
      condition: 100,
      roles: { gk: 20 },
      attrs: {
        ...attrsFrom(150, roll, { handling: 4, reflexes: 3, oneOnOnes: 3, pace: -6, finishing: -8 }),
        handling: 18,
        reflexes: 17,
        oneOnOnes: 16,
      },
      left: 8,
      right: 20,
      reps: [8000, 7600, 6400],
    }),
    player({
      first: "Jon",
      second: "Hale",
      nation: 0,
      club: 0,
      wage: 8000,
      value: 2_000_000,
      dob: [1970, 5, 12],
      joined: [1998, 8, 1],
      expires: [2002, 3, 1],
      squad: 9,
      ca: 134,
      pa: 142,
      morale: 4,
      condition: 64,
      roles: { f: 20, c: 20 },
      attrs: attrsFrom(134, roll, { finishing: 3, pace: 2, heading: 2, tackling: -4 }),
      left: 12,
      right: 20,
      reps: [6200, 6000, 4100],
      contracts: [{ club: 0, status: 8, bosman: 1, arranged: -1, release: 0 }],
    }),
    player({
      first: "Ade",
      second: "Okonkwo",
      nation: 0,
      club: 0,
      wage: 3000,
      value: 800_000,
      dob: [1982, 9, 20],
      joined: [2001, 8, 1],
      expires: [2002, 6, 30],
      squad: 8,
      ca: 112,
      pa: 148,
      morale: 7,
      roles: { m: 20, c: 20 },
      attrs: attrsFrom(112, roll, { passing: 3, vision: 2, stamina: 2 }),
      left: 20,
      right: 11,
      reps: [2800, 3000, 1200],
      contracts: [
        { club: 0, wage: 1200, type: 6, status: 0, bosman: 0, arranged: -1 },
        { club: 1, wage: 3000, type: 2, status: 0, bosman: 0, arranged: -1 },
      ],
      history: [{ year: 2001, club: 0, onLoan: 1 }],
    }),
    player({
      first: "Sam",
      second: "Voss",
      nation: 0,
      club: -1,
      wage: 0,
      value: 250_000,
      dob: [1975, 2, 2],
      squad: 0,
      ca: 108,
      pa: 118,
      morale: 5,
      roles: { d: 20, c: 20 },
      attrs: attrsFrom(108, roll, { tackling: 3, marking: 2, pace: -2 }),
      left: 14,
      right: 20,
      reps: [2400, 1800, 600],
      contracts: [],
    }),
    player({
      first: "Luis",
      second: "Ferrer",
      nation: 0,
      club: 1,
      wage: 9000,
      value: 3_200_000,
      dob: [1974, 11, 8],
      joined: [1997, 7, 1],
      expires: [2003, 6, 30],
      squad: 10,
      ca: 146,
      pa: 152,
      morale: 6,
      roles: { am: 20, c: 20, l: 18 },
      attrs: attrsFrom(146, roll, { passing: 3, technique: 3, flair: 2, tackling: -3 }),
      left: 20,
      right: 9,
      reps: [7000, 6800, 5000],
      outFor: 16,
      contracts: [{ club: 1, status: 1, bosman: 0, arranged: -1, release: 5_000_000 }],
    }),
    player({
      first: "Ned",
      second: "Pell",
      common: "Pello",
      nation: 0,
      club: 0,
      wage: 400,
      value: 40_000,
      dob: [1983, 1, 1],
      joined: [2001, 7, 1],
      expires: [2003, 6, 30],
      squad: 24,
      ca: 48,
      pa: 70,
      morale: 6,
      roles: { d: 20, r: 20 },
      attrs: flat(48, 4),
      left: 12,
      right: 20,
      reps: [400, 300, 100],
    }),
    player({
      first: "Kit",
      second: "Marin",
      nation: 0,
      club: 2,
      wage: 1500,
      value: 1_200_000,
      dob: [1984, 6, 12],
      joined: [2001, 7, 1],
      expires: [2005, 6, 30],
      squad: 17,
      ca: 92,
      pa: 176,
      morale: 8,
      roles: { am: 20, f: 16, c: 20 },
      attrs: attrsFrom(92, roll, { flair: 4, dribbling: 3, pace: 3, strength: -3 }),
      left: 20,
      right: 14,
      reps: [900, 1100, 400],
    }),
    player({
      first: "Søren",
      second: "Lind",
      nation: 1,
      club: 1,
      wage: 15000,
      value: 6_000_000,
      dob: [1977, 1, 30],
      joined: [2000, 8, 12],
      expires: [2004, 6, 30],
      squad: 7,
      ca: 158,
      pa: 168,
      morale: 8,
      roles: { m: 20, c: 20 },
      attrs: attrsFrom(158, roll, { passing: 3, vision: 3, technique: 2 }),
      left: 20,
      right: 16,
      reps: [8400, 8200, 7900],
      apps: 12,
      goals: 3,
    }),
    player({
      first: "Ellis",
      second: "Ward",
      nation: 0,
      club: 0,
      wage: 4500,
      value: 900_000,
      dob: [1979, 3, 14],
      joined: [1999, 7, 1],
      expires: [2003, 6, 30],
      squad: 2,
      ca: 124,
      pa: 136,
      morale: 7,
      roles: { d: 20, l: 20 },
      attrs: attrsFrom(124, roll, { tackling: 2, marking: 2 }),
      left: 20,
      right: 10,
      reps: [3600, 3400, 1500],
      contracts: [{ club: 0, status: 2, arranged: -1 }],
    }),
    player({
      first: "Rowan",
      second: "Keel",
      nation: 0,
      club: 2,
      wage: 900,
      value: 180_000,
      dob: [1980, 10, 2],
      joined: [2001, 7, 1],
      expires: [2001, 11, 20],
      squad: 11,
      ca: 96,
      pa: 110,
      morale: 5,
      roles: { f: 20, c: 20 },
      attrs: attrsFrom(96, roll, { finishing: 2, pace: 2 }),
      left: 11,
      right: 20,
      reps: [800, 700, 200],
    }),
    player({
      first: "Ivo",
      second: "Moss",
      nation: 1,
      club: 1,
      wage: 5000,
      value: 1_100_000,
      dob: [1978, 8, 19],
      joined: [1998, 7, 1],
      expires: [2002, 6, 30],
      squad: 4,
      ca: 128,
      pa: 140,
      morale: 6,
      roles: { dm: 20, c: 20 },
      attrs: attrsFrom(128, roll, { tackling: 2, positioning: 2 }),
      left: 14,
      right: 20,
      reps: [4000, 3900, 2200],
      contracts: [{ club: 1, status: 0, arranged: 2, release: 1_500_000 }],
    }),
    player({
      first: "Lars",
      second: "Holm",
      nation: 1,
      club: -1,
      job: 16,
      wage: 0,
      value: 0,
      dob: [1968, 3, 14],
      squad: 0,
      ca: 140,
      pa: 150,
      morale: 0,
      roles: { d: 20, c: 20 },
      attrs: attrsFrom(140, roll, { tackling: 2 }),
      left: 12,
      right: 18,
      reps: [5000, 4000, 3000],
    }),
  ];

  const used = new Set(people.map((person) => `${person.first} ${person.second}`));
  let nameCursor = 0;
  const addFillers = (club: number, count: number) => {
    for (let n = 0; n < count; n += 1) {
      let first = FIRST[nameCursor % FIRST.length]!;
      let second = SECOND[(nameCursor * 3) % SECOND.length]!;
      nameCursor += 1;
      while (used.has(`${first} ${second}`)) {
        first = FIRST[nameCursor % FIRST.length]!;
        second = SECOND[(nameCursor * 5) % SECOND.length]!;
        nameCursor += 1;
      }
      used.add(`${first} ${second}`);
      const shapeIndex = (((club + 3) * 5 + n) % SHAPES.length + SHAPES.length) % SHAPES.length;
      const shape = SHAPES[shapeIndex]!;
      const ca = 60 + Math.floor(roll() * 80);
      const pa = Math.min(190, ca + 8 + Math.floor(roll() * 28));
      const year = 1973 + Math.floor(roll() * 10);
      people.push(
        player({
          first,
          second,
          nation: roll() > 0.8 ? 1 : 0,
          club,
          wage: 800 + ca * 40,
          value: ca * 18_000,
          dob: [year, 1 + Math.floor(roll() * 12), 1 + Math.floor(roll() * 27)],
          joined: [1996 + Math.floor(roll() * 4), 7, 1],
          expires: [2003 + Math.floor(roll() * 3), 6, 30],
          squad: n + 3,
          ca,
          pa,
          morale: 5 + Math.floor(roll() * 5),
          roles: shape,
          attrs: attrsFrom(ca, roll, shape.gk ? { handling: 4, reflexes: 3, finishing: -6 } : { handling: -6, reflexes: -6 }),
          left: 8 + Math.floor(roll() * 12),
          right: 12 + Math.floor(roll() * 8),
          reps: [ca * 40, ca * 36, ca * 20],
        }),
      );
    }
  };
  addFillers(0, 12);
  addFillers(1, 12);
  addFillers(2, 12);
  addFillers(-1, 3);
  return people;
}

function player(input: Omit<Person, "job" | "contracts" | "player"> & {
  squad: number;
  ca: number;
  pa: number;
  morale: number;
  condition?: number;
  outFor?: number;
  roles: Partial<Record<Role, number>>;
  attrs: Record<string, number>;
  left: number;
  right: number;
  reps: [number, number, number];
  contracts?: ContractIn[];
  history?: Person["history"];
  /** Club job byte. 11 is a player; 16 is retired. */
  job?: number;
}): Person {
  return {
    first: input.first,
    second: input.second,
    common: input.common,
    nation: input.nation,
    club: input.club,
    job: input.job ?? 11,
    wage: input.wage,
    value: input.value,
    dob: input.dob,
    joined: input.joined,
    expires: input.expires,
    apps: input.apps,
    goals: input.goals,
    contracts: input.contracts ?? (input.club >= 0 ? [{ club: input.club, arranged: -1 }] : []),
    history: input.history,
    player: {
      squad: input.squad,
      ca: input.ca,
      pa: input.pa,
      morale: input.morale,
      condition: input.condition,
      outFor: input.outFor,
      roles: input.roles,
      attrs: input.attrs,
      left: input.left,
      right: input.right,
      reps: input.reps,
    },
  };
}

function namesBlock(list: string[]) {
  const bytes = new Uint8Array(Math.max(1, list.length) * NAME);
  const view = new DataView(bytes.buffer);
  list.forEach((text, index) => {
    const at = index * NAME;
    putCstr(bytes, at, text, 51);
    view.setInt32(at + 51, index, true);
  });
  return bytes;
}

function pack(blocks: { name: string; data: Uint8Array }[], compressed: boolean): ArrayBuffer {
  const header = 12 + blocks.length * BLOCK;
  const payloads = blocks.map((block) => (compressed ? compressBlock(block.data) : block.data));
  const total = header + payloads.reduce((sum, payload) => sum + payload.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setInt32(0, compressed ? 4 : 3, true);
  view.setInt32(4, 0, true);
  view.setInt32(8, blocks.length, true);
  let cursor = header;
  blocks.forEach((block, index) => {
    const at = 12 + index * BLOCK;
    view.setUint32(at, cursor, true);
    view.setUint32(at + 4, block.data.length, true);
    putCstr(out, at + 8, block.name, 200);
    out.set(payloads[index]!, cursor);
    cursor += payloads[index]!.length;
  });
  return out.buffer;
}

export function buildSample(compressed = true): ArrayBuffer {
  const people = story();
  const firsts: string[] = [];
  const seconds: string[] = [];
  const commons: string[] = [];
  const intern = (list: string[], text: string) => {
    const found = list.indexOf(text);
    if (found >= 0) return found;
    list.push(text);
    return list.length - 1;
  };

  let playerCount = 0;
  const playerIndex = people.map((person) => (person.player ? playerCount++ : -1));

  const staffBytes = new Uint8Array(people.length * STAFF);
  const staffView = new DataView(staffBytes.buffer);
  const playerBytes = new Uint8Array(playerCount * PLAYER);
  const playerView = new DataView(playerBytes.buffer);

  people.forEach((person, index) => {
    const at = index * STAFF;
    staffView.setInt32(at, index, true);
    staffView.setInt32(at + 4, intern(firsts, person.first), true);
    staffView.setInt32(at + 8, intern(seconds, person.second), true);
    staffView.setInt32(at + 12, person.common ? intern(commons, person.common) : -1, true);
    writeDate(staffView, at + 16, person.dob);
    staffView.setUint16(at + 24, person.dob[0], true);
    staffView.setInt32(at + 26, person.nation, true);
    staffView.setInt32(at + 30, -1, true);
    staffBytes[at + 34] = person.apps ?? 0;
    staffBytes[at + 35] = person.goals ?? 0;
    staffView.setInt32(at + 57, person.club, true);
    staffBytes[at + 61] = person.job;
    if (person.joined) writeDate(staffView, at + 62, person.joined);
    if (person.expires) writeDate(staffView, at + 70, person.expires);
    staffView.setInt32(at + 78, person.wage, true);
    staffView.setInt32(at + 82, person.value, true);
    HIDDEN.forEach((key, hiddenIndex) => {
      staffBytes[at + 86 + hiddenIndex] = person.player?.attrs[key] ?? 10;
    });
    staffView.setInt32(at + 97, playerIndex[index] ?? -1, true);

    const sheet = person.player;
    const pIndex = playerIndex[index] ?? -1;
    if (!sheet || pIndex < 0) return;
    const pAt = pIndex * PLAYER;
    playerBytes[pAt + 4] = sheet.squad;
    playerView.setInt16(pAt + 5, sheet.ca, true);
    playerView.setInt16(pAt + 7, sheet.pa, true);
    playerView.setUint16(pAt + 9, sheet.reps[0], true);
    playerView.setUint16(pAt + 11, sheet.reps[1], true);
    playerView.setUint16(pAt + 13, sheet.reps[2], true);
    for (const [role, value] of Object.entries(sheet.roles) as [Role, number][]) {
      playerBytes[pAt + ROLE_AT[role]] = value;
    }
    for (const [key, offset] of Object.entries(ATTR_AT)) {
      const shown = sheet.attrs[key] ?? 1;
      const intrinsic = intrinsicForDisplay(key as AttrKey, shown, sheet.ca);
      playerBytes[pAt + offset] = toSignedByte(intrinsic);
    }
    playerBytes[pAt + 48] = sheet.left;
    playerBytes[pAt + 59] = sheet.right;
    playerBytes[pAt + 69] = sheet.morale;
  });

  const contracts = people.flatMap((person, staffId) =>
    person.contracts.map((contract) => ({
      ...contract,
      staffId,
      wage: contract.wage ?? person.wage,
      started: person.joined,
      expires: person.expires,
    })),
  );
  const contractBytes = new Uint8Array(8 + contracts.length * CONTRACT);
  const contractView = new DataView(contractBytes.buffer);
  contractView.setInt32(0, 0, true);
  contractView.setInt32(4, contracts.length, true);
  contracts.forEach((contract, index) => {
    const at = 8 + index * CONTRACT;
    contractView.setInt32(at, contract.staffId, true);
    contractView.setInt32(at + 4, contract.club, true);
    contractView.setInt32(at + 12, contract.wage, true);
    contractView.setInt32(at + 33, contract.release ?? 0, true);
    if (contract.started) writeDate(contractView, at + 37, contract.started);
    if (contract.expires) writeDate(contractView, at + 45, contract.expires);
    contractBytes[at + 53] = contract.type ?? 2;
    contractBytes[at + 73] = contract.bosman ?? 0;
    contractView.setInt32(at + 74, contract.arranged ?? -1, true);
    contractBytes[at + 78] = contract.status ?? 0;
    contractBytes[at + 79] = 32;
  });

  const history = people.flatMap((person, staffId) =>
    (person.history ?? []).map((row) => ({ ...row, staffId })),
  );
  const historyBytes = new Uint8Array(history.length * HISTORY);
  const historyView = new DataView(historyBytes.buffer);
  history.forEach((row, index) => {
    const at = index * HISTORY;
    historyView.setInt32(at + 4, row.staffId, true);
    historyView.setInt16(at + 8, row.year, true);
    historyView.setInt32(at + 10, row.club, true);
    historyBytes[at + 14] = row.onLoan;
  });

  const nations = [
    ["Albion", "Albion", "ALB", "Albionese"],
    ["Nordmark", "Nordmark", "NRD", "Nordmarker"],
  ];
  const nationBytes = new Uint8Array(nations.length * NATION);
  nations.forEach((nation, index) => {
    const at = index * NATION;
    putCstr(nationBytes, at + 4, nation[0]!, 51);
    putCstr(nationBytes, at + 56, nation[1]!, 26);
    putCstr(nationBytes, at + 83, nation[2]!, 4);
    putCstr(nationBytes, at + 87, nation[3]!, 26);
  });

  const comps = [
    ["Premier Division", "Premier", 0],
    ["Second Division", "Second", 0],
  ] as const;
  const compBytes = new Uint8Array(comps.length * COMP);
  const compView = new DataView(compBytes.buffer);
  comps.forEach((comp, index) => {
    const at = index * COMP;
    putCstr(compBytes, at + 4, comp[0], 51);
    putCstr(compBytes, at + 56, comp[1], 26);
    compView.setInt32(at + 93, comp[2], true);
  });

  const clubs = [
    ["Northbridge", "Northbridge", 0, 0, 2_400_000, 7200],
    ["Redwick", "Redwick", 0, 0, 860_000, 6800],
    ["Harbour", "Harbour", 0, 1, 140_000, 4100],
  ] as const;
  const clubBytes = new Uint8Array(clubs.length * CLUB);
  const clubView = new DataView(clubBytes.buffer);
  clubs.forEach((club, index) => {
    const at = index * CLUB;
    putCstr(clubBytes, at + 4, club[0], 51);
    putCstr(clubBytes, at + 56, club[1], 26);
    clubView.setInt32(at + 83, club[2], true);
    clubView.setInt32(at + 87, club[3], true);
    clubView.setInt32(at + 101, club[4], true);
    clubView.setUint16(at + 128, club[5], true);
  });

  const general = new Uint8Array(4000);
  const generalView = new DataView(general.buffer);
  putCstr(general, 0x824, "Northbridge", 40);
  writeDate(generalView, 3944, [2001, 10, 15]);

  const FITNESS = 31;
  const ENTRY = 48;
  const injured: number[] = [];
  const injuryRows = new Uint8Array(people.length * FITNESS);
  const injuryView = new DataView(injuryRows.buffer);
  people.forEach((person, index) => {
    const at = index * FITNESS;
    writeDate(injuryView, at, [2001, 10, 15]);
    const percent = person.player?.condition ?? (person.player ? 80 + (index % 21) : 100);
    injuryView.setUint16(at + 8, 10_000, true);
    injuryView.setUint16(at + 10, percent * 100, true);
    injuryView.setInt32(at + 0x0e, -1, true);
    if ((person.player?.outFor ?? 0) > 0) injured.push(index);
  });
  const table = new Uint8Array(4 + injured.length * ENTRY);
  const tableView = new DataView(table.buffer);
  tableView.setInt32(0, injured.length, true);
  injured.forEach((staffIndex, index) => {
    const days = people[staffIndex]?.player?.outFor ?? 0;
    injuryView.setInt32(staffIndex * FITNESS + 0x0e, index, true);
    tableView.setInt16(4 + index * ENTRY + 0x2c, days, true);
  });
  const injuryBytes = new Uint8Array(injuryRows.length + table.length);
  injuryBytes.set(injuryRows);
  injuryBytes.set(table, injuryRows.length);

  const counted = [
    ["staff.dat", people.length],
    ["player.dat", playerCount],
    ["club.dat", clubs.length],
    ["nation.dat", nations.length],
    ["first_names.dat", firsts.length],
    ["second_names.dat", seconds.length],
    ["common_names.dat", commons.length],
    ["club_comp.dat", comps.length],
    ["staff_history.dat", history.length],
  ] as const;
  const indexBytes = new Uint8Array(counted.length * 67);
  const indexView = new DataView(indexBytes.buffer);
  counted.forEach((row, index) => {
    const at = index * 67;
    putCstr(indexBytes, at, row[0], 51);
    indexView.setInt32(at + 55, row[1], true);
  });

  return pack(
    [
      { name: "index.dat", data: indexBytes },
      { name: "general.dat", data: general },
      { name: "nation.dat", data: nationBytes },
      { name: "club_comp.dat", data: compBytes },
      { name: "club.dat", data: clubBytes },
      { name: "first_names.dat", data: namesBlock(firsts) },
      { name: "second_names.dat", data: namesBlock(seconds) },
      { name: "common_names.dat", data: namesBlock(commons) },
      { name: "staff.dat", data: staffBytes },
      { name: "player.dat", data: playerBytes },
      { name: "contract.dat", data: contractBytes },
      { name: "staff_history.dat", data: historyBytes },
      { name: "injury.dat", data: injuryBytes },
    ],
    compressed,
  );
}
