import { statusText, toPounds, toWeeklyPounds, type CurrencyId, type Lookups, type WagePeriod } from "./labels.ts";
import { attrOf } from "./parse.ts";
import { clubPlayerIndexes, nameMatches, playerAt } from "./players.ts";
import { roleRating } from "./positions.ts";
import type { ColumnId, SortDir } from "./settings.ts";
import { FLAG, ROLE_MASK, type AttrKey, type ParsedSave, type PlayerRec } from "./types.ts";

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
  /** Drops staff whose club job is retired. On unless the search turns it off. */
  hideRetired: boolean;
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

export type Hit = {
  index: number;
  player: PlayerRec;
  /** Position rating, one decimal. Missing is -1. */
  rating?: number;
  ratingSlot?: string;
  ratingTitle?: string;
};

export function emptyFilters(): Filters {
  return {
    free: false,
    loan: false,
    listed: false,
    request: false,
    bosman: false,
    unprotected: false,
    expiring: false,
    hideRetired: true,
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
  if (key === "ca" || key === "pa" || key === "wage" || key === "value" || key === "morale" || key === "condition" || key === "rating")
    return "desc";
  return "asc";
}

/** Fills the rating from the highlighted attributes. A search focus scores that position. */
export function rateHits(save: ParsedSave, hits: Hit[], focus?: { posMask: number; sideMask: number }): Hit[] {
  return hits.map((hit) => {
    const rated = roleRating(hit.player.posMask, hit.player.sideMask, (key) => attrOf(save, hit.index, key), focus);
    if (!rated) return { ...hit, rating: -1, ratingSlot: "", ratingTitle: "" };
    return {
      ...hit,
      rating: rated.value,
      ratingSlot: rated.slot,
      ratingTitle: `${rated.slot} · ${rated.attrs.join(", ")}`,
    };
  });
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
  // hideRetired starts on and only drops rows. Counting it would list every active player with an empty box.
  if (filters.ageMin || filters.ageMax) count += 1;
  if (filters.caMin || filters.caMax) count += 1;
  if (filters.paMin || filters.paMax) count += 1;
  if (filters.wageMax) count += 1;
  if (filters.valueMin) count += 1;
  if (filters.nationId >= 0) count += 1;
  if (filters.divisionId >= 0) count += 1;
  if (filters.clubId >= 0) count += 1;
  if (filters.posMask & ROLE_MASK) count += 1;
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
  const order = [1, 4, 8, 16, 32, 64];
  const index = order.findIndex((bit) => mask & bit);
  return index < 0 ? order.length : index;
}

export function squadOf(save: ParsedSave, clubId: number): Hit[] {
  const indexes = clubPlayerIndexes(save.roster, clubId);
  const hits: Hit[] = [];
  for (let i = 0; i < indexes.length; i += 1) {
    const index = indexes[i]!;
    hits.push({ index, player: playerAt(save, index) });
  }
  return hits;
}

export function freeAgents(save: ParsedSave): Hit[] {
  const indexes = save.roster.freePlayers;
  const hits: Hit[] = [];
  for (let i = 0; i < indexes.length; i += 1) {
    const index = indexes[i]!;
    hits.push({ index, player: playerAt(save, index) });
  }
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
  if (!needle && !activeFilterCount(filters)) return [];

  const roster = save.roster;
  const hits: Hit[] = [];
  for (let index = 0; index < roster.count; index += 1) {
    if (needle && !nameMatches(roster, index, needle)) continue;
    const flags = roster.flags[index] ?? 0;
    if (filters.hideRetired && flags & FLAG.retired) continue;
    if (filters.free && !(flags & FLAG.free)) continue;
    if (filters.loan && !(flags & FLAG.loan)) continue;
    if (filters.listed && !(flags & FLAG.listed)) continue;
    if (filters.request && !(flags & FLAG.request)) continue;
    if (filters.bosman && !(flags & FLAG.bosman)) continue;
    if (filters.unprotected && !(flags & FLAG.unprotected)) continue;
    const age = roster.age[index] ?? 0;
    const ca = roster.ca[index] ?? 0;
    const pa = roster.pa[index] ?? 0;
    const wage = roster.wage[index] ?? 0;
    const value = roster.value[index] ?? 0;
    const expiresOrd = roster.expiresOrd[index] ?? -1;
    if (filters.expiring) {
      const left = expiresOrd - save.gameOrd;
      if (expiresOrd < 0 || save.gameOrd <= 0 || left < 0 || left > 6) continue;
    }
    if (ageMin !== null && age < ageMin) continue;
    if (ageMax !== null && age > ageMax) continue;
    if (caMin !== null && ca < caMin) continue;
    if (caMax !== null && ca > caMax) continue;
    if (paMin !== null && pa < paMin) continue;
    if (paMax !== null && pa > paMax) continue;
    if (wageMax !== null && wage > wageMax) continue;
    if (valueMin !== null && value < valueMin) continue;
    const nationId = roster.nationId[index] ?? 0;
    const clubId = roster.clubId[index] ?? -1;
    if (filters.nationId >= 0 && nationId !== filters.nationId) continue;
    if (filters.clubId >= 0 && clubId !== filters.clubId) continue;
    if (filters.divisionId >= 0) {
      const club = clubs.get(clubId);
      if (!club || club.divisionId !== filters.divisionId) continue;
    }
    const posMask = roster.posMask[index] ?? 0;
    const sideMask = roster.sideMask[index] ?? 0;
    const wantedPos = filters.posMask & ROLE_MASK;
    if (wantedPos && !(posMask & wantedPos)) continue;
    if (filters.sideMask && !(sideMask & filters.sideMask)) continue;
    if (filters.attrA && attrAMin !== null && attrOf(save, index, filters.attrA) < attrAMin) continue;
    if (filters.attrB && attrBMin !== null && attrOf(save, index, filters.attrB) < attrBMin) continue;
    hits.push({ index, player: playerAt(save, index) });
  }

  return hits;
}

export function sortHits(hits: Hit[], key: SortKey, dir: SortDir, save: ParsedSave, lookups: Lookups): Hit[] {
  const list = hits.slice();
  list.sort((a, b) => {
    if (key === "expires" || key === "condition" || key === "rating") {
      const raw =
        key === "expires"
          ? [a.player.expiresOrd, b.player.expiresOrd]
          : key === "condition"
            ? [a.player.condition, b.player.condition]
            : [a.rating ?? -1, b.rating ?? -1];
      const placed = missingLast(raw[0], raw[1]);
      if (placed !== 0) return placed;
      const diff = raw[0] - raw[1];
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
    case "condition":
      return left.condition - right.condition;
    case "rating":
      return (a.rating ?? -1) - (b.rating ?? -1);
    case "status":
      return statusText(left, save).localeCompare(statusText(right, save));
    default:
      return 0;
  }
}
