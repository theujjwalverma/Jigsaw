const { getPlacements, movePiece, countWrongPieces } = require("../../src/services/placements");
const pieces = ["r0c0", "r0c1", "r1c0", "r1c1"].map((id) => ({ id }));

describe("free puzzle placement", () => {
  it("accepts wrong positions without completing the puzzle", () => {
    const result = movePiece(pieces, {}, "r0c0", "r0c1");
    expect(result).toEqual({ placements: { r0c1: "r0c0" }, changed: true });
  });

  it("moves a piece and sends a displaced piece back to the playground", () => {
    const previous = { r0c0: "r0c1", r1c0: "r0c0" };
    const result = movePiece(pieces, previous, "r0c0", "r0c0");
    expect(result.placements).toEqual({ r0c0: "r0c0" });
    expect(previous).toEqual({ r0c0: "r0c1", r1c0: "r0c0" });
  });

  it("returns a piece to the playground and permits it to be placed again", () => {
    const result = movePiece(pieces, { r0c1: "r0c0" }, "r0c0", null);
    expect(result.placements).toEqual({});
    expect(result.changed).toBe(true);
    expect(movePiece(pieces, result.placements, "r0c0", "r1c1").placements).toEqual({ r1c1: "r0c0" });
  });

  it("counts misplaced pieces without exposing their locations", () => {
    const wrong = { r0c0: "r0c1", r0c1: "r0c0", r1c0: "r1c0" };
    expect(countWrongPieces(pieces, movePiece(pieces, wrong, "r1c1", "r1c1").placements)).toBe(2);
    const correct = { r0c0: "r0c0", r0c1: "r0c1", r1c0: "r1c0" };
    expect(countWrongPieces(pieces, movePiece(pieces, correct, "r1c1", "r1c1").placements)).toBe(0);
    expect(countWrongPieces(pieces, {})).toBe(4);
  });

  it("treats duplicate placements as no-ops", () => {
    expect(movePiece(pieces, { r0c0: "r0c0" }, "r0c0", "r0c0").changed).toBe(false);
  });

  it.each([["invalid", "r0c0"], ["r0c0", "invalid"], ["r0c0", undefined], ["r0c0", null]])(
    "rejects invalid IDs and returning a piece that is not on the board",
    (pieceId, cellId) => {
      expect(() => movePiece(pieces, {}, pieceId, cellId)).toThrow();
    },
  );

  it("restores old correctly snapped placements and retains new wrong arrangements", () => {
    expect(getPlacements({ placedPieceIds: ["r0c0", "unknown"], puzzleSnapshot: { pieces } }))
      .toEqual({ r0c0: "r0c0" });
    expect(getPlacements({ placements: { r0c1: "r0c0" } })).toEqual({ r0c1: "r0c0" });
    expect(getPlacements({ puzzleSnapshot: { pieces } })).toEqual({});
  });
});
