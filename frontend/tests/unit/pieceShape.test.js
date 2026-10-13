import { expect, it } from "vitest";
import { pieceEdges, piecePath } from "../../src/utils/pieceImage";

it.each([1, 2, 3, 4, 5, 6])("creates complementary internal edges and flat borders for grid %s", (grid) => {
  const opposite = { tab: "socket", socket: "tab" };
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const edges = pieceEdges({ grid }, { row, col });
      if (row === 0) expect(edges.top).toBe("flat");
      else expect(edges.top).toBe(opposite[pieceEdges({ grid }, { row: row - 1, col }).bottom]);
      if (col === 0) expect(edges.left).toBe("flat");
      else expect(edges.left).toBe(opposite[pieceEdges({ grid }, { row, col: col - 1 }).right]);
      if (row === grid - 1) expect(edges.bottom).toBe("flat");
      if (col === grid - 1) expect(edges.right).toBe("flat");
    }
  }
});

it("uses existing edge metadata and fills legacy null or missing edges consistently", () => {
  const puzzle = { grid: 3 };
  const piece = { row: 1, col: 1 };
  expect(pieceEdges(puzzle, { ...piece, edges: { right: null } })).toEqual(pieceEdges(puzzle, piece));
  expect(pieceEdges(puzzle, { ...piece, edges: { top: "socket", right: "tab" } }))
    .toMatchObject({ top: "socket", right: "tab" });
});

it("creates a closed square for a single piece and curved outlines for internal edges", () => {
  expect(piecePath({ grid: 1 }, { row: 0, col: 0 })).toBe("M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z");
  const path = piecePath({ grid: 3 }, { row: 1, col: 1 });
  expect(path).toMatch(/^M 0 0 /);
  expect(path).toMatch(/ Z$/);
  expect(path.match(/ C /g)).toHaveLength(24);
  expect(path).toContain("118");
  expect(path).not.toMatch(/NaN|undefined/);
});
