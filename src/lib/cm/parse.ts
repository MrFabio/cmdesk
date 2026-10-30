import { displayAttr } from "./attr-display.ts";
import { cstr, dateFrom, formatDate, i16, i32, monthOrd, u16, viewOf } from "./binary.ts";
import {
  ATTRS,
  ATTR_INDEX,
  FLAG,
  type CompRec,
  type HumanPick,
  type ParsedSave,
  type PlayerRec,
  type ProgressUpdate,
  type TacticRec,
  type TacticSlot,
} from "./types.ts";

const BLOCK_HEADER = 268;
const STAFF = 110;
const PLAYER = 70;
const NAME = 60;
const CLUB = 581;
const COMP = 107;
const NATION = 290;
const CONTRACT = 80;
const HISTORY = 17;

const JOB_MANAGER = 5;
const JOB_ASSISTANT = 6;

type Block = { name: string; position: number; size: number };

const NEEDED = [
  "staff.dat",
  "player.dat",
  "club.dat",
  "nation.dat",
  "first_names.dat",
  "second_names.dat",
  "common_names.dat",
  "contract.dat",
  "club_comp.dat",
  "general.dat",
  "staff_history.dat",
  "index.dat",
  "tactics.dat",
  "human_manager.dat",
  "injury.dat",
];

