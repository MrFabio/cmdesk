import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { keptHumanClub, readKeptClub, useDesk } from "./store.ts";
import type { ParsedSave } from "./types.ts";

function career(humanClubId: number, clubs: [number, string][]): ParsedSave {
  return {
    humanClubId,
    clubs: clubs.map(([id, name]) => ({ id, name, short: name })),
  } as ParsedSave;
}

describe("kept human club", () => {
  it("keeps the picked club when the next file still has it", () => {
    const previous = career(4, [
      [1, "Fafe"],
      [4, "USC Paredes"],
    ]);
    const next = career(1, [
      [1, "Fafe"],
      [4, "USC Paredes"],
    ]);
    assert.equal(keptHumanClub(previous, next), 4);
  });

  it("drops the pick when that id is a different club", () => {
    const previous = career(4, [[4, "USC Paredes"]]);
    const next = career(0, [[4, "Northbridge"]]);
    assert.equal(keptHumanClub(previous, next), null);
  });

  it("drops the pick when the club is absent", () => {
    const previous = career(4, [[4, "USC Paredes"]]);
    const next = career(0, [[0, "Northbridge"]]);
    assert.equal(keptHumanClub(previous, next), null);
  });
});

describe("open save over an open career", () => {
  it("lands on the picked club instead of the new file's human club", () => {
    const first = career(1, [
      [1, "Fafe"],
      [4, "USC Paredes"],
    ]);
    useDesk.getState().openSave(first);
    useDesk.getState().setHumanClub(4);

    const later = career(1, [
      [1, "Fafe"],
      [4, "USC Paredes"],
    ]);
    useDesk.getState().openSave(later);

    const state = useDesk.getState();
    assert.equal(state.save?.humanClubId, 4);
    assert.deepEqual(state.place, { kind: "club", clubId: 4 });
  });

  it("uses the new file's club when the pick is not in that file", () => {
    useDesk.getState().openSave(career(4, [[4, "USC Paredes"]]));
    useDesk.getState().openSave(career(0, [[0, "Northbridge"]]));

    const state = useDesk.getState();
    assert.equal(state.save?.humanClubId, 0);
    assert.deepEqual(state.place, { kind: "club", clubId: 0 });
  });
});

describe("default club across a refresh", () => {
  before(() => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
          data.set(key, value);
        },
        removeItem: (key: string) => {
          data.delete(key);
        },
      },
    });
  });

  it("keeps the picked club after the career is gone", () => {
    useDesk.getState().openSave(
      career(1, [
        [1, "Fafe"],
        [4, "USC Paredes"],
      ]),
    );
    useDesk.getState().setHumanClub(4);
    assert.deepEqual(readKeptClub(), { id: 4, name: "USC Paredes" });

    useDesk.setState({ save: null });
    useDesk.getState().openSave(
      career(1, [
        [1, "Fafe"],
        [4, "USC Paredes"],
      ]),
    );

    const state = useDesk.getState();
    assert.equal(state.save?.humanClubId, 4);
    assert.deepEqual(state.place, { kind: "club", clubId: 4 });
  });

  it("leaves the stored club in place when a file does not contain it", () => {
    useDesk.setState({ save: null });
    useDesk.getState().openSave(career(0, [[0, "Northbridge"]]));
    assert.equal(useDesk.getState().save?.humanClubId, 0);
    assert.deepEqual(readKeptClub(), { id: 4, name: "USC Paredes" });

    useDesk.setState({ save: null });
    useDesk.getState().openSave(
      career(1, [
        [1, "Fafe"],
        [4, "USC Paredes"],
      ]),
    );
    assert.equal(useDesk.getState().save?.humanClubId, 4);
  });
});
