import { FLAG, type PlayerRec, type ParsedSave, type Roster } from "./types.ts";

export type RosterDraft = {
  id: number[];
  nationId: number[];
  secondNationId: number[];
  clubId: number[];
  posMask: number[];
  sideMask: number[];
  age: number[];
  ca: number[];
  pa: number[];
  wage: number[];
  value: number[];
  expiresOrd: number[];
  flags: number[];
  arrangedClubId: number[];
  loanFromClubId: number[];
  squadNo: number[];
  morale: number[];
  condition: number[];
  injuryDays: number[];
  intApps: number[];
  intGoals: number[];
  homeRep: number[];
  currentRep: number[];
  worldRep: number[];
  releaseFee: number[];
  leftFoot: number[];
  rightFoot: number[];
  name: string[];
  fullName: string[];
  sortName: string[];
  pos: string[];
  dobLabel: string[];
  joinedLabel: string[];
  expiresLabel: string[];
  squadStatus: string[];
};

export function rosterDraft(): RosterDraft {
  return {
    id: [],
    nationId: [],
    secondNationId: [],
    clubId: [],
    posMask: [],
    sideMask: [],
    age: [],
    ca: [],
    pa: [],
    wage: [],
    value: [],
    expiresOrd: [],
    flags: [],
    arrangedClubId: [],
    loanFromClubId: [],
    squadNo: [],
    morale: [],
    condition: [],
    injuryDays: [],
    intApps: [],
    intGoals: [],
    homeRep: [],
    currentRep: [],
    worldRep: [],
    releaseFee: [],
    leftFoot: [],
    rightFoot: [],
    name: [],
    fullName: [],
    sortName: [],
    pos: [],
    dobLabel: [],
    joinedLabel: [],
    expiresLabel: [],
    squadStatus: [],
  };
}

export function sealRoster(draft: RosterDraft): Roster {
  const clubId = Int32Array.from(draft.clubId);
  const flags = Uint16Array.from(draft.flags);
  const indexed = indexClubs(clubId, flags);
  return {
    count: draft.id.length,
    id: Int32Array.from(draft.id),
    nationId: Int32Array.from(draft.nationId),
    secondNationId: Int32Array.from(draft.secondNationId),
    clubId,
    posMask: Uint8Array.from(draft.posMask),
    sideMask: Uint8Array.from(draft.sideMask),
    age: Int16Array.from(draft.age),
    ca: Int16Array.from(draft.ca),
    pa: Int16Array.from(draft.pa),
    wage: Int32Array.from(draft.wage),
    value: Int32Array.from(draft.value),
    expiresOrd: Int32Array.from(draft.expiresOrd),
    flags,
    arrangedClubId: Int32Array.from(draft.arrangedClubId),
    loanFromClubId: Int32Array.from(draft.loanFromClubId),
    squadNo: Uint8Array.from(draft.squadNo),
    morale: Uint8Array.from(draft.morale),
    condition: Int16Array.from(draft.condition),
    injuryDays: Int16Array.from(draft.injuryDays),
    intApps: Uint8Array.from(draft.intApps),
    intGoals: Uint8Array.from(draft.intGoals),
    homeRep: Uint16Array.from(draft.homeRep),
    currentRep: Uint16Array.from(draft.currentRep),
    worldRep: Uint16Array.from(draft.worldRep),
    releaseFee: Int32Array.from(draft.releaseFee),
    leftFoot: Int8Array.from(draft.leftFoot),
    rightFoot: Int8Array.from(draft.rightFoot),
    name: draft.name,
    fullName: draft.fullName,
    sortName: draft.sortName,
    pos: draft.pos,
    dobLabel: draft.dobLabel,
    joinedLabel: draft.joinedLabel,
    expiresLabel: draft.expiresLabel,
    squadStatus: draft.squadStatus,
    ...indexed,
  };
}

