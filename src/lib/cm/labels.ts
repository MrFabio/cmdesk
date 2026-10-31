import { formatDate } from "./binary.ts";
import { FLAG, type ParsedSave, type PlayerRec } from "./types.ts";

/**
 * Units of each currency for £1 as stored in the save.
 * Euro uses £1 = €3.8835 (display multiplier for this desk).
 * Dollar is an approximate cross for display only.
 */
export const CURRENCIES = [
  { id: "eur", label: "Euro", symbol: "€", perPound: 3.8835 },
  { id: "gbp", label: "Pound", symbol: "£", perPound: 1 },
  { id: "usd", label: "Dollar", symbol: "$", perPound: 1.5 },
] as const;

export type CurrencyId = (typeof CURRENCIES)[number]["id"];

/** CM wage periods: month = 4 weeks, year = 50 weeks (not calendar 52). */
export const WAGE_PERIODS = [
  { id: "week", label: "Weekly", suffix: "p/w", weeks: 1 },
  { id: "month", label: "Monthly", suffix: "p/m", weeks: 4 },
  { id: "year", label: "Yearly", suffix: "p/y", weeks: 50 },
] as const;

export type WagePeriod = (typeof WAGE_PERIODS)[number]["id"];

export function currencyOf(id: CurrencyId) {
  return CURRENCIES.find((item) => item.id === id) ?? CURRENCIES[0];
}

export type MoraleLevel = {
  label: string;
  short: string;
  band: 1 | 2 | 3 | 4 | 5 | 6 | null;
};

/** Squad-screen morale words, from the byte at player +69. */
export function moraleLevel(value: number): MoraleLevel {
  if (!Number.isFinite(value) || value <= 0) return { label: "–", short: "–", band: null };
  if (value < 4) return { label: "Very Low", short: "V.Low", band: 1 };
  if (value < 8) return { label: "Low", short: "Low", band: 2 };
  if (value < 12) return { label: "Ok", short: "Ok", band: 3 };
  if (value < 15) return { label: "Good", short: "Good", band: 4 };
  if (value < 18) return { label: "Very Good", short: "V.Good", band: 5 };
  return { label: "Superb", short: "Superb", band: 6 };
}

export function moraleLabel(value: number): string {
  return moraleLevel(value).label;
}

/** Fitness × match fitness, as the percentage the squad screen prints. */
export function conditionText(percent: number): string {
  if (!Number.isFinite(percent) || percent < 0) return "–";
  return `${Math.round(percent)}%`;
}

export type InjuryTone = "orange" | "red";

/**
 * Under two weeks is the orange injury (a few days, or one week).
 * Two weeks and longer is the red injury.
 */
export function injuryTone(days: number): InjuryTone {
  return days < 14 ? "orange" : "red";
}

/** The length the squad screen prints for the days still out. */
export function injurySpan(days: number): string {
  if (days < 7) return "a few days";
  if (days < 14) return "1 week";
  if (days < 21) return "2 weeks";
  if (days < 28) return "3 weeks";
  if (days < 42) return "1 month";
  if (days < 56) return "6 weeks";
  if (days < 84) return "2 months";
  if (days < 112) return "3 months";
  if (days < 182) return "6 months";
  return "over 6 months";
}

export function injuryBackLabel(gameYear: number, gameDay: number, days: number): string {
  if (gameYear < 1800 || gameDay < 0 || days < 1) return "";
  const date = new Date(Date.UTC(gameYear, 0, 1));
  date.setUTCDate(date.getUTCDate() + gameDay + days);
  return formatDate(date);
}

/** Length, the exact days left, and the return date when the save has one. */
export function injuryNote(days: number, gameYear: number, gameDay: number): string {
  const left = days === 1 ? "1 day left" : `${days} days left`;
  const back = injuryBackLabel(gameYear, gameDay, days);
  return back ? `${injurySpan(days)} · ${left} · back ${back}` : `${injurySpan(days)} · ${left}`;
}

export function periodOf(id: WagePeriod) {
  return WAGE_PERIODS.find((item) => item.id === id) ?? WAGE_PERIODS[0];
}

export function rateNote(id: CurrencyId): string {
  const currency = currencyOf(id);
  if (currency.id === "gbp") return "Shown as stored in the file.";
  if (currency.id === "eur") return "1 £ = €3.8835.";
  const rate = currency.perPound;
  const text = rate >= 20 ? rate.toFixed(2) : rate.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `1 £ = ${text} ${currency.symbol}. Approximate display rate.`;
}

function withSymbol(symbol: string, body: string, sign: string): string {
  const spaced = /^[A-Za-z]{2,}$/.test(symbol);
  return spaced ? `${sign}${symbol} ${body}` : `${sign}${symbol}${body}`;
}

