import { expect, it } from "vitest";
import { shufflePieces } from "../../src/utils/shufflePieces";

it("jumbles all pieces without mutating or losing any pieces", () => {
  const pieces = ["a", "b", "c", "d"];
  const shuffled = shufflePieces(pieces, () => 0);
  expect(shuffled).not.toEqual(pieces);
  expect([...shuffled].sort()).toEqual(pieces);
  expect(pieces).toEqual(["a", "b", "c", "d"]);
});

it("avoids an unchanged order even when random swaps select the same positions", () => {
  expect(shufflePieces(["a", "b", "c"], () => 0.999)).not.toEqual(["a", "b", "c"]);
});

it("handles empty trays and a single piece", () => {
  expect(shufflePieces([], () => 0)).toEqual([]);
  expect(shufflePieces(["a"], () => 0)).toEqual(["a"]);
});
