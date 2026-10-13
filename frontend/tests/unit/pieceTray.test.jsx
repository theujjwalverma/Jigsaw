import { expect, it, vi } from "vitest";
import { PieceTray } from "../../src/components/PieceTray";

vi.mock("react", () => ({ useState: () => [["r0c1", "r0c0"]] }));

it("keeps the jumbled order, filters placements, and starts drags with the piece ID", () => {
  const puzzle = { grid: 2, imageUrl: "/test.png", pieces: [
    { id: "r0c0", row: 0, col: 0 }, { id: "r0c1", row: 0, col: 1 },
  ] };
  const onPickPiece = vi.fn();
  const tray = PieceTray({ puzzle, placedPieceIds: [], activePieceId: "r0c1", onPickPiece });
  expect(tray.props.children.map((piece) => piece.key)).toEqual(["r0c1", "r0c0"]);
  const event = { dataTransfer: { setData: vi.fn() } };
  tray.props.children[0].props.onDragStart(event);
  expect(event.dataTransfer.effectAllowed).toBe("move");
  expect(event.dataTransfer.setData).toHaveBeenCalledWith("text/plain", "r0c1");
  expect(onPickPiece).toHaveBeenCalledWith("r0c1");
  tray.props.children[1].props.onClick();
  expect(onPickPiece).toHaveBeenLastCalledWith("r0c0");
  const remaining = PieceTray({ puzzle, placedPieceIds: ["r0c1"], onPickPiece });
  expect(remaining.props.children.map((piece) => piece.key)).toEqual(["r0c0"]);
});

it("returns a dragged or selected board piece to the playground without exposing target coordinates", () => {
  const onReturnPiece = vi.fn();
  const puzzle = { grid: 2, imageUrl: "/test.png", pieces: [
    { id: "r0c0", row: 0, col: 0 }, { id: "r0c1", row: 0, col: 1 },
  ] };
  const tray = PieceTray({ puzzle, placedPieceIds: ["r0c0"], activePieceId: "r0c0", onReturnPiece });
  tray.props.onDrop({ preventDefault: vi.fn(), dataTransfer: { getData: () => "r0c0" } });
  expect(onReturnPiece).toHaveBeenCalledWith("r0c0");
  onReturnPiece.mockClear();
  tray.props.onDrop({ preventDefault: vi.fn(), dataTransfer: { getData: () => "r0c1" } });
  expect(onReturnPiece).not.toHaveBeenCalled();
  expect(tray.props.children[0].props["aria-label"]).toBe("Puzzle piece 1");
});
