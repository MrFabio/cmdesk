import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { caDependentFloat, displayAttr, intrinsicForDisplay } from "./attr-display.ts";
import { attrRanksFor, playedSpots, type AttrRank, type PitchSpot } from "./positions.ts";
import { rankSetPiece } from "./set-pieces.ts";
import { ATTRS, ATTR_INDEX, type AttrKey, type ParsedSave, type PlayerRec } from "./types.ts";

function ranks(mask: number, side: number): Record<string, AttrRank> {
  return Object.fromEntries(attrRanksFor(mask, side));
}

describe("key attributes for a position", () => {
  it("marks Handling as primary and Reflexes and Agility as secondary for a goalkeeper", () => {
    assert.deepEqual(ranks(1, 0), {
      agility: "secondary",
      handling: "primary",
      reflexes: "secondary",
    });
  });

  it("leaves One on ones unmarked for a goalkeeper", () => {
    assert.equal(attrRanksFor(1, 0).has("oneOnOnes"), false);
  });

  it("marks Marking and Positioning for a central defender, not the wide-back set", () => {
    assert.deepEqual(ranks(4, 4), { marking: "primary", positioning: "primary" });
  });

  it("marks the wide-back set for a right-back, with the next band secondary", () => {
    assert.deepEqual(ranks(4, 1), {
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
    assert.deepEqual(ranks(4, 7), {
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
    assert.deepEqual(ranks(8, 4), {
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
    assert.deepEqual(ranks(64, 4), {
      dribbling: "secondary",
      jumping: "primary",
      movement: "primary",
      passing: "secondary",
      positioning: "secondary",
      stamina: "secondary",
      technique: "primary",
    });
  });

  it("uses central-defender weights for a sweeper", () => {
    assert.deepEqual(ranks(2, 4), { marking: "primary", positioning: "primary" });
  });

  it("uses wide-mid weights for a wide attacking mid", () => {
    assert.deepEqual(ranks(32, 1), {
      dribbling: "primary",
      movement: "primary",
      passing: "secondary",
      stamina: "secondary",
      teamwork: "secondary",
      technique: "primary",
    });
  });

  it("marks nothing when the player has no position", () => {
    assert.equal(attrRanksFor(0, 0).size, 0);
  });
});

function spots(mask: number, side: number): PitchSpot[] {
  return [...playedSpots(mask, side)].sort();
}

describe("spots on the position pitch", () => {
  it("lights only the goalkeeper spot", () => {
    assert.deepEqual(spots(1, 7), ["GK"]);
  });

  it("keeps a sweeper central when the side is wide", () => {
    assert.deepEqual(spots(2, 1), ["SW"]);
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
): ParsedSave {
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
  } as ParsedSave;
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
