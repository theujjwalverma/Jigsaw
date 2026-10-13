import { PieceImage } from "./PieceImage";

export function PuzzleBoard({
  puzzle, imageAspectRatio = 1, placements, activePieceId = null, onPlacePiece, onPickPiece,
  completed = false, disabled = false,
}) {
  if (!puzzle) return null;

  const boardPixelSize = 480;
  const piecesById = new Map(puzzle.pieces.map((piece) => [piece.id, piece]));
  const isFrozen = completed || disabled;

  const handleDrop = (event, cellId) => {
    event.preventDefault();
    const pieceId = event.dataTransfer.getData("text/plain") || activePieceId;
    if (!isFrozen && piecesById.has(pieceId)) {
      onPlacePiece(pieceId, cellId);
    }
  };

  return (
    <div
      className="board"
      style={{
        width: boardPixelSize * Math.min(1, imageAspectRatio),
        maxWidth: "100%",
        aspectRatio: imageAspectRatio,
        gridTemplateColumns: `repeat(${puzzle.grid}, 1fr)`,
        gridTemplateRows: `repeat(${puzzle.grid}, 1fr)`,
      }}
    >
      {puzzle.pieces.map((cell, index) => {
        const occupant = piecesById.get(placements[cell.id]);
        return (
          <button
            type="button"
            key={cell.id}
            aria-label={`Board cell ${index + 1}${occupant ? ", occupied" : ", empty"}`}
            disabled={isFrozen}
            draggable={Boolean(occupant) && !isFrozen}
            onDragStart={(event) => {
              if (!occupant || isFrozen) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", occupant.id);
              onPickPiece(occupant.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => handleDrop(event, cell.id)}
            onClick={() => {
              if (isFrozen) return;
              if (occupant?.id === activePieceId) onPickPiece(null);
              else if (activePieceId) onPlacePiece(activePieceId, cell.id);
              else if (occupant) onPickPiece(occupant.id);
            }}
            className={`board-cell ${occupant ? "placed" : ""} ${occupant && activePieceId === occupant.id ? "selected" : ""}`}
          >{occupant ? <PieceImage puzzle={puzzle} piece={occupant} /> : null}</button>
        );
      })}
    </div>
  );
}
