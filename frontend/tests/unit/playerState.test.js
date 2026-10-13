import { beforeEach, expect, it, vi } from "vitest";
import { useGameStore } from "../../src/services/gameState";
import { restorePlayerState } from "../../src/services/playerState";
import { api } from "../../src/services/api";

vi.mock("../../src/services/api", () => ({ api: { get: vi.fn() } }));

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState(), true);
  vi.clearAllMocks();
});

it("restores puzzle, deadline and placed pieces from the server", async () => {
  useGameStore.getState().setSession({ eventId: "event", playerId: "player", playerName: "Alice" });
  const puzzle = { imageUrl: "data:image/png;base64,test", grid: 2, pieces: [{ id: "r0c0" }] };
  api.get.mockResolvedValue({ data: {
    status: "in_round", currentRound: 1, roundEndsAt: 100000, puzzle,
    placements: { r0c0: "r0c0" }, completed: false, moves: 1, leaderboard: [], finalLeaderboard: [],
  } });
  await restorePlayerState("event", "player");
  expect(api.get).toHaveBeenCalledWith("/events/event/state/player");
  expect(useGameStore.getState()).toMatchObject({
    eventStatus: "in_round", currentRound: 1, roundEndsAt: 100000, puzzle,
    placedPieceIds: ["r0c0"], moves: 1,
    placements: { r0c0: "r0c0" }, completed: false,
  });
});

it("ignores stale responses after changing player sessions", async () => {
  useGameStore.getState().setSession({ eventId: "new", playerId: "new-player" });
  api.get.mockResolvedValue({ data: { currentRound: 5 } });
  await restorePlayerState("old", "old-player");
  expect(useGameStore.getState().currentRound).toBe(0);
});

it("reports failed restoration instead of showing an empty puzzle", async () => {
  useGameStore.getState().setSession({ eventId: "event", playerId: "player" });
  api.get.mockRejectedValue({ response: { data: { error: "Player not found" } } });
  await restorePlayerState("event", "player");
  expect(useGameStore.getState().connectionError).toBe("Player not found");
});

it("ignores errors from an old session and reports network failures for the current one", async () => {
  useGameStore.getState().setSession({ eventId: "event", playerId: "player" });
  api.get.mockRejectedValue(new Error("Network error"));
  await restorePlayerState("old", "old-player");
  expect(useGameStore.getState().connectionError).toBe("");
  await restorePlayerState("event", "player");
  expect(useGameStore.getState().connectionError).toContain("Check your connection");
});
