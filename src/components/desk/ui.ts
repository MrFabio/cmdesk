import type { AttrRank } from "@/lib/cm/positions";

export const control =
  "h-11 w-full rounded-sm border border-line bg-bg px-2 text-base text-fg outline-none focus-visible:border-accent md:h-9 md:text-sm";

export const button =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-sm border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

export const buttonPrimary =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-sm bg-accent px-3 text-sm font-medium text-accent-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const chipBase =
  "inline-flex h-9 items-center rounded-sm border px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const chip = `${chipBase} border-line text-muted hover:text-fg`;

/** Selected chip. Standalone on purpose: pairing it with `text-muted` lets the muted colour win. */
export const chipOn = `${chipBase} border-accent bg-accent font-medium text-accent-ink hover:text-accent-ink`;

export function chipClass(on: boolean): string {
  return on ? chipOn : chip;
}

/** Left rule for a position-rating weight. Primary is 0.10 and up; secondary is 0.05–0.10. */
export function attrRankRow(rank: AttrRank | undefined): string {
  if (rank === "primary") return "border-l-2 border-accent bg-surface-2";
  if (rank === "secondary") return "border-l-2 border-secondary";
  return "";
}

export function attrRankLabel(rank: AttrRank | undefined): string {
  if (rank === "primary") return "font-medium text-fg";
  if (rank === "secondary") return "font-medium text-secondary";
  return "text-muted";
}
