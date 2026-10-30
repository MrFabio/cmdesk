import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FLAG, type ParsedSave, type PlayerRec } from "./types.ts";
import { emptyFilters, searchPlayers, sortHits } from "./query.ts";
import type { Lookups } from "./labels.ts";

function player(patch: Partial<PlayerRec> & Pick<PlayerRec, "sortName">): PlayerRec {
  return {
    id: 0,
    name: patch.sortName,
    fullName: patch.sortName,
    nationId: 0,
    secondNationId: -1,
    clubId: 0,
    pos: "M C",
    posMask: 16,
    sideMask: 4,
    age: 20,
    ca: 100,
    pa: 120,
    wage: 1000,
    value: 0,
    expiresOrd: 100,
    flags: 0,
    arrangedClubId: -1,
    loanFromClubId: -1,
    squadNo: 0,
    morale: 0,
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
    leftFoot: 10,
    rightFoot: 10,
    ...patch,
  };
}

const lookups = {
  clubName: (id: number) => (id < 0 ? "Free agent" : `Club ${id}`),
  clubShort: (id: number) => `C${id}`,
  nation: () => "Albionese",
  nationCode: () => "ALB",
  compName: () => "Premier",
} satisfies Lookups;

describe("column sort and saved-search filters", () => {
  it("sorts ability high to low without moving players who have no contract to the front", () => {
    const save = { players: [], clubs: [] } as unknown as ParsedSave;
    const hits = [
      { index: 0, player: player({ sortName: "Low", ca: 80, expiresOrd: -1 }) },
      { index: 1, player: player({ sortName: "High", ca: 160, expiresOrd: 10 }) },
      { index: 2, player: player({ sortName: "Mid", ca: 120, expiresOrd: 40 }) },
    ];
    assert.deepEqual(
      sortHits(hits, "ca", "desc", save, lookups).map((hit) => hit.player.sortName),
      ["High", "Mid", "Low"],
    );
    assert.deepEqual(
      sortHits(hits, "expires", "desc", save, lookups).map((hit) => hit.player.sortName),
      ["Mid", "High", "Low"],
    );
  });

  it("keeps an unprotected search to players with that flag", () => {
    const save = {
      players: [
        player({ sortName: "Open", flags: FLAG.unprotected }),
        player({ sortName: "Tied", flags: 0 }),
      ],
      clubs: [],
      gameOrd: 1,
      attrs: new Int8Array(),
    } as unknown as ParsedSave;
    const found = searchPlayers(save, { ...emptyFilters(), unprotected: true }, "");
    assert.deepEqual(
      found.map((hit) => hit.player.sortName),
      ["Open"],
    );
  });
});
