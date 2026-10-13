function edgeShape(row, col, side, grid) {
  if (side === "top") return row === 0 ? "flat" : null;
  if (side === "left") return col === 0 ? "flat" : null;
  if (side === "bottom") return row === grid - 1 ? "flat" : null;
  if (side === "right") return col === grid - 1 ? "flat" : null;
  return "flat";
}

function createPuzzleConfig({ imageUrl, grid }) {
  const boardSize = 800;
  const pieceSize = boardSize / grid;
  const pieces = [];

  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const id = `r${row}c${col}`;
      pieces.push({
        id,
        row,
        col,
        width: pieceSize,
        height: pieceSize,
        targetX: col * pieceSize,
        targetY: row * pieceSize,
        // Edge metadata allows the client to render interlocking hints.
        edges: {
          top: edgeShape(row, col, "top", grid),
          right: edgeShape(row, col, "right", grid),
          bottom: edgeShape(row, col, "bottom", grid),
          left: edgeShape(row, col, "left", grid),
        },
      });
    }
  }

  return {
    imageUrl,
    boardSize,
    grid,
    tolerancePx: 10,
    pieces,
  };
}

module.exports = {
  createPuzzleConfig,
};