export function parseSave(
  buffer: ArrayBuffer,
  fileName: string,
  onProgress?: (update: ProgressUpdate) => void,
): ParsedSave {
  const report = (pct: number, label: string) => onProgress?.({ pct, label });
  report(4, "Reading the save directory");
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (buffer.byteLength < 16) {
    throw new Error("This file is too small to be a 01/02 save.");
  }
  const flag = view.getInt32(0, true);
  if (flag !== 3 && flag !== 4) {
    throw new Error(
      "This does not look like a Championship Manager 01/02 save. Plain saves start with marker 3, compressed saves with marker 4.",
    );
  }
  const compressed = flag === 4;
  const blockCount = view.getInt32(8, true);
  if (blockCount < 1 || blockCount > 4000) {
    throw new Error("The save directory is not a block count this reader understands.");
  }
  const directoryEnd = 12 + blockCount * BLOCK_HEADER;
  if (directoryEnd > buffer.byteLength) {
    throw new Error("The save ended before the block directory finished.");
  }

  const blocks: Block[] = [];
  const blockNames: string[] = [];
  for (let i = 0; i < blockCount; i += 1) {
    const at = 12 + i * BLOCK_HEADER;
    const position = view.getUint32(at, true);
    const size = view.getUint32(at + 4, true);
    let end = at + 8;
    const nameEnd = at + BLOCK_HEADER;
    while (end < nameEnd && bytes[end] !== 0) end += 1;
    const name = latin1(bytes.subarray(at + 8, end));
    blocks.push({ name, position, size });
    blockNames.push(name);
  }

  report(12, "Unpacking player tables");
  const byName = new Map<string, Uint8Array>();
  const warnings: string[] = [];
  for (const block of blocks) {
    if (!NEEDED.includes(block.name) || byName.has(block.name)) continue;
    byName.set(block.name, readBlock(bytes, block, compressed));
  }

  const missing = ["staff.dat", "player.dat", "club.dat", "nation.dat", "first_names.dat", "second_names.dat"].filter(
    (name) => !byName.has(name),
  );
  if (missing.length) {
    throw new Error(`This save is missing ${missing.join(", ")}. Those tables are required to show a squad.`);
  }

  const counts = readIndex(byName.get("index.dat"));
  report(28, "Reading clubs and nations");

  const nations = readNations(must(byName, "nation.dat"), counts.get("nation.dat"), warnings);
  const comps = byName.has("club_comp.dat")
    ? readComps(must(byName, "club_comp.dat"), counts.get("club_comp.dat"), warnings)
    : [];
  const nameFirst = readNames(must(byName, "first_names.dat"), counts.get("first_names.dat"));
  const nameSecond = readNames(must(byName, "second_names.dat"), counts.get("second_names.dat"));
  const nameCommon = byName.has("common_names.dat")
    ? readNames(must(byName, "common_names.dat"), counts.get("common_names.dat"))
    : [];

  const clubRows = readClubs(must(byName, "club.dat"), counts.get("club.dat"), warnings);
  const tactics = byName.has("tactics.dat") ? readTactics(must(byName, "tactics.dat"), warnings) : [];
  const humanManager = byName.has("human_manager.dat") ? must(byName, "human_manager.dat") : null;
  report(46, "Reading staff and contracts");
  const staff = must(byName, "staff.dat");
  const staffCount = recordCount(staff, STAFF, counts.get("staff.dat"), "staff.dat", warnings);
  const playersBin = must(byName, "player.dat");
  const playerCount = recordCount(playersBin, PLAYER, counts.get("player.dat"), "player.dat", warnings);
  const conditions = readConditions(byName.get("injury.dat"), staffCount);

  const contracts = byName.has("contract.dat")
    ? readContracts(must(byName, "contract.dat"), warnings)
    : [];
  if (!byName.has("contract.dat")) {
    warnings.push("No contract table, so transfer status and Bosman flags are unavailable.");
  }

  const history = byName.has("staff_history.dat")
    ? readHistory(must(byName, "staff_history.dat"), counts.get("staff_history.dat"), warnings)
    : new Map<number, Hist[]>();
  if (!byName.has("staff_history.dat")) {
    warnings.push("No staff_history.dat — loaned-in players are detected from contract type instead.");
  }

  const game = readGame(byName.get("general.dat"), clubRows);
  if (!game.date) warnings.push("Game date was not in the usual place. Ages use 1 July of the save year when it can be guessed, otherwise they are blank.");

  report(70, "Joining players");
  const contractsByStaff = new Map<number, Contract[]>();
  for (const contract of contracts) {
    const list = contractsByStaff.get(contract.staffId);
    if (list) list.push(contract);
    else contractsByStaff.set(contract.staffId, [contract]);
  }

  const managers = new Map<number, string>();
  const staffView = viewOf(staff);
  for (let i = 0; i < staffCount; i += 1) {
    const at = i * STAFF;
    const job = staff[at + 61] ?? 0;
    if (job !== JOB_MANAGER && job !== JOB_ASSISTANT) continue;
    const clubId = i32(staffView, at + 57);
    if (clubId < 0) continue;
    if (job === JOB_ASSISTANT && managers.has(clubId)) continue;
    managers.set(clubId, personName(staffView, at, nameFirst, nameSecond, nameCommon).full);
  }

  const clubs = clubRows.map((club) => ({
    ...club,
    manager: managers.get(club.id) ?? "",
  }));

  const gameDate = game.date;
  const gameOrd = gameDate ? monthOrd(gameDate) : 0;
  const gameYear = gameDate ? gameDate.getUTCFullYear() : 0;
  const players: PlayerRec[] = [];
  const attrs = new Int8Array(staffCount * ATTRS.length);
  let written = 0;

  const playerView = viewOf(playersBin);
  for (let i = 0; i < staffCount; i += 1) {
    const at = i * STAFF;
    const playerIndex = i32(staffView, at + 97);
    if (playerIndex < 0 || playerIndex >= playerCount) continue;
    const staffId = i32(staffView, at);
    const names = personName(staffView, at, nameFirst, nameSecond, nameCommon);
    if (!names.full && !names.display) continue;
    const pAt = playerIndex * PLAYER;
    const clubId = i32(staffView, at + 57);
    const nationId = i32(staffView, at + 26);
    const dob = dateFrom(staffView, at + 16);
    const joined = dateFrom(staffView, at + 62);
    const expires = dateFrom(staffView, at + 70);
    const ownContracts = contractsByStaff.get(staffId) ?? [];
    const primary = ownContracts.find((contract) => contract.clubId === clubId) ?? ownContracts[0];
    const hist = history.get(staffId) ?? [];
    let flags = statusFlags({
      clubId,
      primary,
      history: hist,
      clubIdNow: clubId,
      gameYear,
      gameDate,
      dob,
      joined,
      expires,
    });
    const parentClub =
      ownContracts.find(
        (contract) =>
          contract.clubId >= 0 &&
          contract.clubId !== clubId &&
          contract.arrangedFor < 0 &&
          !isLoanContractType(contract.contractType),
      ) ??
      ownContracts.find(
        (contract) => contract.clubId >= 0 && contract.clubId !== clubId && contract.arrangedFor < 0,
      );
    const loanedInByType = !!(primary && isLoanContractType(primary.contractType));
    const loanedInByHistory = !!(parentClub && hist.some((row) => row.onLoan !== 0));
    if (loanedInByType || loanedInByHistory) flags |= FLAG.loan;
    const loanFrom = flags & FLAG.loan ? (parentClub?.clubId ?? -1) : -1;
    const staffWage = i32(staffView, at + 78);
    // On loan at ClubJob: staff wage is often the parent deal — use the
    // current-club contract wage (loan share). If staff wage is 0 but the
    // club contract has a wage, prefer that (unsynced staff row).
    const clubWage = primary && primary.clubId === clubId ? primary.wage : undefined;
    const wage =
      flags & FLAG.loan && clubWage !== undefined
        ? clubWage
        : staffWage === 0 && clubWage !== undefined && clubWage > 0
          ? clubWage
          : staffWage;
    const pos = positionOf(playerView, pAt);
    const row = written;
    written += 1;
    writeAttrs(attrs, row, playerView, pAt, staff, at);
    players.push({
      id: staffId,
      name: names.display,
      fullName: names.full || names.display,
      sortName: names.sort,
      nationId,
      secondNationId: i32(staffView, at + 30),
      clubId,
      pos: pos.label,
      posMask: pos.mask,
      sideMask: pos.side,
      age: gameDate && dob ? ageOn(dob, gameDate) : dob ? gameYear - dob.getUTCFullYear() : 0,
      ca: i16(playerView, pAt + 5),
      pa: i16(playerView, pAt + 7),
      wage,
      value: i32(staffView, at + 82),
      expiresOrd: expires ? monthOrd(expires) : -1,
      flags,
      arrangedClubId: primary && primary.arrangedFor >= 0 ? primary.arrangedFor : -1,
      loanFromClubId: loanFrom,
      squadNo: playersBin[pAt + 4] ?? 0,
      morale: playersBin[pAt + 69] ?? 0,
      condition: conditions?.[i] ?? -1,
      dobLabel: dob ? formatDate(dob) : "",
      joinedLabel: joined ? formatDate(joined) : "",
      expiresLabel: expires ? formatDate(expires) : "",
      intApps: staff[at + 34] ?? 0,
      intGoals: staff[at + 35] ?? 0,
      homeRep: u16(playerView, pAt + 9),
      currentRep: u16(playerView, pAt + 11),
      worldRep: u16(playerView, pAt + 13),
      squadStatus: primary ? squadStatusLabel(primary.squadStatus) : "",
      releaseFee: primary?.releaseFee ?? 0,
      leftFoot: signed(playersBin[pAt + 48] ?? 0),
      rightFoot: signed(playersBin[pAt + 59] ?? 0),
    });
  }

  if (!players.length) {
    throw new Error("Staff and player tables were read, but no players were linked. The record size may not match this save.");
  }

  report(96, "Sorting the squad");
  const humanClubId = matchHumanClub(game.humanName, clubs);
  const trimmed = attrs.slice(0, written * ATTRS.length);

  return {
    fileName,
    compressed,
    byteLength: buffer.byteLength,
    blockCount,
    blockNames,
    gameDateLabel: gameDate ? formatDate(gameDate) : "Date unknown",
    gameOrd,
    gameYear,
    humanClubId,
    nations,
    comps,
    clubs,
    tactics,
    humanManager,
    players,
    attrs: trimmed,
    warnings,
  };
}

