const { rankRoundResults } = require("../../src/services/scoring");

describe("rankRoundResults", () => {
  it("ranks completed players above incomplete players", () => {
    const rows = rankRoundResults([
      { playerId: "a", completed: false, moves: 2, timeMs: 1000 },
      { playerId: "b", completed: true, moves: 50, timeMs: 90000 },
      { playerId: "c", completed: true, moves: 30, timeMs: 80000 },
    ]);

    expect(rows[0].playerId).toBe("c");
    expect(rows[1].playerId).toBe("b");
    expect(rows[2].playerId).toBe("a");
  });
});
