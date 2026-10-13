function getPlacements(state) {
  if (state.placements) return state.placements;
  const validIds = new Set(state.puzzleSnapshot.pieces.map((piece) => piece.id));
  return Object.fromEntries(
    (state.placedPieceIds || []).filter((id) => validIds.has(id)).map((id) => [id, id]),
  );
}

function movePiece(pieces, placements, pieceId, cellId) {
  const ids = new Set(pieces.map((piece) => piece.id));
  const previousCell = Object.keys(placements).find((cell) => placements[cell] === pieceId);
  if (!ids.has(pieceId) || (cellId !== null && !ids.has(cellId)) || (cellId === null && !previousCell)) {
    const error = new Error("Invalid puzzle piece or board cell.");
    error.statusCode = 400;
    throw error;
  }
  const next = { ...placements };
  if (previousCell) delete next[previousCell];
  if (cellId !== null) next[cellId] = pieceId;
  return {
    placements: next,
    changed: previousCell !== cellId,
  };
}

function countWrongPieces(pieces, placements) {
  return pieces.filter((piece) => placements[piece.id] !== piece.id).length;
}

module.exports = { getPlacements, movePiece, countWrongPieces };
