import { PieceImage } from "./PieceImage";

export function MiniBoard({ puzzle, imageAspectRatio = 1, placements = {}, completed = false }) {
  if (!puzzle) {
    return (
      <div className="mini-board-placeholder">
        <span>Waiting for puzzle...</span>
      </div>
    );
  }

  const piecesById = new Map(puzzle.pieces.map((piece) => [piece.id, piece]));

  return (
    <div className={`mini-board-wrapper ${completed ? "is-completed" : ""}`}>
      <div
        className="mini-board"
        style={{
          aspectRatio: imageAspectRatio,
          gridTemplateColumns: `repeat(${puzzle.grid}, 1fr)`,
          gridTemplateRows: `repeat(${puzzle.grid}, 1fr)`,
        }}
      >
        {puzzle.pieces.map((cell) => {
          const occupant = piecesById.get(placements[cell.id]);
          return (
            <div
              key={cell.id}
              className={`mini-cell ${occupant ? "occupied" : "empty"}`}
            >
              {occupant ? <PieceImage puzzle={puzzle} piece={occupant} /> : null}
            </div>
          );
        })}
      </div>
      {completed ? (
        <div className="mini-board-completed-overlay">
          <span className="completed-check" aria-hidden="true">✓</span>
          <strong>Solved!</strong>
        </div>
      ) : null}
    </div>
  );
}
