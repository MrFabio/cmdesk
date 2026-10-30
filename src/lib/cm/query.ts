import { attrOf } from "./parse.ts";
import { isExpiring, statusText, toPounds, toWeeklyPounds, type CurrencyId, type Lookups, type WagePeriod } from "./labels.ts";
import type { ColumnId, SortDir } from "./settings.ts";
import { FLAG, type AttrKey, type ParsedSave, type PlayerRec } from "./types.ts";

export type SortKey = ColumnId;
export type { SortDir };

export type Filters = {
  free: boolean;
  loan: boolean;
  listed: boolean;
  request: boolean;
  bosman: boolean;
  unprotected: boolean;
  expiring: boolean;
  ageMin: string;
  ageMax: string;
  caMin: string;
  caMax: string;
  paMin: string;
  paMax: string;
  wageMax: string;
  valueMin: string;
  nationId: number;
  divisionId: number;
  clubId: number;
  posMask: number;
  sideMask: number;
  attrA: AttrKey | "";
  attrAMin: string;
  attrB: AttrKey | "";
  attrBMin: string;
};

export type Hit = { index: number; player: PlayerRec };

export function emptyFilters(): Filters {
  return {
    free: false,
    loan: false,
    listed: false,
    request: false,
    bosman: false,
    unprotected: false,
    expiring: false,
    ageMin: "",
    ageMax: "",
    caMin: "",
    caMax: "",
    paMin: "",
    paMax: "",
    wageMax: "",
    valueMin: "",
    nationId: -1,
    divisionId: -1,
    clubId: -1,
    posMask: 0,
    sideMask: 0,
    attrA: "",
    attrAMin: "",
    attrB: "",
    attrBMin: "",
  };
}

export function defaultSortDir(key: SortKey): SortDir {
  if (key === "ca" || key === "pa" || key === "wage" || key === "value" || key === "morale") return "desc";
  return "asc";
}

export function activeFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.free) count += 1;
  if (filters.loan) count += 1;
  if (filters.listed) count += 1;
  if (filters.request) count += 1;
  if (filters.bosman) count += 1;
  if (filters.unprotected) count += 1;
  if (filters.expiring) count += 1;
  if (filters.ageMin || filters.ageMax) count += 1;
  if (filters.caMin || filters.caMax) count += 1;
  if (filters.paMin || filters.paMax) count += 1;
  if (filters.wageMax) count += 1;
  if (filters.valueMin) count += 1;
  if (filters.nationId >= 0) count += 1;
  if (filters.divisionId >= 0) count += 1;
  if (filters.clubId >= 0) count += 1;
  if (filters.posMask) count += 1;
  if (filters.sideMask) count += 1;
  if (filters.attrA && filters.attrAMin) count += 1;
  if (filters.attrB && filters.attrBMin) count += 1;
  return count;
}

