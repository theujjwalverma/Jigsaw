import { beforeEach, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { GamePage } from "../../src/pages/GamePage";
import { api } from "../../src/services/api";
import { useImageAspectRatio } from "../../src/hooks/useImageAspectRatio";
import { findElement as find } from "../helpers/findElement";

const mocks = vi.hoisted(() => ({
  state: {}, setSelection: vi.fn(), setMoving: vi.fn(), setError: vi.fn(), navigate: vi.fn(),
}));
vi.mock("react", () => ({ useState: vi.fn(), useEffect: vi.fn() }));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ eventId: "event", roundNumber: "1" }), useNavigate: () => mocks.navigate,
}));
vi.mock("../../src/services/api", () => ({ api: { post: vi.fn() } }));
vi.mock("../../src/services/gameState", () => ({
  useGameStore: Object.assign(() => mocks.state, { getState: () => mocks.state }),
}));
vi.mock("../../src/hooks/useImageAspectRatio", () => ({
  useImageAspectRatio: vi.fn(),
}));
vi.mock("../../src/components/PuzzleBoard", () => ({ PuzzleBoard: "PuzzleBoard" }));
vi.mock("../../src/components/PieceTray", () => ({ PieceTray: "PieceTray" }));
vi.mock("../../src/components/GameHud", () => ({ GameHud: "GameHud" }));

beforeEach(() => {
  vi.clearAllMocks();
  setUiState();
  useImageAspectRatio.mockReturnValue({ imageAspectRatio: 2, imageError: "" });
  mocks.state = {
    eventId: "event", playerId: "player", currentRound: 1, eventStatus: "in_round",
    placements: { r0c1: "r0c0" }, placedPieceIds: ["r0c0"], completed: false,
    moves: 1, roundEndsAt: 50000, leaderboard: [], connectionError: "",
    puzzle: { grid: 2, imageUrl: "/test.png", pieces: [{ id: "r0c0" }, { id: "r0c1" }] },
    applyPlacement: vi.fn(),
  };
});

function setUiState({ selection = { round: 1, pieceId: "r0c0" }, isMoving = false, error = null } = {}) {
  useState.mockReset();
  useState.mockReturnValueOnce([selection, mocks.setSelection])
    .mockReturnValueOnce([isMoving, mocks.setMoving])
    .mockReturnValueOnce([error, mocks.setError]);
}

it("sends destination and round, applies server arrangements, and clears selection", async () => {
  const data = { placements: { r0c0: "r0c0" }, moves: 2, completed: false };
  api.post.mockResolvedValue({ data });
  const board = find(GamePage(), "PuzzleBoard");
  await board.props.onPlacePiece("r0c0", "r0c0");
  expect(api.post).toHaveBeenCalledWith("/events/event/place-piece", {
    playerId: "player", pieceId: "r0c0", cellId: "r0c0", roundNumber: 1,
  });
  expect(mocks.state.applyPlacement).toHaveBeenCalledWith(data);
  expect(mocks.setSelection).toHaveBeenCalledWith({ round: 1, pieceId: null });
  expect(mocks.setMoving.mock.calls).toEqual([[true], [false]]);
});

it("returns the selected piece using a null destination", async () => {
  api.post.mockResolvedValue({ data: { placements: {}, moves: 2, completed: false } });
  const page = GamePage();
  const button = find(page, "button");
  expect(button.props.disabled).toBe(false);
  await button.props.onClick();
  expect(api.post).toHaveBeenCalledWith("/events/event/place-piece", expect.objectContaining({ pieceId: "r0c0", cellId: null }));
});

it("reports rejected moves without removing the player's selected piece", async () => {
  api.post.mockRejectedValue({ response: { data: { error: "Round expired" } } });
  await find(GamePage(), "PuzzleBoard").props.onPlacePiece("r0c0", "r0c0");
  expect(mocks.setError).toHaveBeenCalledWith(expect.objectContaining({ message: "Round expired" }));
  expect(mocks.state.applyPlacement).not.toHaveBeenCalled();
  expect(mocks.setSelection).not.toHaveBeenCalled();
  expect(mocks.setMoving).toHaveBeenLastCalledWith(false);
});

it("does not apply an old response after the round changes", async () => {
  api.post.mockImplementation(async () => {
    mocks.state.currentRound = 2;
    return { data: { placements: {}, moves: 2, completed: false } };
  });
  await find(GamePage(), "PuzzleBoard").props.onPlacePiece("r0c0", "r0c0");
  expect(mocks.state.applyPlacement).not.toHaveBeenCalled();
});

it("locks controls only after actual correctness-based completion", async () => {
  mocks.state.completed = true;
  const page = GamePage();
  const board = find(page, "PuzzleBoard");
  expect(board.props.completed).toBe(true);
  await board.props.onPlacePiece("r0c0", null);
  expect(api.post).not.toHaveBeenCalled();
  expect(submitButton(page)).toBeUndefined();
});

function fillBoard() {
  mocks.state.placements = { r0c0: "r0c1", r0c1: "r0c0" };
  mocks.state.placedPieceIds = ["r0c1", "r0c0"];
}

function submitButton(page) {
  return find(page, (node) => node.props.className === "submit-round-button");
}

it("shows the Submit round CTA only after all pieces are on the board", () => {
  expect(submitButton(GamePage())).toBeUndefined();
  setUiState();
  fillBoard();
  const button = submitButton(GamePage());
  expect(button.props.children).toBe("Submit round");
  expect(button.props.disabled).toBe(false);
});