export function attrOf(save: ParsedSave, playerIndex: number, key: (typeof ATTRS)[number]["key"]): number {
  const intrinsic = save.attrs[playerIndex * ATTRS.length + ATTR_INDEX[key]] ?? -1;
  const player = save.players[playerIndex];
  if (!player) return intrinsic;
  return displayAttr(key, intrinsic, player.ca);
}

function must(map: Map<string, Uint8Array>, name: string): Uint8Array {
  const block = map.get(name);
  if (!block) throw new Error(`Missing ${name}`);
  return block;
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder("iso-8859-1").decode(bytes);
}

function readBlock(file: Uint8Array, block: Block, compressed: boolean): Uint8Array {
  if (block.size > 80_000_000) {
    throw new Error(`${block.name} is larger than CMdesk will unpack (${block.size} bytes).`);
  }
  if (!compressed) {
    const end = block.position + block.size;
    if (block.position > file.length || end > file.length) {
      throw new Error(`${block.name} points past the end of the file.`);
    }
    return file.subarray(block.position, end);
  }
  const out = new Uint8Array(block.size);
  let pointer = block.position;
  let written = 0;
  while (written < block.size) {
    if (pointer >= file.length) {
      throw new Error(`${block.name} ran out of compressed bytes.`);
    }
    const mark = file[pointer]!;
    pointer += 1;
    if (mark <= 128) {
      out[written] = mark;
      written += 1;
    } else {
      if (pointer >= file.length) throw new Error(`${block.name} ran out of compressed bytes.`);
      const count = mark - 128;
      const value = file[pointer]!;
      pointer += 1;
      for (let i = 0; i < count && written < block.size; i += 1) {
        out[written] = value;
        written += 1;
      }
    }
  }
  return out;
}

