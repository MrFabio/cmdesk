import { CA_DEPENDENT, caDependentFloat, displayAttr } from "./attr-display.ts";
import { isPureGoalkeeper } from "./positions.ts";
import { ATTRS, ATTR_INDEX, type AttrKey, type ParsedSave, type PlayerRec } from "./types.ts";
import type { Hit } from "./query.ts";

export type SetPieceId = "penalties" | "freeKicks" | "corners" | "throwIns";

export type SetPiece = {
  id: SetPieceId;
  label: string;
  /** What the game actually uses to pick the taker. */
  lead: string;
  primary: AttrKey;
  support: readonly AttrKey[];
  feet: boolean;
};

export const SET_PIECES: readonly SetPiece[] = [
  {
    id: "penalties",
    label: "Penalties",
    lead: "Best first. The player on the pitch with the highest Penalties takes them. A number after 20 is the in-match value, which splits players who both show 20.",
    primary: "penalties",
    support: ["finishing", "technique", "pressure", "importantMatches"],
    feet: false,
  },
  {
    id: "freeKicks",
    label: "Free kicks",
    lead: "Best first. The player on the pitch with the highest Free kicks takes them. Feet are shown because the side of the ball matters.",
    primary: "freeKicks",
    support: ["technique", "longShots", "crossing", "passing"],
    feet: true,
  },
  {
    id: "corners",
    label: "Corners",
    lead: "Best first. The player on the pitch with the highest Corners takes them. Feet are shown because the side of the ball matters.",
    primary: "corners",
    support: ["crossing", "technique", "passing"],
    feet: true,
  },
  {
    id: "throwIns",
    label: "Throw-ins",
    lead: "Best first. The player on the pitch with the highest Throw ins takes them.",
    primary: "throwIns",
    support: ["strength", "passing"],
    feet: false,
  },
];

const LABELS = new Map(ATTRS.map((attr) => [attr.key, attr.label]));

export function setPieceById(id: SetPieceId): SetPiece {
  const piece = SET_PIECES.find((entry) => entry.id === id);
  if (!piece) throw new Error(`Missing set piece ${id}`);
  return piece;
}

export type RatedAttr = { key: AttrKey; label: string; value: number };

export type RankedTaker = {
  index: number;
  player: PlayerRec;
  /** Profile value, 1–20, or -1 when unknown. */
  primary: number;
  /** Sort value. In-match float for CA-dependent attributes, otherwise the profile value. */
  engine: number;
  support: RatedAttr[];
};

function stored(save: ParsedSave, index: number, key: AttrKey): number {
  return save.attrs[index * ATTRS.length + ATTR_INDEX[key]] ?? -1;
}

function rate(
  save: ParsedSave,
  index: number,
  key: AttrKey,
  ca: number,
): { display: number; engine: number } {
  const intrinsic = stored(save, index, key);
  if (!Number.isFinite(intrinsic) || intrinsic === -1) return { display: -1, engine: -1 };
  if (CA_DEPENDENT.has(key)) {
    return {
      display: displayAttr(key, intrinsic, ca),
      engine: caDependentFloat(key, intrinsic, ca),
    };
  }
  const display = displayAttr(key, intrinsic, ca);
  return { display, engine: display };
}

function supportSum(row: RankedTaker): number {
  let sum = 0;
  for (const attr of row.support) if (attr.value >= 0) sum += attr.value;
  return sum;
}

/** Outfield squad, best taker first. Pure goalkeepers are omitted. */
export function rankSetPiece(save: ParsedSave, hits: Hit[], id: SetPieceId): RankedTaker[] {
  const piece = setPieceById(id);
  const ranked: RankedTaker[] = [];
  for (const hit of hits) {
    if (isPureGoalkeeper(hit.player.posMask)) continue;
    const primary = rate(save, hit.index, piece.primary, hit.player.ca);
    ranked.push({
      index: hit.index,
      player: hit.player,
      primary: primary.display,
      engine: primary.engine,
      support: piece.support.map((key) => ({
        key,
        label: LABELS.get(key) ?? key,
        value: rate(save, hit.index, key, hit.player.ca).display,
      })),
    });
  }
  ranked.sort((a, b) => {
    const placed = missingLast(a.engine, b.engine);
    if (placed !== 0) return placed;
    if (a.engine !== b.engine) return b.engine - a.engine;
    const support = supportSum(b) - supportSum(a);
    if (support !== 0) return support;
    return a.player.sortName.localeCompare(b.player.sortName);
  });
  return ranked;
}

function missingLast(a: number, b: number): number {
  const aMissing = a < 0;
  const bMissing = b < 0;
  if (aMissing === bMissing) return 0;
  return aMissing ? 1 : -1;
}

/** Rounded in-match value when the profile is capped at 20 and the engine is higher. */
export function inMatchOver(primary: number, engine: number): number | null {
  if (primary < 20 || engine <= 20) return null;
  const rounded = Math.round(engine);
  return rounded > 20 ? rounded : null;
}