export function rosterFrom(players: PlayerRec[]): Roster {
  const draft = rosterDraft();
  for (const player of players) {
    draft.id.push(player.id);
    draft.nationId.push(player.nationId);
    draft.secondNationId.push(player.secondNationId);
    draft.clubId.push(player.clubId);
    draft.posMask.push(player.posMask);
    draft.sideMask.push(player.sideMask);
    draft.age.push(player.age);
    draft.ca.push(player.ca);
    draft.pa.push(player.pa);
    draft.wage.push(player.wage);
    draft.value.push(player.value);
    draft.expiresOrd.push(player.expiresOrd);
    draft.flags.push(player.flags);
    draft.arrangedClubId.push(player.arrangedClubId);
    draft.loanFromClubId.push(player.loanFromClubId);
    draft.squadNo.push(player.squadNo);
    draft.morale.push(player.morale);
    draft.condition.push(player.condition);
    draft.injuryDays.push(player.injuryDays);
    draft.intApps.push(player.intApps);
    draft.intGoals.push(player.intGoals);
    draft.homeRep.push(player.homeRep);
    draft.currentRep.push(player.currentRep);
    draft.worldRep.push(player.worldRep);
    draft.releaseFee.push(player.releaseFee);
    draft.leftFoot.push(player.leftFoot);
    draft.rightFoot.push(player.rightFoot);
    draft.name.push(player.name);
    draft.fullName.push(player.fullName);
    draft.sortName.push(player.sortName);
    draft.pos.push(player.pos);
    draft.dobLabel.push(player.dobLabel);
    draft.joinedLabel.push(player.joinedLabel);
    draft.expiresLabel.push(player.expiresLabel);
    draft.squadStatus.push(player.squadStatus);
  }
  return sealRoster(draft);
}

const BUFFER_KEYS = [
  "id",
  "nationId",
  "secondNationId",
  "clubId",
  "posMask",
  "sideMask",
  "age",
  "ca",
  "pa",
  "wage",
  "value",
  "expiresOrd",
  "flags",
  "arrangedClubId",
  "loanFromClubId",
  "squadNo",
  "morale",
  "condition",
  "injuryDays",
  "intApps",
  "intGoals",
  "homeRep",
  "currentRep",
  "worldRep",
  "releaseFee",
  "leftFoot",
  "rightFoot",
  "clubKeys",
  "clubOffsets",
  "clubPlayers",
  "freePlayers",
] as const;

/** Buffers to move into the UI thread. Each column owns a distinct buffer. */
export function rosterBuffers(roster: Roster): ArrayBuffer[] {
  return BUFFER_KEYS.map((key) => roster[key].buffer as ArrayBuffer);
}

export function transferList(save: ParsedSave): ArrayBuffer[] {
  const buffers = rosterBuffers(save.roster);
  buffers.push(save.attrs.buffer as ArrayBuffer);
  if (save.humanManager) buffers.push(save.humanManager.buffer as ArrayBuffer);
  return buffers;
}