function readIndex(block: Uint8Array | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  if (!block || block.length < 67) return counts;
  const view = viewOf(block);
  const rows = Math.floor(block.length / 67);
  for (let i = 0; i < rows; i += 1) {
    const at = i * 67;
    const name = cstr(block, at, 51).toLowerCase();
    const count = i32(view, at + 55);
    if (name && count >= 0 && count < 2_000_000) counts.set(name, count);
  }
  return counts;
}

function recordCount(
  block: Uint8Array,
  stride: number,
  indexed: number | undefined,
  label: string,
  warnings: string[],
): number {
  const fit = Math.floor(block.length / stride);
  if (indexed !== undefined && indexed <= fit) return indexed;
  if (block.length % stride !== 0) {
    warnings.push(`${label} has ${block.length % stride} trailing bytes and was read as ${fit} records.`);
  }
  if (fit <= 0) throw new Error(`${label} does not contain a single ${stride}-byte record.`);
  return fit;
}

function readNames(block: Uint8Array, indexed: number | undefined): string[] {
  const count = indexed !== undefined && indexed * NAME <= block.length ? indexed : Math.floor(block.length / NAME);
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) names.push(cstr(block, i * NAME, 51));
  return names;
}

function readNations(block: Uint8Array, indexed: number | undefined, warnings: string[]) {
  const count = recordCount(block, NATION, indexed, "nation.dat", warnings);
  const nations = [];
  for (let i = 0; i < count; i += 1) {
    const at = i * NATION;
    nations.push({
      id: i,
      name: cstr(block, at + 4, 51),
      short: cstr(block, at + 56, 26),
      code: cstr(block, at + 83, 4),
      nationality: cstr(block, at + 87, 26),
    });
  }
  const readable = nations.filter((nation) => /[A-Za-z]/.test(nation.name)).length;
  if (nations.length > 4 && readable < nations.length / 2) {
    throw new Error("Nation names did not decode. This save's nation record is not the 3.9.68 layout.");
  }
  return nations;
}

const TACTIC = 6371;
/**
 * Overview circles on a 3.9.68 `tactics.dat` (stride 6371).
 * Eleven little-endian words. A word is one row bit
 * (GK 0x1, SW 0x2, D 0x4, DM 0x8, M 0x10, AM 0x20, ST 0x40)
 * and one side bit (L 0x80, CL 0x100, C 0x200, CR 0x400, R 0x800).
 * The goalkeeper may omit the side. The int32 at the start of a record
 * is not a unique id — club `tacticId` is the record index.
 * Checked on 352_v1, 442_v1 and 343_default. That career's match squads
 * were all -1, so names were not sitting on these slots in the file.
 */
