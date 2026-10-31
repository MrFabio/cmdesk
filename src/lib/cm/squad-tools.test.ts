import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { caDependentFloat, displayAttr, intrinsicForDisplay } from "./attr-display.ts";
import { attrRanksFor, playedSpots, roleRating, type AttrRank, type PitchSpot } from "./positions.ts";
import { rankSetPiece } from "./set-pieces.ts";
import { ATTRS, ATTR_INDEX, type AttrKey, type ParsedSave, type PlayerRec } from "./types.ts";

const HIDDEN = {
  consistency: "primary",
  importantMatches: "primary",
  pressure: "secondary",
  temperament: "secondary",
  versatility: "secondary",
} as const;

function expectRanks(mask: number, side: number, position: Record<string, AttrRank> = {}) {
  assert.deepEqual(Object.fromEntries(attrRanksFor(mask, side)), { ...HIDDEN, ...position });
}

describe("key attributes for a position", () => {
  it("marks Handling as primary and Reflexes and Agility as secondary for a goalkeeper", () => {
    expectRanks(1, 0, {
      agility: "secondary",
      handling: "primary",
      reflexes: "secondary",
    });
  });

  it("leaves One on ones unmarked for a goalkeeper", () => {
    assert.equal(attrRanksFor(1, 0).has("oneOnOnes"), false);
  });

  it("marks Marking and Positioning for a central defender, not the wide-back set", () => {
    expectRanks(4, 4, { marking: "primary", positioning: "primary" });
  });

  it("marks the wide-back set for a right-back, with the next band secondary", () => {
    expectRanks(4, 1, {
      dribbling: "primary",
      jumping: "secondary",
      movement: "secondary",
      passing: "secondary",
      positioning: "primary",
      teamwork: "secondary",
      technique: "primary",
    });
  });

  it("unions central and wide when the player covers both sides", () => {
    expectRanks(4, 7, {
      dribbling: "primary",
      jumping: "secondary",
      marking: "primary",
      movement: "secondary",
      passing: "secondary",
      positioning: "primary",
      teamwork: "secondary",
      technique: "primary",
    });
  });

  it("keeps Positioning primary for a defensive mid and marks the next band secondary", () => {
    expectRanks(8, 4, {
      movement: "secondary",
      passing: "secondary",
      positioning: "primary",
      vision: "secondary",
      workRate: "secondary",
    });
  });

  it("keeps a primary mark when another position only rates that attribute as secondary", () => {
    const marked = attrRanksFor(4 | 64, 4);
    assert.equal(marked.get("positioning"), "primary");
    assert.equal(marked.get("marking"), "primary");
    assert.equal(marked.has("finishing"), false);
  });

  it("marks a forward's main three as primary and leaves Finishing and Heading off", () => {
    expectRanks(64, 4, {
      dribbling: "secondary",
      jumping: "primary",
      movement: "primary",
      passing: "secondary",
      positioning: "secondary",
      stamina: "secondary",
      technique: "primary",
    });
  });

  it("uses wide-mid weights for a wide attacking mid", () => {
    expectRanks(32, 1, {
      dribbling: "primary",
      movement: "primary",
      passing: "secondary",
      stamina: "secondary",
      teamwork: "secondary",
      technique: "primary",
    });
  });

  it("still marks the match hidden attributes when the player has no position", () => {
    expectRanks(0, 0);
    const marked = attrRanksFor(0, 0);
    assert.equal(marked.has("dirtiness"), false);
    assert.equal(marked.has("injuryProneness"), false);
    assert.equal(marked.has("determination"), false);
  });
});

function values(map: Partial<Record<AttrKey, number>> = {}) {
  return (key: AttrKey) => map[key] ?? -1;
}

describe("position rating", () => {
  it("weights a goalkeeper towards handling, the heaviest highlighted attribute", () => {
    const rated = roleRating(1, 0, values({ handling: 20, agility: 10, reflexes: 10 }));
    assert.equal(rated?.slot, "GK");
    assert.equal(rated?.value, 15.5);
    assert.deepEqual(rated?.attrs, ["Handling", "Agility", "Reflexes"]);
  });

  it("leaves finishing and heading out of a forward rating", () => {
    const rated = roleRating(
      64,
      4,
      values({
        movement: 10,
        technique: 10,
        jumping: 10,
        positioning: 10,
        stamina: 10,
        dribbling: 10,
        passing: 10,
        finishing: 20,
        heading: 20,
      }),
    );
    assert.equal(rated?.slot, "F");
    assert.equal(rated?.value, 10);
    assert.equal(rated?.attrs.includes("Finishing"), false);
    assert.equal(rated?.attrs.includes("Heading"), false);
    assert.equal(rated?.attrs[0], "Movement");
  });

  it("rates a right-back on the wide set and labels that side", () => {
    const rated = roleRating(4, 1, values({ positioning: 18, technique: 14, dribbling: 12 }));
    assert.equal(rated?.slot, "DR");
    assert.equal(rated?.attrs[0], "Positioning");
  });

  it("scores the searched position when a player can play two", () => {
    const attrs = values({
      marking: 18,
      positioning: 18,
      movement: 8,
      technique: 8,
      jumping: 8,
      dribbling: 8,
      stamina: 8,
      passing: 8,
    });
    const asDefender = roleRating(4 | 64, 4, attrs, { posMask: 4, sideMask: 0 });
    const asForward = roleRating(4 | 64, 4, attrs, { posMask: 64, sideMask: 0 });
    assert.equal(asDefender?.slot, "DC");
    assert.equal(asForward?.slot, "F");
    assert.ok((asDefender?.value ?? 0) > (asForward?.value ?? 0));
  });

  it("keeps the more defensive slot when two positions score the same", () => {
    const rated = roleRating(4 | 16, 4, () => 10);
    assert.equal(rated?.slot, "DC");
    assert.equal(rated?.value, 10);
  });

  it("keeps a stronger centre-back score ahead of a weaker midfield score", () => {
    const rated = roleRating(4 | 16, 4, (key) => (key === "marking" || key === "positioning" ? 18 : 8));
    assert.equal(rated?.slot, "DC");
    assert.equal(rated?.value, 17.2);
  });

  it("gives a centre-back a small lift for better stamina", () => {
    const fresh = roleRating(4, 4, values({ marking: 14, positioning: 14, stamina: 18 }));
    const tired = roleRating(4, 4, values({ marking: 14, positioning: 14, stamina: 8 }));
    assert.equal(fresh?.value, 14.3);
    assert.equal(tired?.value, 13.5);
    assert.equal(fresh?.attrs.at(-1), "Stamina");
  });

  it("returns nothing when the player has no position", () => {
    assert.equal(roleRating(0, 0, () => 10), null);
  });
});

