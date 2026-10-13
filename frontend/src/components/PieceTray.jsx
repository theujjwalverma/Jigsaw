import { PieceImage } from "./PieceImage";
import { useState } from "react";
import { shufflePieces } from "../utils/shufflePieces";

export function PieceTray({
  puzzle, imageAspectRatio = 1, placedPieceIds, onPickPiece, activePieceId,
  onReturnPiece, disabled = false,
}) {
  const [pieceOrder] = useState(() => shufflePieces(puzzle.pieces.map((piece) => piece.id)));
  const piecesById = new Map(puzzle.pieces.map((piece) => [piece.id, piece]));
  return (
    <div className="piece-tray" role="group" aria-label="Piece playground"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const pieceId = event.dataTransfer.getData("text/plain") || activePieceId;
        if (!disabled && placedPieceIds.includes(pieceId)) onReturnPiece(pieceId);
      }}>
      {pieceOrder.map((id) => piecesById.get(id))
        .filter((piece) => !placedPieceIds.includes(piece.id))
        .map((piece) => (
          <button
            type="button"
            key={piece.id}
            className={`piece ${activePieceId === piece.id ? "active-piece" : ""}`}
            aria-label={`Puzzle piece ${pieceOrder.indexOf(piece.id) + 1}`}
            style={{
              width: 140 * Math.min(1, imageAspectRatio),
              height: 140 / Math.max(1, imageAspectRatio),
            }}
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", piece.id);
              onPickPiece(piece.id);
            }}
            onClick={() => {
              onPickPiece(piece.id);
            }}
          ><PieceImage puzzle={puzzle} piece={piece} /></button>
        ))}
    </div>
  );
}