const TACTIC_SLOTS = 338;
const ROW_BIT = [0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40];
const COL_BIT = [0x80, 0x100, 0x200, 0x400, 0x800];

function decodeSlot(word: number): TacticSlot | null {
  let row = -1;
  let rows = 0;
  for (let i = 0; i < ROW_BIT.length; i += 1) {
    if (word & ROW_BIT[i]!) {
      row = i;
      rows += 1;
    }
  }
  if (rows !== 1) return null;
  let col = -1;
  let cols = 0;
  for (let i = 0; i < COL_BIT.length; i += 1) {
    if (word & COL_BIT[i]!) {
      col = i;
      cols += 1;
    }
  }
  if (word & ~0xfff) return null;
  if (row === 0) {
    if (cols > 1) return null;
    return { row, col: cols === 1 ? col : 2 };
  }
  if (cols !== 1) return null;
  return { row, col };
}

function readTactics(block: Uint8Array, warnings: string[]): TacticRec[] {
  const count = Math.floor(block.length / TACTIC);
  if (count <= 0) {
    warnings.push("tactics.dat does not contain a tactic record.");
    return [];
  }
  const view = viewOf(block);
  const tactics: TacticRec[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = i * TACTIC;
    const name = cstr(block, at + 4, 51);
    const slots: TacticSlot[] = [];
    let ok = /[A-Za-z0-9]/.test(name);
    for (let slot = 0; slot < 11 && ok; slot += 1) {
      const decoded = decodeSlot(view.getUint16(at + TACTIC_SLOTS + slot * 2, true));
      if (!decoded) ok = false;
      else slots.push(decoded);
    }
    const circles = new Set(slots.map((slot) => `${slot.row}:${slot.col}`));
    const keepers = slots.filter((slot) => slot.row === 0).length;
    tactics.push({
      id: i,
      name,
      slots: ok && circles.size === 11 && keepers === 1 ? slots : null,
    });
  }
  return tactics;
}

/**
 * `human_manager.dat` on a 3.9.68 career. Records are 19072 bytes while the
 * name at +4 still looks like a tactic name. The last 128 bytes are 16 pairs
 * of (staff id, overview word): the eleven, then five bench slots whose word
 * is -1. The three ints at +18924 were 65, 8, 1395233 on every record of the
 * career this was checked against. Club `TacticSelected` stayed -1; the
 * tactic name in the record is the one that was set.
 */
const HUMAN_STRIDE = 19072;
const HUMAN_LINEUP = HUMAN_STRIDE - 16 * 8;

/** The picked eleven whose players are all in `squadIds`. Other records are skipped. */
export function readHumanPick(block: Uint8Array, squadIds: ReadonlySet<number>): HumanPick | null {
  const view = viewOf(block);
  let found: HumanPick | null = null;
  const count = Math.floor(block.length / HUMAN_STRIDE);
  for (let record = 0; record < count; record += 1) {
    const at = record * HUMAN_STRIDE;
    const name = cstr(block, at + 4, 51);
    if (!/[A-Za-z0-9]/.test(name)) break;
    if (i32(view, at + 18924) !== 65 || i32(view, at + 18928) !== 8 || i32(view, at + 18932) !== 1_395_233) {
      continue;
    }
    const firstId = i32(view, at + HUMAN_LINEUP);
    if (!squadIds.has(firstId)) continue;
    const pitch: HumanPick["pitch"] = [];
    let ok = true;
    for (let slot = 0; slot < 11; slot += 1) {
      const pair = at + HUMAN_LINEUP + slot * 8;
      const staffId = i32(view, pair);
      const decoded = decodeSlot(i32(view, pair + 4));
      if (staffId <= 0 || !decoded || !squadIds.has(staffId)) {
        ok = false;
        break;
      }
      pitch.push({ staffId, slot: decoded });
    }
    if (!ok) continue;
    const circles = new Set(pitch.map((entry) => `${entry.slot.row}:${entry.slot.col}`));
    const keepers = pitch.filter((entry) => entry.slot.row === 0).length;
    if (circles.size !== 11 || keepers !== 1) continue;
    const bench: number[] = [];
    for (let slot = 11; slot < 16; slot += 1) {
      const pair = at + HUMAN_LINEUP + slot * 8;
      const staffId = i32(view, pair);
      if (staffId <= 0 || i32(view, pair + 4) !== -1) break;
      if (squadIds.has(staffId)) bench.push(staffId);
    }
    found = { tacticName: name, pitch, bench };
  }
  return found;
}