function spots(mask: number, side: number): PitchSpot[] {
  return [...playedSpots(mask, side)].sort();
}

describe("spots on the position pitch", () => {
  it("lights only the goalkeeper spot", () => {
    assert.deepEqual(spots(1, 7), ["GK"]);
  });

  it("lights a right-back and not the centre", () => {
    assert.deepEqual(spots(4, 1), ["DR"]);
  });

  it("lights left and centre for a defender who covers both", () => {
    assert.deepEqual(spots(4, 6), ["DC", "DL"]);
  });

  it("treats a role with no side as central", () => {
    assert.deepEqual(spots(4, 0), ["DC"]);
  });

  it("lights the wide and central attacking-mid spots", () => {
    assert.deepEqual(spots(32, 6), ["AMC", "AML"]);
  });

  it("puts a left forward on the left, not through the middle", () => {
    assert.deepEqual(spots(64, 2), ["FL"]);
  });

  it("lights each role on the sides the player has", () => {
    assert.deepEqual(spots(4 | 16, 5), ["DC", "DR", "MC", "MR"]);
  });

  it("lights nothing when the player has no position", () => {
    assert.deepEqual(spots(0, 7), []);
  });
});

function player(name: string, posMask: number, ca = 85): PlayerRec {
  return {
    id: 0,
    name,
    fullName: name,
    sortName: name,
    nationId: 0,
    secondNationId: -1,
    clubId: 0,
    pos: "F C",
    posMask,
    sideMask: 4,
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
    morale: 10,
    condition: -1,
    injuryDays: -1,
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

function career(
  rows: { player: PlayerRec; attrs: Partial<Record<AttrKey, number>> }[],
): ParsedSave & { players: PlayerRec[] } {
  const attrs = new Int8Array(rows.length * ATTRS.length);
  attrs.fill(-1);
  rows.forEach((row, index) => {
    for (const [key, value] of Object.entries(row.attrs)) {
      attrs[index * ATTRS.length + ATTR_INDEX[key as AttrKey]] = value ?? -1;
    }
  });
  return {
    players: rows.map((row) => row.player),
    attrs,
  } as ParsedSave & { players: PlayerRec[] };
}

describe("set-piece ranking", () => {
  it("orders penalty takers by the in-match value, ahead of the capped profile", () => {
    const ca = 85;
    // Both profile as 20. 37 is just inside the cap; 49 is past it in the match.
    const capped = 37;
    const elite = 49;
    assert.equal(displayAttr("penalties", capped, ca), 20);
    assert.equal(displayAttr("penalties", elite, ca), 20);
    assert.ok(caDependentFloat("penalties", elite, ca) > 20);
    assert.ok(caDependentFloat("penalties", elite, ca) > caDependentFloat("penalties", capped, ca));

    const save = career([
      { player: player("Capped", 64), attrs: { penalties: capped, finishing: 10 } },
      { player: player("Elite", 64), attrs: { penalties: elite, finishing: 10 } },
      {
        player: player("Ordinary", 64),
        attrs: { penalties: intrinsicForDisplay("penalties", 12, ca) },
      },
      { player: player("Keeper", 1), attrs: { penalties: 40 } },
    ]);
    const hits = save.players.map((row, index) => ({ index, player: row }));
    const ranked = rankSetPiece(save, hits, "penalties");
    assert.deepEqual(
      ranked.map((row) => row.player.name),
      ["Elite", "Capped", "Ordinary"],
    );
    assert.equal(ranked[0]?.primary, 20);
    assert.ok((ranked[0]?.engine ?? 0) > 20);
  });

  it("orders free kicks by the stored attribute and keeps a goalkeeper who also plays outfield", () => {
    const save = career([
      { player: player("Low", 16), attrs: { freeKicks: 8 } },
      { player: player("High", 16), attrs: { freeKicks: 18 } },
      { player: player("KeeperForward", 1 | 64), attrs: { freeKicks: 14 } },
    ]);
    const hits = save.players.map((row, index) => ({ index, player: row }));
    const ranked = rankSetPiece(save, hits, "freeKicks");
    assert.deepEqual(
      ranked.map((row) => row.player.name),
      ["High", "KeeperForward", "Low"],
    );
  });
});
