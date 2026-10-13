const { createPuzzleConfig } = require("../../src/services/puzzle");

describe("createPuzzleConfig", () => {
  it("creates expected number of pieces", () => {
    const config = createPuzzleConfig({ imageUrl: "img", grid: 4 });
    expect(config.pieces).toHaveLength(16);
    expect(config.tolerancePx).toBe(10);
  });
});