function readComps(block: Uint8Array, indexed: number | undefined, warnings: string[]): CompRec[] {
  const count = recordCount(block, COMP, indexed, "club_comp.dat", warnings);
  const view = viewOf(block);
  const comps: CompRec[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = i * COMP;
    comps.push({
      id: i,
      name: cstr(block, at + 4, 51),
      short: cstr(block, at + 56, 26),
      nationId: i32(view, at + 93),
    });
  }
  return comps;
}

function readClubs(block: Uint8Array, indexed: number | undefined, warnings: string[]) {
  const count = recordCount(block, CLUB, indexed, "club.dat", warnings);
  const view = viewOf(block);
  const clubs = [];
  for (let i = 0; i < count; i += 1) {
    const at = i * CLUB;
    const matchSquad: number[] = [];
    for (let slot = 0; slot < 20; slot += 1) matchSquad.push(i32(view, at + 480 + slot * 4));
    const trainingTactics: number[] = [];
    for (let slot = 0; slot < 4; slot += 1) trainingTactics.push(i32(view, at + 560 + slot * 4));
    clubs.push({
      id: i,
      name: cstr(block, at + 4, 51),
      short: cstr(block, at + 56, 26),
      nationId: i32(view, at + 83),
      divisionId: i32(view, at + 87),
      reputation: u16(view, at + 128),
      cash: i32(view, at + 101),
      manager: "",
      matchSquad,
      trainingTactics,
      tacticId: i32(view, at + 576),
    });
  }
  const readable = clubs.filter((club) => /[A-Za-z]/.test(club.name)).length;
  if (clubs.length > 4 && readable < clubs.length / 2) {
    throw new Error("Club names did not decode. This save's club record is not the 3.9.68 layout.");
  }
  return clubs;
}

type Contract = {
  staffId: number;
  clubId: number;
  /** Weekly pounds this club pays on this contract (loan contribution or full wage). */
  wage: number;
  releaseFee: number;
  started: Date | null;
  expires: Date | null;
  /** 6 / 70 = loan deal at this club (seen on real saves without staff_history). */
  contractType: number;
  bosman: number;
  arrangedFor: number;
  transferStatus: number;
  squadStatus: number;
};

/** ClubJob contract types that mean the player is loaned in there. */
function isLoanContractType(type: number): boolean {
  return type === 6 || type === 70;
}

function readContracts(block: Uint8Array, warnings: string[]): Contract[] {
  const view = viewOf(block);
  let start = 0;
  let count = Math.floor(block.length / CONTRACT);
  if (block.length >= 8) {
    const pre = i32(view, 0);
    let listed = i32(view, 4);
    const preamble = 8 + pre * 21;
    if (pre >= 0 && pre < 100_000 && preamble >= 8 && preamble < block.length) {
      if (pre > 0 && preamble >= 4) listed = i32(view, preamble - 4);
      if (listed >= 0 && preamble + listed * CONTRACT <= block.length + CONTRACT) {
        start = preamble;
        count = listed;
      }
    }
  }
  if (start + count * CONTRACT > block.length) {
    warnings.push("Contract table header did not fit, so contracts were read from the start of the block.");
    start = 0;
    count = Math.floor(block.length / CONTRACT);
  }
  const contracts: Contract[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = start + i * CONTRACT;
    if (at + CONTRACT > block.length) break;
    contracts.push({
      staffId: i32(view, at),
      clubId: i32(view, at + 4),
      wage: i32(view, at + 12),
      releaseFee: i32(view, at + 33),
      started: dateFrom(view, at + 37),
      expires: dateFrom(view, at + 45),
      contractType: block[at + 53] ?? 0,
      bosman: block[at + 73] ?? 0,
      arrangedFor: i32(view, at + 74),
      transferStatus: block[at + 78] ?? 0,
      squadStatus: block[at + 79] ?? 0,
    });
  }
  return contracts;
}