function num(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function posRank(mask: number): number {
  const order = [1, 2, 4, 8, 16, 32, 64];
  const index = order.findIndex((bit) => mask & bit);
  return index < 0 ? 8 : index;
}

export function squadOf(save: ParsedSave, clubId: number): Hit[] {
  const hits: Hit[] = [];
  save.players.forEach((player, index) => {
    if (player.clubId === clubId) hits.push({ index, player });
  });
  return hits;
}

export function freeAgents(save: ParsedSave): Hit[] {
  const hits: Hit[] = [];
  save.players.forEach((player, index) => {
    if (player.flags & FLAG.free) hits.push({ index, player });
  });
  return hits;
}

export function searchPlayers(
  save: ParsedSave,
  filters: Filters,
  query: string,
  view?: { currency: CurrencyId; wagePeriod: WagePeriod },
): Hit[] {
  const needle = query.trim().toLowerCase();
  const clubs = new Map(save.clubs.map((club) => [club.id, club]));
  const ageMin = num(filters.ageMin);
  const ageMax = num(filters.ageMax);
  const caMin = num(filters.caMin);
  const caMax = num(filters.caMax);
  const paMin = num(filters.paMin);
  const paMax = num(filters.paMax);
  let wageMax = num(filters.wageMax);
  let valueMin = num(filters.valueMin);
  if (view) {
    if (wageMax !== null) wageMax = toWeeklyPounds(wageMax, view.currency, view.wagePeriod);
    if (valueMin !== null) valueMin = toPounds(valueMin, view.currency);
  }
  const attrAMin = filters.attrA ? num(filters.attrAMin) : null;
  const attrBMin = filters.attrB ? num(filters.attrBMin) : null;
  const hits: Hit[] = [];

  save.players.forEach((player, index) => {
    if (needle) {
      const hay = `${player.name} ${player.fullName} ${player.sortName}`.toLowerCase();
      if (!hay.includes(needle)) return;
    }
    if (filters.free && !(player.flags & FLAG.free)) return;
    if (filters.loan && !(player.flags & FLAG.loan)) return;
    if (filters.listed && !(player.flags & FLAG.listed)) return;
    if (filters.request && !(player.flags & FLAG.request)) return;
    if (filters.bosman && !(player.flags & FLAG.bosman)) return;
    if (filters.unprotected && !(player.flags & FLAG.unprotected)) return;
    if (filters.expiring && !isExpiring(player, save)) return;
    if (ageMin !== null && player.age < ageMin) return;
    if (ageMax !== null && player.age > ageMax) return;
    if (caMin !== null && player.ca < caMin) return;
    if (caMax !== null && player.ca > caMax) return;
    if (paMin !== null && player.pa < paMin) return;
    if (paMax !== null && player.pa > paMax) return;
    if (wageMax !== null && player.wage > wageMax) return;
    if (valueMin !== null && player.value < valueMin) return;
    if (filters.nationId >= 0 && player.nationId !== filters.nationId) return;
    if (filters.clubId >= 0 && player.clubId !== filters.clubId) return;
    if (filters.divisionId >= 0) {
      const club = clubs.get(player.clubId);
      if (!club || club.divisionId !== filters.divisionId) return;
    }
    if (filters.posMask && !(player.posMask & filters.posMask)) return;
    if (filters.sideMask && !(player.sideMask & filters.sideMask)) return;
    if (filters.attrA && attrAMin !== null && attrOf(save, index, filters.attrA) < attrAMin) return;
    if (filters.attrB && attrBMin !== null && attrOf(save, index, filters.attrB) < attrBMin) return;
    hits.push({ index, player });
  });

  return hits;
}

export function sortHits(hits: Hit[], key: SortKey, dir: SortDir, save: ParsedSave, lookups: Lookups): Hit[] {
  const list = hits.slice();
  list.sort((a, b) => {
    if (key === "expires") {
      const placed = missingLast(a.player.expiresOrd, b.player.expiresOrd);
      if (placed !== 0) return placed;
      const diff = a.player.expiresOrd - b.player.expiresOrd;
      if (diff !== 0) return dir === "asc" ? diff : -diff;
    } else {
      const diff = compareAsc(a, b, key, save, lookups);
      if (diff !== 0) return dir === "asc" ? diff : -diff;
    }
    return a.player.sortName.localeCompare(b.player.sortName);
  });
  return list;
}

function missingLast(a: number, b: number): number {
  const aMissing = a < 0;
  const bMissing = b < 0;
  if (aMissing === bMissing) return 0;
  return aMissing ? 1 : -1;
}

function compareAsc(a: Hit, b: Hit, key: SortKey, save: ParsedSave, lookups: Lookups): number {
  const left = a.player;
  const right = b.player;
  switch (key) {
    case "name":
      return left.sortName.localeCompare(right.sortName);
    case "pos":
      return posRank(left.posMask) - posRank(right.posMask) || left.pos.localeCompare(right.pos);
    case "age":
      return left.age - right.age;
    case "nat":
      return lookups.nation(left.nationId).localeCompare(lookups.nation(right.nationId));
    case "club":
      return lookups.clubName(left.clubId).localeCompare(lookups.clubName(right.clubId));
    case "ca":
      return left.ca - right.ca;
    case "pa":
      return left.pa - right.pa;
    case "wage":
      return left.wage - right.wage;
    case "value":
      return left.value - right.value;
    case "morale":
      return left.morale - right.morale;
    case "status":
      return statusText(left, save).localeCompare(statusText(right, save));
    default:
      return 0;
  }
}