/** Pounds stored in the save, shown in the chosen currency. */
export function money(pounds: number, currencyId: CurrencyId): string {
  if (!Number.isFinite(pounds)) return "–";
  const sign = pounds < 0 ? "−" : "";
  const currency = currencyOf(currencyId);
  const amount = Math.abs(pounds) * currency.perPound;
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const digits = millions >= 10 ? 1 : 2;
    return withSymbol(currency.symbol, `${millions.toFixed(digits)}m`, sign);
  }
  if (amount >= 100_000) return withSymbol(currency.symbol, `${Math.round(amount / 1000)}k`, sign);
  if (amount >= 10_000) {
    const thousands = Math.round((amount / 1000) * 10) / 10;
    const body = Number.isInteger(thousands) ? `${thousands.toFixed(0)}k` : `${thousands.toFixed(1)}k`;
    return withSymbol(currency.symbol, body, sign);
  }
  return withSymbol(currency.symbol, Math.round(amount).toLocaleString("en-GB"), sign);
}

/** Weekly pounds from the save, shown per week, month (×4), or year (×50). */
export function wageText(weeklyPounds: number, currencyId: CurrencyId, periodId: WagePeriod): string {
  const period = periodOf(periodId);
  return `${money(weeklyPounds * period.weeks, currencyId)} ${period.suffix}`;
}

export function toPounds(shown: number, currencyId: CurrencyId): number {
  return shown / currencyOf(currencyId).perPound;
}

export function toWeeklyPounds(shown: number, currencyId: CurrencyId, periodId: WagePeriod): number {
  return toPounds(shown, currencyId) / periodOf(periodId).weeks;
}

export function bandOf(value: number): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const n = Math.max(1, Math.min(20, Math.round(value)));
  if (n <= 4) return 1;
  if (n <= 8) return 2;
  if (n <= 11) return 3;
  if (n <= 14) return 4;
  if (n <= 17) return 5;
  return 6;
}

/** Current and potential ability use the same six bands as attributes, after /10. */
export function abilityBand(value: number): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return bandOf(Math.max(1, Math.min(20, Math.round(value / 10))));
}

export function personLabel(player: PlayerRec, style: "common" | "full"): string {
  return style === "full" ? player.fullName || player.name : player.name || player.fullName;
}

export function isExpiring(player: PlayerRec, save: ParsedSave): boolean {
  if (player.expiresOrd < 0 || save.gameOrd <= 0) return false;
  const left = player.expiresOrd - save.gameOrd;
  return left >= 0 && left <= 6;
}

export type StatusKind =
  | "free"
  | "loan"
  | "request"
  | "listed"
  | "listLoan"
  | "bosman"
  | "unprotected"
  | "arranged"
  | "expiring"
  | "retired";

export type StatusPart = { kind: StatusKind; label: string };

export function statusParts(player: PlayerRec, save: ParsedSave): StatusPart[] {
  const flags = player.flags;
  const parts: StatusPart[] = [];
  if (flags & FLAG.retired) parts.push({ kind: "retired", label: "Retired" });
  if (flags & FLAG.free) parts.push({ kind: "free", label: "Free" });
  if (flags & FLAG.loan) {
    const from = save.clubs.find((club) => club.id === player.loanFromClubId)?.short;
    parts.push({ kind: "loan", label: from ? `Loan from ${from}` : "Loaned in" });
  }
  if (flags & FLAG.request) parts.push({ kind: "request", label: "Request" });
  else if (flags & FLAG.listed) parts.push({ kind: "listed", label: "Listed" });
  if (flags & FLAG.listLoan) parts.push({ kind: "listLoan", label: "Loan list" });
  if (flags & FLAG.bosman) parts.push({ kind: "bosman", label: "Bosman" });
  if (flags & FLAG.unprotected) parts.push({ kind: "unprotected", label: "Unprotected" });
  if (flags & FLAG.arranged) {
    const dest = save.clubs.find((club) => club.id === player.arrangedClubId)?.short;
    parts.push({ kind: "arranged", label: dest ? `Agreed · ${dest}` : "Agreed" });
  }
  if (isExpiring(player, save) && !(flags & FLAG.unprotected)) {
    parts.push({ kind: "expiring", label: "Expiring" });
  }
  return parts;
}

export function statusText(player: PlayerRec, save: ParsedSave): string {
  return statusParts(player, save)
    .map((part) => part.label)
    .join(" · ");
}

export type Lookups = {
  clubName: (id: number) => string;
  clubShort: (id: number) => string;
  nation: (id: number) => string;
  nationCode: (id: number) => string;
  compName: (id: number) => string;
};

export function buildLookups(save: ParsedSave): Lookups {
  const clubs = new Map(save.clubs.map((club) => [club.id, club]));
  const nations = new Map(save.nations.map((nation) => [nation.id, nation]));
  const comps = new Map(save.comps.map((comp) => [comp.id, comp]));
  return {
    clubName: (id) => (id < 0 ? "Free agent" : (clubs.get(id)?.name ?? "—")),
    clubShort: (id) => (id < 0 ? "Free" : (clubs.get(id)?.short || clubs.get(id)?.name || "—")),
    nation: (id) => nations.get(id)?.nationality || nations.get(id)?.name || "—",
    nationCode: (id) => nations.get(id)?.code || "—",
    compName: (id) => comps.get(id)?.name || "—",
  };
}
