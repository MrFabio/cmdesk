import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rosterFrom } from "./players.ts";
import { ATTRS, ATTR_INDEX, FLAG, type ParsedSave, type PlayerRec } from "./types.ts";
import { emptyFilters, rateHits, searchPlayers, sortHits, squadOf } from "./query.ts";
import { intrinsicForDisplay } from "./attr-display.ts";
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

  it("keeps a loan-list search to players offered for loan", () => {
    const rows = [
      player({ sortName: "Offered", flags: FLAG.listLoan }),
      player({ sortName: "For sale", flags: FLAG.listed }),
      player({ sortName: "Away", flags: FLAG.loan }),
    ];
    const save = {
      roster: rosterFrom(rows),
      clubs: [],
      gameOrd: 1,
      attrs: new Int8Array(),
    } as unknown as ParsedSave;
    assert.deepEqual(
      searchPlayers(save, { ...emptyFilters(), listLoan: true }, "").map((hit) => hit.player.sortName),
      ["Offered"],
    );
    assert.equal(searchPlayers(save, { ...emptyFilters(), listed: true }, "").length, 1);
  });

  it("keeps an unprotected search to players with that flag", () => {
    const rows = [
      player({ sortName: "Open", flags: FLAG.unprotected }),
      player({ sortName: "Tied", flags: 0 }),
    ];
    const save = {
      roster: rosterFrom(rows),
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

  it("hides retired players until that filter is turned off", () => {
    const rows = [
      player({ sortName: "Rogne Thomas", name: "Thomas Rogne", fullName: "Thomas Pauck Rogne", flags: FLAG.retired }),
      player({ sortName: "Rogne Young", name: "Young Rogne", fullName: "Young Rogne", flags: 0 }),
    ];
    const save = {
      roster: rosterFrom(rows),
      clubs: [],
      gameOrd: 1,
      attrs: new Int8Array(),
    } as unknown as ParsedSave;
    assert.deepEqual(
      searchPlayers(save, emptyFilters(), "rogne").map((hit) => hit.player.fullName),
      ["Young Rogne"],
    );
    assert.deepEqual(
      searchPlayers(save, { ...emptyFilters(), hideRetired: false }, "rogne").map((hit) => hit.player.fullName),
      ["Thomas Pauck Rogne", "Young Rogne"],
    );
    assert.equal(searchPlayers(save, { ...emptyFilters(), hideRetired: false }, "").length, 0);
  });

  it("waits for a name or a filter before listing the whole database", () => {
    const rows = [
      player({ sortName: "Hale Jon", name: "Jon", fullName: "Jon Hale" }),
      player({ sortName: "Other", name: "Other", fullName: "Other" }),
    ];
    const save = {
      roster: rosterFrom(rows),
      clubs: [],
      gameOrd: 1,
      attrs: new Int8Array(),
    } as unknown as ParsedSave;
    assert.equal(searchPlayers(save, emptyFilters(), "").length, 0);
    assert.deepEqual(
      searchPlayers(save, emptyFilters(), "hale").map((hit) => hit.player.fullName),
      ["Jon Hale"],
    );
  });

  it("reads a squad from the club index", () => {
    const save = {
      roster: rosterFrom([
        player({ sortName: "A", clubId: 2 }),
        player({ sortName: "B", clubId: 5 }),
        player({ sortName: "C", clubId: 2 }),
      ]),
      clubs: [],
      gameOrd: 1,
      attrs: new Int8Array(),
    } as unknown as ParsedSave;
    assert.deepEqual(
      squadOf(save, 2).map((hit) => hit.player.sortName),
      ["A", "C"],
    );
  });

  it("sorts rating high to low and leaves an unscored player last", () => {
    const save = { players: [], clubs: [] } as unknown as ParsedSave;
    const hits = [
      { index: 0, player: player({ sortName: "Low" }), rating: 10 },
      { index: 1, player: player({ sortName: "None" }), rating: -1 },
      { index: 2, player: player({ sortName: "High" }), rating: 16.5 },
    ];
    assert.deepEqual(
      sortHits(hits, "rating", "desc", save, lookups).map((hit) => hit.player.sortName),
      ["High", "Low", "None"],
    );
  });

  it("sorts an attribute high to low and leaves an unknown value last", () => {
    const ca = 100;
    const rows = [
      player({ sortName: "Low", ca }),
      player({ sortName: "None", ca }),
      player({ sortName: "High", ca }),
    ];
    const attrs = new Int8Array(rows.length * ATTRS.length);
    attrs.fill(-1);
    attrs[ATTR_INDEX.handling] = intrinsicForDisplay("handling", 8, ca);
    attrs[2 * ATTRS.length + ATTR_INDEX.handling] = intrinsicForDisplay("handling", 18, ca);
    const save = {
      roster: rosterFrom(rows),
      clubs: [],
      gameOrd: 1,
      attrs,
    } as unknown as ParsedSave;
    const hits = rows.map((row, index) => ({ index, player: row }));
    assert.deepEqual(
      sortHits(hits, "handling", "desc", save, lookups).map((hit) => hit.player.sortName),
      ["High", "Low", "None"],
    );
  });

  it("rates a centre-back from the displayed marking and positioning", () => {
    const ca = 100;
    const row = player({ sortName: "Cover", pos: "D C", posMask: 4, sideMask: 4, ca });
    const attrs = new Int8Array(ATTRS.length);
    attrs.fill(-1);
    attrs[ATTR_INDEX.marking] = intrinsicForDisplay("marking", 10, ca);
    attrs[ATTR_INDEX.positioning] = intrinsicForDisplay("positioning", 20, ca);
    const save = {
      roster: rosterFrom([row]),
      clubs: [],
      gameOrd: 1,
      attrs,
    } as unknown as ParsedSave;
    const [hit] = rateHits(save, [{ index: 0, player: row }]);
    assert.equal(hit?.rating, 15);
    assert.equal(hit?.ratingSlot, "DC");
    assert.match(hit?.ratingTitle ?? "", /Marking/);
    assert.match(hit?.ratingTitle ?? "", /Positioning/);
  });
});