it("submits the current round and freezes the accepted arrangement", async () => {
  fillBoard();
  const data = { placements: mocks.state.placements, moves: 2, completed: true, wrongPieceCount: 0 };
  api.post.mockResolvedValue({ data });
  await submitButton(GamePage()).props.onClick();
  expect(api.post).toHaveBeenCalledWith("/events/event/submit-round", { playerId: "player", roundNumber: 1 });
  expect(mocks.state.applyPlacement).toHaveBeenCalledWith(data);
});

it("shows the wrong-piece count without marking the round complete", async () => {
  fillBoard();
  api.post.mockRejectedValue({ response: { data: {
    error: "2 pieces are wrongly placed. Rearrange them and submit again.", wrongPieceCount: 2,
  } } });
  await submitButton(GamePage()).props.onClick();
  expect(mocks.setError).toHaveBeenCalledWith(expect.objectContaining({
    message: "2 pieces are wrongly placed. Rearrange them and submit again.",
  }));
  expect(mocks.state.applyPlacement).not.toHaveBeenCalled();
  expect(mocks.setMoving).toHaveBeenLastCalledWith(false);
});

it("prevents simultaneous submissions and moves", async () => {
  fillBoard();
  setUiState({ isMoving: true });
  const button = submitButton(GamePage());
  expect(button.props.disabled).toBe(true);
  await button.props.onClick();
  expect(api.post).not.toHaveBeenCalled();
});

it("discards stale submission success and errors after changing rounds", async () => {
  fillBoard();
  api.post.mockImplementation(async () => {
    mocks.state.currentRound = 2;
    throw { response: { data: { error: "Old round error" } } };
  });
  await submitButton(GamePage()).props.onClick();
  expect(mocks.state.applyPlacement).not.toHaveBeenCalled();
  expect(mocks.setError).not.toHaveBeenCalled();
});

it.each([
  [{ playerId: null }, "/join/event"],
  [{ eventId: "another-event" }, "/join/event"],
  [{ eventStatus: "lobby" }, "/lobby/event"],
  [{ eventStatus: "between_rounds" }, "/leaderboard/event/1"],
  [{ eventStatus: "finished" }, "/leaderboard/event/1"],
  [{ leaderboard: [{ playerId: "player" }] }, "/leaderboard/event/1"],
  [{ eventStatus: "finished", currentRound: 0 }, "/leaderboard/event/1"],
  [{ currentRound: 2 }, "/game/event/2"],
])("routes recovered state %j to %s", (state, path) => {
  Object.assign(mocks.state, state);
  GamePage();
  useEffect.mock.calls[0][0]();
  expect(mocks.navigate.mock.calls[0][0]).toBe(path);
});

it("stays on the current game and clears previous-round selection", () => {
  setUiState({ selection: { round: 0, pieceId: "r0c0" } });
  const page = GamePage();
  useEffect.mock.calls[0][0]();
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(find(page, "PuzzleBoard").props.activePieceId).toBe(null);
  expect(find(page, "button").props.disabled).toBe(true);
  find(page, "PuzzleBoard").props.onPickPiece("r0c1");
  expect(mocks.setSelection).toHaveBeenCalledWith({ round: 1, pieceId: "r0c1" });
});

it("disables both surfaces while a move is pending", async () => {
  setUiState({ isMoving: true });
  const page = GamePage();
  expect(find(page, "PuzzleBoard").props.disabled).toBe(true);
  expect(find(page, "PieceTray").props.disabled).toBe(true);
  await find(page, "PuzzleBoard").props.onPlacePiece("r0c0", "r0c0");
  expect(api.post).not.toHaveBeenCalled();
});

it("wires dragging back to the playground to the same return request", async () => {
  api.post.mockResolvedValue({ data: { placements: {}, moves: 2, completed: false } });
  await find(GamePage(), "PieceTray").props.onReturnPiece("r0c0");
  expect(api.post).toHaveBeenCalledWith("/events/event/place-piece", expect.objectContaining({ cellId: null }));
});

it("shows a visible retry error for network failures", async () => {
  api.post.mockRejectedValue(new Error("offline"));
  await find(GamePage(), "PuzzleBoard").props.onPlacePiece("r0c0", "r0c0");
  expect(mocks.setError).toHaveBeenCalledWith(expect.objectContaining({ message: "Unable to place the piece. Please retry." }));
});

it.each([
  [{ puzzle: null, currentRound: 0 }, { imageAspectRatio: 2, imageError: "" }, "Loading puzzle from the game server..."],
  [{}, { imageAspectRatio: null, imageError: "" }, "Loading puzzle from the game server..."],
  [{}, { imageAspectRatio: null, imageError: "Unable to load image" }, "Unable to load image"],
  [{ connectionError: "Connection lost" }, { imageAspectRatio: 2, imageError: "" }, "Connection lost"],
])("renders loading and recovery errors without an empty board", (state, image, message) => {
  Object.assign(mocks.state, state);
  useImageAspectRatio.mockReturnValue(image);
  const page = GamePage();
  expect(find(page, (node) => node.props.children === message)).toBeDefined();
  if (!mocks.state.puzzle || !image.imageAspectRatio) expect(find(page, "PuzzleBoard")).toBeUndefined();
});
