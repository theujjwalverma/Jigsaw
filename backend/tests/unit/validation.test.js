const { parseOrThrow, joinSchema } = require("../../src/utils/validators");

describe("validators", () => {
  it("accepts valid player names", () => {
    const data = parseOrThrow(joinSchema, { name: "Player 01" });
    expect(data.name).toBe("Player 01");
  });

  it("rejects invalid names", () => {
    expect(() => parseOrThrow(joinSchema, { name: "@@@" })).toThrow();
  });
});
