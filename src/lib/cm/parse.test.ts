import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchLineup } from "./match.ts";
import { attrOf, parseSave, readHumanPick } from "./parse.ts";
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
      save.players.map((player) => [player.fullName, player.ca, player.pa, player.flags, player.loanFromClubId, player.clubId, player.condition].join("|")).sort();
    assert.deepEqual(names(plain), names(packed));
    const tails = (save: typeof packed) =>
      save.clubs.map((club) => [club.tacticId, club.trainingTactics.join(","), club.matchSquad.join(",")].join("|"));
    assert.deepEqual(tails(plain), tails(packed));
    assert.deepEqual(plain.tactics, packed.tactics);
    assert.equal(plain.humanManager, null);
    assert.equal(packed.humanManager, null);
    assert.equal(plain.clubs[0]?.tacticId, 0);
    assert.deepEqual(plain.clubs[0]?.matchSquad, Array(20).fill(0));
    assert.equal(matchLineup(plain, plain.clubs[0]!).empty, true);

    const mira = find(packed, "Mira Calder");
    assert.equal(mira.ca, 150);
    assert.equal(mira.pa, 160);
    assert.equal(mira.pos.startsWith("GK"), true);
    assert.equal(packed.clubs.find((club) => club.id === mira.clubId)?.short, "Northbridge");
    assert.equal(attrOf(packed, packed.players.indexOf(mira), "handling"), 18);

    assert.equal(mira.condition, 100);

    const jon = find(packed, "Jon Hale");
    assert.ok(jon.flags & FLAG.request);
    assert.ok(jon.flags & FLAG.bosman);
    assert.ok(jon.flags & FLAG.unprotected);
    assert.equal(jon.expiresLabel, "1 Mar 2002");
    assert.equal(jon.condition, 64);

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

function clubAt(buffer: ArrayBuffer, clubIndex: number): { view: DataView; at: number } {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (view.getInt32(0, true) !== 3) throw new Error("patch the plain sample");
  const count = view.getInt32(8, true);
  for (let i = 0; i < count; i += 1) {
    const header = 12 + i * 268;
    let end = header + 8;
    while (end < header + 268 && bytes[end] !== 0) end += 1;
    const name = new TextDecoder("iso-8859-1").decode(bytes.subarray(header + 8, end));
    if (name !== "club.dat") continue;
    return { view, at: view.getUint32(header, true) + clubIndex * 581 };
  }
  throw new Error("club.dat missing");
}

function writeTail(
  buffer: ArrayBuffer,
  clubIndex: number,
  squad: number[],
  training: number[],
  tacticId: number,
) {
  const { view, at } = clubAt(buffer, clubIndex);
  for (let slot = 0; slot < 20; slot += 1) view.setInt32(at + 480 + slot * 4, squad[slot] ?? -1, true);
  for (let slot = 0; slot < 4; slot += 1) view.setInt32(at + 560 + slot * 4, training[slot] ?? -1, true);
  view.setInt32(at + 576, tacticId, true);
}

describe("match squad", () => {
  it("joins eleven slots and the bench, and skips an unknown id", () => {
    const buffer = buildSample(false);
    const before = parseSave(buffer, "sample-plain.sav");
    const home = before.players.filter((player) => player.clubId === 0);
    const away = before.players.find((player) => player.clubId === 1);
    assert.ok(home.length >= 13);
    assert.ok(away);
    const ade = home.find((player) => player.fullName === "Ade Okonkwo");
    assert.ok(ade, "loaned-in player stays on the club");

    const squad = Array.from({ length: 20 }, () => -1);
    for (let slot = 0; slot < 11; slot += 1) squad[slot] = home[slot]!.id;
    squad[0] = ade.id;
    squad[4] = 999_999;
    squad[11] = home[11]!.id;
    squad[12] = home[12]!.id;
    writeTail(buffer, 0, squad, [4, 5, -1, 6], 2);

    const save = parseSave(buffer, "sample-plain.sav");
    const club = save.clubs[0]!;
    assert.equal(club.tacticId, 2);
    assert.deepEqual(club.trainingTactics, [4, 5, -1, 6]);
    assert.equal(club.matchSquad[4], 999_999);
    assert.equal(save.tactics.length, 0);

    const lineup = matchLineup(save, club);
    assert.equal(lineup.tactic, null);
    assert.equal(lineup.pitch[0]?.player.fullName, "Ade Okonkwo");
    assert.equal(lineup.pitch[1]?.player.id, home[1]!.id);
    assert.equal(lineup.pitch[3]?.player.id, home[3]!.id);
    assert.equal(lineup.pitch[4], null);
    assert.equal(lineup.pitch[5]?.player.id, home[5]!.id);
    assert.deepEqual(
      lineup.bench.map((spot) => spot.player.id),
      [home[11]!.id, home[12]!.id],
    );
    assert.equal(
      lineup.list.some((spot) => spot.player.id === 999_999),
      false,
    );
  });

  it("leaves a player from another club off the pitch and the bench", () => {
    const buffer = buildSample(false);
    const before = parseSave(buffer, "sample-plain.sav");
    const home = before.players.filter((player) => player.clubId === 1);
    const outsider = before.players.find((player) => player.clubId === 0);
    assert.ok(home.length >= 3);
    assert.ok(outsider);
    const squad = Array.from({ length: 20 }, () => -1);
    squad[0] = home[0]!.id;
    squad[1] = outsider.id;
    squad[11] = home[1]!.id;
    writeTail(buffer, 1, squad, [-1, -1, -1, -1], -1);

    const save = parseSave(buffer, "sample-plain.sav");
    const lineup = matchLineup(save, save.clubs[1]!);
    assert.equal(lineup.pitch[0]?.player.id, home[0]!.id);
    assert.equal(lineup.pitch[1], null);
    assert.deepEqual(
      lineup.bench.map((spot) => spot.player.id),
      [home[1]!.id],
    );
    assert.equal(
      lineup.list.some((spot) => spot.player.id === outsider.id),
      false,
    );
  });

  it("reads an all-empty match squad", () => {
    const buffer = buildSample(false);
    const squad = Array.from({ length: 20 }, () => -1);
    writeTail(buffer, 2, squad, [-1, -1, -1, -1], -1);
    const save = parseSave(buffer, "sample-plain.sav");
    const club = save.clubs[2]!;
    assert.deepEqual(club.matchSquad, squad);
    assert.equal(club.tacticId, -1);
    const lineup = matchLineup(save, club);
    assert.equal(lineup.empty, true);
    assert.equal(lineup.tactic, null);
    assert.deepEqual(lineup.bench, []);
  });
});

