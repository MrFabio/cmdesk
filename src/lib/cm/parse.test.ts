import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attrOf, parseSave } from "./parse.ts";
import { buildSample } from "./sample.ts";
import { FLAG } from "./types.ts";

function find(save: ReturnType<typeof parseSave>, name: string) {
  const player = save.players.find((row) => row.fullName === name || row.name === name);
  assert.ok(player, `missing ${name}`);
  return player;
}

describe("sample career", () => {
  it("reads the plain and compressed fictional save the same way", () => {
    const plain = parseSave(buildSample(false), "sample-plain.sav");
    const packed = parseSave(buildSample(true), "Sample career.sav");
    assert.equal(plain.compressed, false);
    assert.equal(packed.compressed, true);
    assert.equal(packed.gameDateLabel, "15 Oct 2001");
    assert.equal(packed.clubs[packed.humanClubId]?.name, "Northbridge");
    assert.equal(packed.clubs[packed.humanClubId]?.manager, "Pat Quinn");

    const names = (save: typeof packed) =>
      save.players.map((player) => [player.fullName, player.ca, player.pa, player.flags, player.loanFromClubId, player.clubId].join("|")).sort();
    assert.deepEqual(names(plain), names(packed));

    const mira = find(packed, "Mira Calder");
    assert.equal(mira.ca, 150);
    assert.equal(mira.pa, 160);
    assert.equal(mira.pos.startsWith("GK"), true);
    assert.equal(packed.clubs.find((club) => club.id === mira.clubId)?.short, "Northbridge");
    assert.equal(attrOf(packed, packed.players.indexOf(mira), "handling"), 18);

    const jon = find(packed, "Jon Hale");
    assert.ok(jon.flags & FLAG.request);
    assert.ok(jon.flags & FLAG.bosman);
    assert.ok(jon.flags & FLAG.unprotected);
    assert.equal(jon.expiresLabel, "1 Mar 2002");

    const ade = find(packed, "Ade Okonkwo");
    assert.ok(ade.flags & FLAG.loan);
    assert.equal(packed.clubs.find((club) => club.id === ade.loanFromClubId)?.name, "Redwick");
    // Staff wage is the parent deal (£3k); Northbridge's loan contract pays £1.2k.
    assert.equal(ade.wage, 1200);

    const sam = find(packed, "Sam Voss");
    assert.ok(sam.flags & FLAG.free);
    assert.equal(sam.clubId < 0, true);

    const luis = find(packed, "Luis Ferrer");
    assert.ok(luis.flags & FLAG.listed);

    const soren = find(packed, "Søren Lind");
    assert.equal(soren.fullName, "Søren Lind");
    assert.equal(packed.nations.find((nation) => nation.id === soren.nationId)?.name, "Nordmark");

    const ned = find(packed, "Ned Pell");
    assert.equal(ned.name, "Pello");
    assert.equal(attrOf(packed, packed.players.indexOf(ned), "pace"), 4);
  });
});
