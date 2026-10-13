import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { useGameSocket } from "../../src/hooks/useGameSocket";
import { useGameStore } from "../../src/services/gameState";
import { socket } from "../../src/services/socket";
import { restorePlayerState } from "../../src/services/playerState";

vi.mock("react", () => ({ useEffect: vi.fn() }));
vi.mock("../../src/services/socket", () => ({ socket: {
  connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn(), connect: vi.fn(),
} }));
vi.mock("../../src/services/playerState", () => ({ restorePlayerState: vi.fn() }));
vi.mock("../../src/services/gameState", () => {
  const state = {
    eventId: "event", playerId: "player", setRound: vi.fn(),
    setLeaderboard: vi.fn(), setFinalLeaderboard: vi.fn(), setConnectionError: vi.fn(),
  };
  return { useGameStore: Object.assign(vi.fn(() => state), { getState: () => state }) };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  socket.connected = false;
});
afterEach(() => vi.useRealTimers());

it("rejoins on every connect and restores round state on polling and reconnection", () => {
  useGameSocket();
  const cleanup = useEffect.mock.calls[0][0]();
  const handler = (event) => socket.on.mock.calls.find(([name]) => name === event)[1];
  expect(socket.connect).toHaveBeenCalled();
  handler("connect")();
  handler("connect")();
  expect(socket.emit).toHaveBeenCalledTimes(2);
  expect(socket.emit).toHaveBeenCalledWith("game:join", { eventId: "event", playerId: "player" });
  handler("game:player-reconnected")({ playerId: "player" });
  handler("game:player-reconnected")({ playerId: "another-player" });
  vi.advanceTimersByTime(2000);
  expect(restorePlayerState).toHaveBeenCalledTimes(5);
  cleanup();
  expect(socket.off).toHaveBeenCalledWith("connect", expect.any(Function));
  vi.advanceTimersByTime(2000);
  expect(restorePlayerState).toHaveBeenCalledTimes(5);
});

it("handles round starts, results, and explicit connection errors", () => {
  socket.connected = true;
  useGameSocket();
  const cleanup = useEffect.mock.calls[0][0]();
  const handler = (event) => socket.on.mock.calls.find(([name]) => name === event)[1];
  const state = useGameStore.getState();
  handler("game:round-start")({ round: 2, roundEndsAt: 50000, puzzle: { pieces: [] } });
  expect(state.setRound).toHaveBeenCalledWith({ currentRound: 2, roundEndsAt: 50000, puzzle: { pieces: [] } });
  handler("game:round-end")({ round: 2, leaderboard: [{ name: "Alice" }] });
  handler("game:tournament-end")([{ name: "Alice" }]);
  handler("game:error")({ message: "Unable to rejoin" });
  expect(state.setLeaderboard).toHaveBeenCalledWith({ round: 2, leaderboard: [{ name: "Alice" }] });
  expect(state.setFinalLeaderboard).toHaveBeenCalledWith([{ name: "Alice" }]);
  expect(state.setConnectionError).toHaveBeenCalledWith("Unable to rejoin");
  handler("game:round-end")({});
  handler("game:tournament-end")(undefined);
  expect(state.setLeaderboard).toHaveBeenLastCalledWith({ round: 0, leaderboard: [] });
  expect(state.setFinalLeaderboard).toHaveBeenLastCalledWith([]);
  cleanup();
});

it("does not connect without a player session", () => {
  useGameStore.mockReturnValueOnce({ ...useGameStore.getState(), eventId: null });
  useGameSocket();
  expect(useEffect.mock.calls[0][0]()).toBeUndefined();
  expect(socket.connect).not.toHaveBeenCalled();
});