const PICK_WORDS = [0x1, 0x84, 0x104, 0x404, 0x804, 0x90, 0x110, 0x410, 0x810, 0x140, 0x440];

function pickBlock(name: string, staffIds: number[], bench: number[]): Uint8Array {
  const stride = 19072;
  const block = new Uint8Array(stride);
  const view = new DataView(block.buffer);
  block.set(new TextEncoder().encode(name), 4);
  view.setInt32(18924, 65, true);
  view.setInt32(18928, 8, true);
  view.setInt32(18932, 1_395_233, true);
  const lineup = stride - 16 * 8;
  staffIds.forEach((id, slot) => {
    view.setInt32(lineup + slot * 8, id, true);
    view.setInt32(lineup + slot * 8 + 4, PICK_WORDS[slot] ?? 0, true);
  });
  bench.forEach((id, slot) => {
    view.setInt32(lineup + (11 + slot) * 8, id, true);
    view.setInt32(lineup + (11 + slot) * 8 + 4, -1, true);
  });
  return block;
}

describe("picked team", () => {
  it("reads the eleven and bench from a human manager record", () => {
    const save = parseSave(buildSample(false), "sample-plain.sav");
    const home = save.players.filter((player) => player.clubId === 0);
    assert.ok(home.length >= 13);
    const ids = home.slice(0, 11).map((player) => player.id);
    const bench = [home[11]!.id, home[12]!.id];
    const away = save.players.filter((player) => player.clubId === 1);
    assert.ok(away.length >= 11);
    const squadIds = new Set(ids.concat(bench));
    const pick = readHumanPick(pickBlock("4-3-3", ids, bench), squadIds);
    assert.equal(pick?.tacticName, "4-3-3");
    assert.deepEqual(pick?.pitch[1]?.slot, { row: 2, col: 0 });
    assert.equal(readHumanPick(pickBlock("4-4-2", away.slice(0, 11).map((player) => player.id), []), squadIds), null);
    const block = new Uint8Array(19072 * 2);
    block.set(pickBlock("4-3-3", ids, bench), 0);
    block.set(pickBlock("4-4-2", away.slice(0, 11).map((player) => player.id), []), 19072);
    save.humanManager = block;
    const lineup = matchLineup(save, save.clubs[0]!);
    assert.equal(lineup.empty, false);
    assert.equal(lineup.tactic?.name, "4-3-3");
    assert.equal(lineup.pitch[0]?.player.id, ids[0]);
    assert.equal(lineup.pitch[10]?.player.id, ids[10]);
    assert.deepEqual(
      lineup.bench.map((spot) => spot.player.id),
      bench,
    );
    const other = matchLineup(save, save.clubs[1]!);
    assert.equal(other.tactic?.name, "4-4-2");
    assert.equal(other.pitch[0]?.player.id, away[0]!.id);

    save.clubs[0]!.matchSquad = Array.from({ length: 20 }, () => -1);
    save.clubs[0]!.matchSquad[0] = home[3]!.id;
    const listed = matchLineup(save, save.clubs[0]!);
    assert.equal(listed.pitch[0]?.player.id, home[3]!.id);
    assert.equal(listed.list.length, 1);
    assert.equal(listed.tactic, null);
  });

  it("drops a pick that names an unknown id or another club", () => {
    const save = parseSave(buildSample(false), "sample-plain.sav");
    const home = save.players.filter((player) => player.clubId === 0);
    const away = save.players.find((player) => player.clubId === 1);
    assert.ok(home.length >= 11);
    assert.ok(away);
    const ids = home.slice(0, 11).map((player) => player.id);
    ids[4] = 999_999;
    save.humanManager = pickBlock("4-3-3", ids, []);
    assert.equal(readHumanPick(save.humanManager, new Set(home.slice(0, 11).map((player) => player.id))), null);
    assert.equal(matchLineup(save, save.clubs[0]!).empty, true);

    ids[4] = away.id;
    save.humanManager = pickBlock("4-3-3", ids, [away.id]);
    assert.equal(matchLineup(save, save.clubs[0]!).empty, true);
    assert.equal(matchLineup(save, save.clubs[1]!).empty, true);
  });
});
