import { FLAG, type ParsedSave, type PlayerRec } from "./types.ts";

/**
 * Units of each currency for £1 as stored in the save.
 * Euro uses £1 = €3.8835 (display multiplier for this desk).
 * Other currencies are approximate crosses for display only.
 */
export const CURRENCIES = [
  { id: "eur", label: "Euro", symbol: "€", perPound: 3.8835 },
  { id: "gbp", label: "Pound", symbol: "£", perPound: 1 },
  { id: "usd", label: "Dollar", symbol: "$", perPound: 1.5 },
  { id: "chf", label: "Swiss franc", symbol: "CHF", perPound: 1.5 },
  { id: "sek", label: "Swedish kr", symbol: "kr", perPound: 15 },
  { id: "nok", label: "Norwegian kr", symbol: "kr", perPound: 13 },
  { id: "dkk", label: "Danish kr", symbol: "kr", perPound: 12 },
  { id: "pln", label: "Zloty", symbol: "zł", perPound: 6 },
  { id: "brl", label: "Real", symbol: "R$", perPound: 5 },
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
  | "expiring";

export type StatusPart = { kind: StatusKind; label: string };

export function statusParts(player: PlayerRec, save: ParsedSave): StatusPart[] {
  const flags = player.flags;
  const parts: StatusPart[] = [];
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
