import type { AttrKey } from "./types.ts";

/**
 * Attributes whose save-file byte is an *intrinsic*, not the 1–20 profile value.
 * The game (and CM Scout) derive the shown value from intrinsic + CA.
 * List matches the match-engine / Uncap20 research used by CM Scout.
 */
export const CA_DEPENDENT = new Set<AttrKey>([
  "anticipation",
  "crossing",
  "decisions",
  "dribbling",
  "finishing",
  "handling",
  "heading",
  "longShots",
  "marking",
  "movement",
  "oneOnOnes",
  "passing",
  "penalties",
  "positioning",
  "reflexes",
  "tackling",
  "throwIns",
  "vision",
]);

function applyExpBonus(deservesBonus: boolean, val: number, threshold: number, power: number): number {
  if (deservesBonus && val > threshold) return threshold + (val - threshold) ** power;
  return val;
}

/** In-match / profile float before rounding, for a CA-dependent intrinsic. */
export function caDependentFloat(key: AttrKey, intrinsic: number, ca: number): number {
  const originalAbility = ca;
  // C#: ability = (byte)(ability / 2 + 80)
  let ability = (Math.floor(ca / 2) + 80) & 0xff;
  let intrinsicFloat = intrinsic;
  let v = (2 * intrinsicFloat + ability) * 0.1;
  const deservesBonus = ability > 150;

  switch (key) {
    case "anticipation":
      v = Math.max(0, v + 0.23) / 2 + 5;
      break;
    case "crossing":
    case "finishing":
      v = applyExpBonus(deservesBonus, v, 16, 1.25);
      break;
    case "heading":
      v = applyExpBonus(deservesBonus, v, 18, 1.2);
      break;
    case "marking":
    case "positioning":
      v = applyExpBonus(deservesBonus, v, 16, 1.2);
      break;
    case "movement":
      v = (v + 0.13) * 0.65 + 7;
      break;
    case "passing":
      v = applyExpBonus(deservesBonus, v, 18, 1.25);
      break;
    case "vision":
      if (intrinsic > 10) {
        if (originalAbility < 80) intrinsicFloat = 10 + (intrinsic - 10) * 0.75;
        else if (originalAbility < 125) intrinsicFloat = 10 + (intrinsic - 10) * 0.85;
      }
      v = (2 * intrinsicFloat + ability) * 0.1;
      v = applyExpBonus(deservesBonus, v, 17, 1.2);
      break;
    default:
      break;
  }
  return Math.max(0, v);
}

/** Profile value 1–20 (unknown stays -1). */
export function displayAttr(key: AttrKey, intrinsic: number, ca: number): number {
  if (!Number.isFinite(intrinsic)) return -1;
  if (intrinsic === -1) return -1;
  if (!CA_DEPENDENT.has(key)) {
    if (intrinsic < 0) return -1;
    return Math.max(1, Math.min(20, Math.round(intrinsic)));
  }
  const rounded = Math.round(caDependentFloat(key, intrinsic, ca));
  return Math.max(1, Math.min(20, rounded));
}

/** Invert display → intrinsic for building sample careers. */
export function intrinsicForDisplay(key: AttrKey, display: number, ca: number): number {
  const target = Math.max(1, Math.min(20, display));
  if (!CA_DEPENDENT.has(key)) return target;
  let lo = -110;
  let hi = 110;
  while (lo < hi) {
    let mid = lo + hi;
    mid = mid >= 0 ? Math.floor(mid / 2) : Math.floor((mid - 1) / 2);
    const cur = caDependentFloat(key, mid, ca);
    if (cur >= target - 1e-9) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function toSignedByte(value: number): number {
  const n = Math.round(value);
  if (n < 0) return (n + 256) & 0xff;
  return n & 0xff;
}