export function playerAt(save: ParsedSave, index: number): PlayerRec {
  const roster = save.roster;
  return {
    id: roster.id[index] ?? 0,
    name: roster.name[index] ?? "",
    fullName: roster.fullName[index] ?? "",
    sortName: roster.sortName[index] ?? "",
    nationId: roster.nationId[index] ?? 0,
    secondNationId: roster.secondNationId[index] ?? -1,
    clubId: roster.clubId[index] ?? -1,
    pos: roster.pos[index] ?? "",
    posMask: roster.posMask[index] ?? 0,
    sideMask: roster.sideMask[index] ?? 0,
    age: roster.age[index] ?? 0,
    ca: roster.ca[index] ?? 0,
    pa: roster.pa[index] ?? 0,
    wage: roster.wage[index] ?? 0,
    value: roster.value[index] ?? 0,
    expiresOrd: roster.expiresOrd[index] ?? -1,
    flags: roster.flags[index] ?? 0,
    arrangedClubId: roster.arrangedClubId[index] ?? -1,
    loanFromClubId: roster.loanFromClubId[index] ?? -1,
    squadNo: roster.squadNo[index] ?? 0,
    morale: roster.morale[index] ?? 0,
    condition: roster.condition[index] ?? -1,
    injuryDays: roster.injuryDays[index] ?? -1,
    dobLabel: roster.dobLabel[index] ?? "",
    joinedLabel: roster.joinedLabel[index] ?? "",
    expiresLabel: roster.expiresLabel[index] ?? "",
    intApps: roster.intApps[index] ?? 0,
    intGoals: roster.intGoals[index] ?? 0,
    homeRep: roster.homeRep[index] ?? 0,
    currentRep: roster.currentRep[index] ?? 0,
    worldRep: roster.worldRep[index] ?? 0,
    squadStatus: roster.squadStatus[index] ?? "",
    releaseFee: roster.releaseFee[index] ?? 0,
    leftFoot: roster.leftFoot[index] ?? 0,
    rightFoot: roster.rightFoot[index] ?? 0,
  };
}

export function listPlayers(save: ParsedSave): PlayerRec[] {
  const players: PlayerRec[] = new Array(save.roster.count);
  for (let index = 0; index < save.roster.count; index += 1) players[index] = playerAt(save, index);
  return players;
}

export function nameMatches(roster: Roster, index: number, needle: string): boolean {
  const sort = roster.sortName[index] ?? "";
  if (sort.toLowerCase().includes(needle)) return true;
  const name = roster.name[index] ?? "";
  if (name !== sort && name.toLowerCase().includes(needle)) return true;
  const full = roster.fullName[index] ?? "";
  return full !== name && full !== sort && full.toLowerCase().includes(needle);
}

export function clubSizes(roster: Roster): Map<number, number> {
  const sizes = new Map<number, number>();
  for (let i = 0; i < roster.clubKeys.length; i += 1) {
    sizes.set(roster.clubKeys[i]!, roster.clubOffsets[i + 1]! - roster.clubOffsets[i]!);
  }
  return sizes;
}

export function clubPlayerIndexes(roster: Roster, clubId: number): Int32Array {
  let lo = 0;
  let hi = roster.clubKeys.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const key = roster.clubKeys[mid]!;
    if (key === clubId) {
      return roster.clubPlayers.subarray(roster.clubOffsets[mid]!, roster.clubOffsets[mid + 1]!);
    }
    if (key < clubId) lo = mid + 1;
    else hi = mid - 1;
  }
  return roster.clubPlayers.subarray(0, 0);
}

function indexClubs(clubId: Int32Array, flags: Uint16Array): Pick<Roster, "clubKeys" | "clubOffsets" | "clubPlayers" | "freePlayers"> {
  const groups = new Map<number, number[]>();
  const free: number[] = [];
  for (let i = 0; i < clubId.length; i += 1) {
    const club = clubId[i]!;
    const list = groups.get(club);
    if (list) list.push(i);
    else groups.set(club, [i]);
    if (flags[i]! & FLAG.free) free.push(i);
  }
  const entries = [...groups.entries()].sort((a, b) => a[0] - b[0]);
  const clubKeys = new Int32Array(entries.length);
  const clubOffsets = new Int32Array(entries.length + 1);
  let total = 0;
  for (const [, list] of entries) total += list.length;
  const clubPlayers = new Int32Array(total);
  let cursor = 0;
  for (let i = 0; i < entries.length; i += 1) {
    const [id, list] = entries[i]!;
    clubKeys[i] = id;
    clubOffsets[i] = cursor;
    for (const index of list) clubPlayers[cursor++] = index;
  }
  clubOffsets[entries.length] = cursor;
  return { clubKeys, clubOffsets, clubPlayers, freePlayers: Int32Array.from(free) };
}