type Hist = { year: number; clubId: number; onLoan: number };

const FITNESS = 31;

/** One fitness row per staff index. Condition is the two words at +8 and +10, times each other, over 1,000,000. */
function readConditions(block: Uint8Array | undefined, staffCount: number): Int16Array | null {
  if (!block || block.length < staffCount * FITNESS) return null;
  const view = viewOf(block);
  const out = new Int16Array(staffCount);
  for (let i = 0; i < staffCount; i += 1) {
    const at = i * FITNESS;
    const fitness = view.getUint16(at + 8, true);
    const match = view.getUint16(at + 10, true);
    out[i] = Math.floor((fitness * match) / 1_000_000);
  }
  return out;
}

function readHistory(block: Uint8Array, indexed: number | undefined, warnings: string[]) {
  const count = recordCount(block, HISTORY, indexed, "staff_history.dat", warnings);
  const view = viewOf(block);
  const map = new Map<number, Hist[]>();
  for (let i = 0; i < count; i += 1) {
    const at = i * HISTORY;
    const staffId = i32(view, at + 4);
    const row: Hist = {
      year: i16(view, at + 8),
      clubId: i32(view, at + 10),
      onLoan: block[at + 14] ?? 0,
    };
    const list = map.get(staffId);
    if (list) list.push(row);
    else map.set(staffId, [row]);
  }
  return map;
}

function readGame(
  general: Uint8Array | undefined,
  clubs: { short: string; name: string }[],
): { date: Date | null; humanName: string } {
  if (!general) return { date: null, humanName: "" };
  const view = viewOf(general);
  const date = general.length >= 3944 + 8 ? dateFrom(view, 3944) : null;
  const humanName = general.length > 0x824 ? cstr(general, 0x824, 40) : "";
  void clubs;
  return { date, humanName };
}

function matchHumanClub(humanName: string, clubs: { id: number; short: string; name: string }[]): number {
  if (!humanName) return clubs[0]?.id ?? -1;
  const exact =
    clubs.find((club) => club.short === humanName) ??
    clubs.find((club) => club.name === humanName) ??
    clubs.find((club) => club.short.toLowerCase() === humanName.toLowerCase()) ??
    clubs.find((club) => club.name.toLowerCase() === humanName.toLowerCase());
  return exact?.id ?? -1;
}

function personName(
  staff: DataView,
  at: number,
  first: string[],
  second: string[],
  common: string[],
): { display: string; full: string; sort: string } {
  const firstId = i32(staff, at + 4);
  const secondId = i32(staff, at + 8);
  const commonId = i32(staff, at + 12);
  const firstName = firstId >= 0 ? (first[firstId] ?? "") : "";
  const secondName = secondId >= 0 ? (second[secondId] ?? "") : "";
  const commonName = commonId >= 0 ? (common[commonId] ?? "") : "";
  const full = [firstName, secondName].filter(Boolean).join(" ");
  const display = commonName || full || secondName || firstName;
  const sort = [secondName, firstName].filter(Boolean).join(" ") || display;
  return { display, full, sort };
}

function positionOf(view: DataView, at: number): { label: string; mask: number; side: number } {
  const role = (offset: number) => signed(view.getUint8(at + offset));
  const roles = [
    { bit: 1, label: "GK", value: role(15) },
    { bit: 2, label: "SW", value: role(16) },
    { bit: 4, label: "D", value: role(17) },
    { bit: 8, label: "DM", value: role(18) },
    { bit: 16, label: "M", value: role(19) },
    { bit: 32, label: "AM", value: role(20) },
    { bit: 64, label: "F", value: role(21) },
  ];
  let mask = 0;
  const parts: string[] = [];
  for (const entry of roles) {
    if (entry.value >= 15) {
      mask |= entry.bit;
      parts.push(entry.label);
    }
  }
  const wing = role(22);
  if (!parts.length && wing >= 15) {
    mask |= 4 | 32;
    parts.push("D", "AM");
  }
  let side = 0;
  let sideText = "";
  if (role(23) >= 15) {
    side |= 1;
    sideText += "R";
  }
  if (role(24) >= 15) {
    side |= 2;
    sideText += "L";
  }
  if (role(25) >= 15) {
    side |= 4;
    sideText += "C";
  }
  const label = `${parts.join("/")}${sideText ? ` ${sideText}` : ""}`.trim();
  return { label: label || "—", mask, side };
}

