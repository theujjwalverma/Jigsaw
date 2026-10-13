import { useId } from "react";
import { piecePath } from "../utils/pieceImage";

export function PieceImage({ puzzle, piece }) {
  const clipId = `piece-${useId()}`;
  const path = piecePath(puzzle, piece);
  return (
    <svg className="piece-image" viewBox="-20 -20 140 140" preserveAspectRatio="none"
      aria-hidden="true" focusable="false">
      <defs><clipPath id={clipId}><path d={path} /></clipPath></defs>
      <image href={puzzle.imageUrl} x={-piece.col * 100} y={-piece.row * 100}
        width={puzzle.grid * 100} height={puzzle.grid * 100}
        preserveAspectRatio="none" clipPath={`url(#${clipId})`} />
      <path className="piece-outline" d={path} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
