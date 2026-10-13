import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PieceTray } from "../../src/components/PieceTray";
import { PuzzleBoard } from "../../src/components/PuzzleBoard";
import { PieceImage } from "../../src/components/PieceImage";
import { piecePath } from "../../src/utils/pieceImage";

const pieces = [
  { id: "r0c0", row: 0, col: 0, edges: { top: "flat", right: null, bottom: null, left: "flat" } },
  { id: "r1c1", row: 1, col: 1, edges: { top: null, right: "flat", bottom: "flat", left: null } },
];
const puzzle = { grid: 2, boardSize: 800, imageUrl: "/test.png", pieces };

it("renders image crops in the tray and excludes placed pieces", () => {
  const html = renderToStaticMarkup(
    <PieceTray puzzle={puzzle} placedPieceIds={["r0c0"]} onPickPiece={() => {}} />,
  );
  expect(html).toContain('href="/test.png"');
  expect(html).toContain('width="200" height="200"');
  expect(html).toContain('x="-100" y="-100"');
  expect(html).toContain("<clipPath");
  expect(html).toContain(piecePath(puzzle, pieces[1]));
  expect(html).not.toContain('aria-label="Piece r0c0"');
  expect(html).not.toContain("piece-label");
  expect(html).not.toMatch(/>\d+,\d+</);
});

it("renders placed images in full-sized board cells", () => {
  const html = renderToStaticMarkup(
    <PuzzleBoard puzzle={puzzle} placements={{ r0c0: "r0c0" }} onPlacePiece={() => {}} />,
  );
  expect(html).toContain("/test.png");
  expect(html).toContain('aria-label="Board cell 1, occupied"');
  expect(html).not.toContain("width:50%");
  expect(html).not.toMatch(/>\d+,\d+</);
});

it("positions the top-left image and handles a single-piece image", () => {
  const html = renderToStaticMarkup(<PieceImage puzzle={{ ...puzzle, grid: 1 }} piece={pieces[0]} />);
  expect(html).toContain('x="0" y="0" width="100" height="100"');
  expect(html).toContain('viewBox="-20 -20 140 140"');
  expect(html).toContain('preserveAspectRatio="none"');
});

it.each([
  [2, 480, 140, 70],
  [0.5, 240, 70, 140],
  [1, 480, 140, 140],
])("preserves image proportions %s on both the board and tray", (imageAspectRatio, boardWidth, pieceWidth, pieceHeight) => {
  const board = renderToStaticMarkup(
    <PuzzleBoard puzzle={puzzle} imageAspectRatio={imageAspectRatio} placements={{}} />,
  );
  const tray = renderToStaticMarkup(
    <PieceTray puzzle={puzzle} imageAspectRatio={imageAspectRatio} placedPieceIds={[]} />,
  );
  expect(board).toContain(`aspect-ratio:${imageAspectRatio}`);
  expect(board).toContain(`width:${boardWidth}px`);
  expect(tray).toContain(`width:${pieceWidth}px`);
  expect(tray).toContain(`height:${pieceHeight}px`);
});

it("uses the same silhouette and source crop in the tray and a wrong board cell", () => {
  const board = renderToStaticMarkup(
    <PuzzleBoard puzzle={puzzle} placements={{ r1c1: "r0c0" }} />,
  );
  const tray = renderToStaticMarkup(<PieceTray puzzle={puzzle} placedPieceIds={["r1c1"]} />);
  for (const html of [board, tray]) {
    expect(html).toContain(piecePath(puzzle, pieces[0]));
    expect(html).toContain('x="0" y="0" width="200" height="200"');
  }
});

it("assigns unique clipping IDs to each image", () => {
  const html = renderToStaticMarkup(<PieceTray puzzle={puzzle} placedPieceIds={[]} />);
  const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(2);
  for (const id of ids) expect(html).toContain(`clip-path="url(#${id})"`);
});