function writeAttrs(dest: Int8Array, row: number, player: DataView, pAt: number, staff: Uint8Array, sAt: number) {
  const base = row * ATTRS.length;
  const take = (index: number, value: number) => {
    dest[base + index] = value > 127 ? value - 256 : value;
  };
  // Player bytes, in ATTRS order for the on-player attributes. Hidden staff bytes follow.
  const playerOffsets: Record<string, number> = {
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
  for (const [key, offset] of Object.entries(playerOffsets)) {
    take(ATTR_INDEX[key as keyof typeof ATTR_INDEX], player.getUint8(pAt + offset));
  }
  const staffHidden: Record<string, number> = {
    adaptability: 86,
    ambition: 87,
    determination: 88,
    loyalty: 89,
    pressure: 90,
    professionalism: 91,
    sportsmanship: 92,
    temperament: 93,
  };
  for (const [key, offset] of Object.entries(staffHidden)) {
    take(ATTR_INDEX[key as keyof typeof ATTR_INDEX], staff[sAt + offset] ?? 0);
  }
}

function signed(value: number): number {
  return value > 127 ? value - 256 : value;
}

function statusFlags(input: {
  clubId: number;
  primary: Contract | undefined;
  history: Hist[];
  clubIdNow: number;
  gameYear: number;
  gameDate: Date | null;
  dob: Date | null;
  joined: Date | null;
  expires: Date | null;
}): number {
  let flags = 0;
  if (input.clubId < 0) flags |= FLAG.free;
  const status = input.primary?.transferStatus ?? 0;
  if (status & 1) flags |= FLAG.listed;
  if (status & 8) flags |= FLAG.request;
  if (status & 2) flags |= FLAG.listLoan;
  if ((input.primary?.bosman ?? 0) !== 0) flags |= FLAG.bosman;
  if ((input.primary?.arrangedFor ?? -1) >= 0) flags |= FLAG.arranged;
  const onLoanHist = input.history.some(
    (row) =>
      row.onLoan !== 0 &&
      row.clubId === input.clubIdNow &&
      (input.gameYear === 0 || row.year === input.gameYear || row.year === input.gameYear - 1),
  );
  if (onLoanHist) flags |= FLAG.loan;
  if (input.gameDate && input.expires && input.joined && input.dob) {
    const tenureDays = (input.gameDate.getTime() - input.joined.getTime()) / 86_400_000;
    const ageAtStart = (input.joined.getTime() - input.dob.getTime()) / 86_400_000 / 365;
    const leftDays = (input.expires.getTime() - input.gameDate.getTime()) / 86_400_000;
    const longEnough = tenureDays >= 3 * 365 || (ageAtStart >= 28 && tenureDays >= 2 * 365);
    if (longEnough && leftDays <= 182 && leftDays >= 0) flags |= FLAG.unprotected;
  }
  return flags;
}

function squadStatusLabel(status: number): string {
  if ((status & 240) === 0) return "Uncertain";
  if ((status & 224) === 0) return "Indispensable";
  if ((status & 208) === 0) return "First team";
  if ((status & 192) === 0) return "Squad rotation";
  if ((status & 176) === 0) return "Backup";
  if ((status & 160) === 0) return "Hot prospect";
  if ((status & 144) === 0) return "Decent young";
  if ((status & 128) === 0) return "Not needed";
  if ((status & 112) === 0) return "On trial";
  return "";
}

function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const before =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  if (before) age -= 1;
  return age;
}
