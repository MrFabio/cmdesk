import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intrinsicForDisplay } from "./attr-display.ts";
import { FALLBACK_SHAPE, suggestMatch } from "./suggest.ts";
import { ATTRS, ATTR_INDEX, type AttrKey, type ParsedSave, type PlayerRec } from "./types.ts";

function player(
  name: string,
  posMask: number,
  sideMask: number,
  ca: number,
  condition: number,
  morale: number,
): PlayerRec {
  return {
    id: 0,
    name,
    fullName: name,
    sortName: name,
    nationId: 0,
    secondNationId: -1,
    clubId: 0,
    pos: name,
    posMask,
    sideMask,
    age: 24,
    ca,
    pa: ca,
    wage: 0,
    value: 0,
    expiresOrd: -1,
    flags: 0,
    arrangedClubId: -1,
    loanFromClubId: -1,
    squadNo: 0,
    morale,
    condition,
    dobLabel: "",
    joinedLabel: "",
    expiresLabel: "",
    intApps: 0,
    intGoals: 0,
    homeRep: 0,
    currentRep: 0,
    worldRep: 0,
    squadStatus: "",
    releaseFee: 0,
    leftFoot: 12,
    rightFoot: 18,
  };
}

function sheet(ca: number, shown: Partial<Record<AttrKey, number>>): Partial<Record<AttrKey, number>> {
  const attrs: Partial<Record<AttrKey, number>> = {};
  for (const [key, value] of Object.entries(shown)) {
    attrs[key as AttrKey] = intrinsicForDisplay(key as AttrKey, value ?? 1, ca);
  }
  return attrs;
}

function career(rows: { player: PlayerRec; attrs: Partial<Record<AttrKey, number>> }[]): ParsedSave {
  const attrs = new Int8Array(rows.length * ATTRS.length);
  attrs.fill(-1);
  rows.forEach((row, index) => {
    for (const [key, value] of Object.entries(row.attrs)) {
      attrs[index * ATTRS.length + ATTR_INDEX[key as AttrKey]] = value ?? -1;
    }
  });
  return { players: rows.map((row) => row.player), attrs } as ParsedSave;
}

const gk = { handling: 16, reflexes: 14, agility: 14, consistency: 14, naturalFitness: 14 };
const defender = { marking: 16, positioning: 16, consistency: 14, naturalFitness: 14 };

describe("suggested match side", () => {
  it("starts the match-fit goalkeeper ahead of a tired one, and keeps a goalkeeper in goal", () => {
    const fresh = player("Fresh", 1, 0, 140, 98, 10);
    const spent = player("Spent", 1, 0, 170, 50, 10);
    const forward = player("Forward", 64, 4, 150, 100, 10);
    const save = career([
      { player: fresh, attrs: sheet(140, gk) },
      { player: spent, attrs: sheet(170, { ...gk, handling: 19, reflexes: 18 }) },
      { player: forward, attrs: sheet(150, { movement: 16, technique: 16, jumping: 16, consistency: 14 }) },
    ]);
    const hits = save.players.map((row, index) => ({ index, player: row }));
    const side = suggestMatch(save, hits, FALLBACK_SHAPE, "4-4-2");
    assert.equal(side.pitch[0]?.player.name, "Fresh");
    assert.equal(side.pitch[0]?.natural, true);
    const names = side.pitch.map((pick) => pick?.player.name);
    assert.equal(new Set(names.filter(Boolean)).size, names.filter(Boolean).length);
    assert.equal(names.includes("Forward") && names[0] !== "Forward", true);
  });

  it("prefers a natural centre back to an equal player from another line", () => {
    const centre = player("Centre", 4, 4, 140, 100, 10);
    const wide = player("Wide", 16, 2, 140, 100, 10);
    const save = career([
      { player: centre, attrs: sheet(140, defender) },
      { player: wide, attrs: sheet(140, defender) },
    ]);
    const hits = save.players.map((row, index) => ({ index, player: row }));
    const side = suggestMatch(save, hits, FALLBACK_SHAPE, "4-4-2");
    const centreBacks = side.pitch.filter((pick, index) => {
      const slot = FALLBACK_SHAPE[index]!;
      return slot.row === 2 && (slot.col === 1 || slot.col === 3);
    });
    assert.ok(centreBacks.some((pick) => pick?.player.name === "Centre"));
  });

  it("ranks a happier player above the same attributes at very low morale", () => {
    const low = player("Low", 1, 0, 150, 100, 2);
    const steady = player("Steady", 1, 0, 150, 100, 12);
    const save = career([
      { player: low, attrs: sheet(150, gk) },
      { player: steady, attrs: sheet(150, gk) },
    ]);
    const hits = save.players.map((row, index) => ({ index, player: row }));
    const side = suggestMatch(save, hits, FALLBACK_SHAPE, "4-4-2");
    assert.equal(side.pitch[0]?.player.name, "Steady");
  });

  it("uses a 4-4-2 when no shape was stored", () => {
    const save = career([{ player: player("Only", 1, 0, 120, 100, 10), attrs: sheet(120, gk) }]);
    const hits = save.players.map((row, index) => ({ index, player: row }));
    const side = suggestMatch(save, hits, [], "");
    assert.equal(side.fallbackShape, true);
    assert.equal(side.shapeName, "4-4-2");
    assert.equal(side.slots.length, 11);
    assert.equal(side.pitch[0]?.player.name, "Only");
  });
});
