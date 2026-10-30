import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayAttr, intrinsicForDisplay } from "./attr-display.ts";

describe("CA-dependent attribute display", () => {
  it("decodes Balelo-style intrinsics for CA 85 like CM Scout", () => {
    const ca = 85;
    assert.equal(displayAttr("finishing", 27, ca), 18);
    assert.equal(displayAttr("penalties", 37, ca), 20);
    assert.equal(displayAttr("crossing", -39, ca), 4);
    assert.equal(displayAttr("dribbling", -39, ca), 4);
    assert.equal(displayAttr("anticipation", -19, ca), 9);
    assert.equal(displayAttr("pace", 14, ca), 14);
  });

  it("round-trips sample display values through intrinsic encoding", () => {
    const ca = 150;
    for (const shown of [8, 12, 18]) {
      const intrinsic = intrinsicForDisplay("finishing", shown, ca);
      assert.equal(displayAttr("finishing", intrinsic, ca), shown);
    }
  });
});
