import { expect, it, vi } from "vitest";
import { PuzzleBoard } from "../../src/components/PuzzleBoard";

const pieces = ["r0c0", "r0c1"].map((id, col) => ({
  id, row: 0, col,
  edges: { top: "flat", right: "flat", bottom: "flat", left: "flat" },
}));
const puzzle = { grid: 2, imageUrl: "/image.png", pieces };

function boardProps(overrides = {}) {
  return {
    puzzle, placements: {}, activePieceId: null,
    onPlacePiece: vi.fn(), onPickPiece: vi.fn(), ...overrides,
  };
}

it("accepts drops in any cell without revealing the correct destination", () => {
  const props = boardProps({ activePieceId: "r0c0" });
  const board = PuzzleBoard(props);
  const cell = board.props.children[1];
  cell.props.onDrop({ preventDefault: vi.fn(), dataTransfer: { getData: () => "r0c0" } });
  expect(props.onPlacePiece).toHaveBeenCalledWith("r0c0", "r0c1");
  expect(board.props.children.every((child) => !child.props.className.includes("candidate"))).toBe(true);
});

it("renders the actual piece in a wrong cell and allows it to be moved or replaced", () => {
  const props = boardProps({ placements: { r0c1: "r0c0" }, activePieceId: "r0c1" });
  const occupied = PuzzleBoard(props).props.children[1];
  expect(occupied.props.children.props.piece).toBe(pieces[0]);
  expect(occupied.props.disabled).toBe(false);
  occupied.props.onClick();
  expect(props.onPlacePiece).toHaveBeenCalledWith("r0c1", "r0c1");
  const event = { dataTransfer: { setData: vi.fn() } };
  occupied.props.onDragStart(event);
  expect(event.dataTransfer.setData).toHaveBeenCalledWith("text/plain", "r0c0");
  expect(props.onPickPiece).toHaveBeenCalledWith("r0c0");
});

it("selects an occupied piece for return and places a selected piece in any empty cell", () => {
  const props = boardProps({ placements: { r0c1: "r0c0" } });
  const cell = PuzzleBoard(props).props.children[1];
  cell.props.onClick();
  expect(props.onPickPiece).toHaveBeenCalledWith("r0c0");
  const selected = boardProps({ activePieceId: "r0c0" });
  const empty = PuzzleBoard(selected).props.children[0];
  empty.props.onClick();
  expect(selected.onPlacePiece).toHaveBeenCalledWith("r0c0", "r0c0");
  const event = { preventDefault: vi.fn(), dataTransfer: { getData: () => "" } };
  empty.props.onDragOver(event);
  expect(event.dataTransfer.dropEffect).toBe("move");
  empty.props.onDrop(event);
  expect(selected.onPlacePiece).toHaveBeenCalledTimes(2);
});

it("ignores invalid drags, deselects an already selected board piece and freezes a solved board", () => {
  const props = boardProps({ placements: { r0c0: "r0c0" }, activePieceId: "r0c0" });
  const cell = PuzzleBoard(props).props.children[0];
  cell.props.onClick();
  expect(props.onPickPiece).toHaveBeenCalledWith(null);
  cell.props.onDrop({ preventDefault: vi.fn(), dataTransfer: { getData: () => "unknown" } });
  expect(props.onPlacePiece).not.toHaveBeenCalled();
  const frozen = boardProps({ completed: true });
  const frozenCell = PuzzleBoard(frozen).props.children[0];
  expect(frozenCell.props.disabled).toBe(true);
  frozenCell.props.onDrop({ preventDefault: vi.fn(), dataTransfer: { getData: () => "r0c0" } });
  expect(frozen.onPlacePiece).not.toHaveBeenCalled();
});

it("renders no board before the puzzle is loaded", () => {
  expect(PuzzleBoard({ puzzle: null })).toBeNull();
});
