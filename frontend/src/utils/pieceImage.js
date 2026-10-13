export function pieceEdges(puzzle, piece) {
  const { row, col } = piece;
  const even = (row + col) % 2 === 0;
  return {
    top: row === 0 ? "flat" : piece.edges?.top ?? (even ? "socket" : "tab"),
    right: col === puzzle.grid - 1 ? "flat" : piece.edges?.right ?? (even ? "tab" : "socket"),
    bottom: row === puzzle.grid - 1 ? "flat" : piece.edges?.bottom ?? (even ? "socket" : "tab"),
    left: col === 0 ? "flat" : piece.edges?.left ?? (even ? "tab" : "socket"),
  };
}

export function piecePath(puzzle, piece) {
  const edges = pieceEdges(puzzle, piece);
  const sides = [
    ["top", 0, 0, 1, 0],
    ["right", 100, 0, 0, 1],
    ["bottom", 100, 100, -1, 0],
    ["left", 0, 100, 0, -1],
  ];
  const path = ["M 0 0"];
  for (const [side, x, y, dx, dy] of sides) {
    const sign = edges[side] === "tab" ? 1 : -1;
    const point = (along, out) => `${x + dx * along + dy * out * sign} ${y + dy * along - dx * out * sign}`;
    if (edges[side] !== "flat") {
      path.push(
        `L ${point(35, 0)}`,
        `C ${point(42, 0)} ${point(43, 0)} ${point(43, 3)}`,
        `C ${point(43, 5)} ${point(36, 4)} ${point(36, 10)}`,
        `C ${point(36, 16)} ${point(42, 18)} ${point(50, 18)}`,
        `C ${point(58, 18)} ${point(64, 16)} ${point(64, 10)}`,
        `C ${point(64, 4)} ${point(57, 5)} ${point(57, 3)}`,
        `C ${point(57, 0)} ${point(58, 0)} ${point(65, 0)}`,
      );
    }
    path.push(`L ${point(100, 0)}`);
  }
  return `${path.join(" ")} Z`;
}
