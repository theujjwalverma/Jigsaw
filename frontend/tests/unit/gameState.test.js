import { beforeEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => {
  const values = new Map();
  const fake = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
  vi.stubGlobal("localStorage", fake);
  vi.stubGlobal("window", { localStorage: fake });
  return fake;
});

import { useGameStore } from "../../src/services/gameState";

beforeEach(() => {
  storage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

it("persists only player identity, never stale puzzle or countdown state", () => {
  const state = useGameStore.getState();
  state.setSession({ eventId: "event", playerId: "player", playerName: "Alice" });
  state.setRound({ currentRound: 1, roundEndsAt: 50000, puzzle: { pieces: [] } });
  state.applyPlacement({ placements: { r0c1: "r0c0" }, moves: 1, completed: false });
  expect(JSON.parse(storage.getItem("jigsaw-player-session")).state).toEqual({
    eventId: "event", playerId: "player", playerName: "Alice",
  });
});

it("rehydrates the saved player session after a fresh page load", async () => {
  storage.setItem("jigsaw-player-session", JSON.stringify({
    version: 0, state: { eventId: "event", playerId: "player", playerName: "Alice" },
  }));
  await useGameStore.persist.rehydrate();
  expect(useGameStore.getState()).toMatchObject({ eventId: "event", playerId: "player", puzzle: null });
});

it("clears previous event progress when a different player joins", () => {
  const state = useGameStore.getState();
  state.setRound({ currentRound: 3, roundEndsAt: 50000, puzzle: { pieces: [] } });
  state.setLeaderboard({ round: 3, leaderboard: [{ name: "Bob" }] });
  state.setFinalLeaderboard([{ name: "Bob" }]);
  state.setConnectionError("Previous error");
  state.setSession({ eventId: "new-event", playerId: "new-player", playerName: "Alice" });
  expect(useGameStore.getState()).toMatchObject({
    eventStatus: "lobby", currentRound: 0, puzzle: null, leaderboard: [],
    finalLeaderboard: [], connectionError: "", moves: 0,
  });
  state.setEventStatus("in_round");
  expect(useGameStore.getState().eventStatus).toBe("in_round");
});

it("restores wrong arrangements and does not overwrite a newer move with an older poll", () => {
    const state = useGameStore.getState();
    state.setSession({ eventId: "event", playerId: "player" });
    state.setRound({ currentRound: 1, roundEndsAt: 50000, puzzle: { pieces: [] } });
    state.applyPlacement({ placements: { r0c1: "r0c0" }, moves: 2, completed: false });
    state.restoreState({
      status: "in_round", currentRound: 1, roundEndsAt: 50000, puzzle: { pieces: [] },
      placements: {}, completed: false, moves: 1, leaderboard: [], finalLeaderboard: [],
    });

    expect(useGameStore.getState().placements).toEqual({ r0c1: "r0c0" });
    state.restoreState({
      status: "in_round", currentRound: 1, roundEndsAt: 50000, puzzle: { pieces: [] },
      placements: { r0c0: "r0c1" }, completed: false, moves: 3, leaderboard: [], finalLeaderboard: [],
    });
    expect(useGameStore.getState()).toMatchObject({ placements: { r0c0: "r0c1" }, placedPieceIds: ["r0c1"], moves: 3 });
    state.restoreState({
      status: "in_round", currentRound: 2, roundEndsAt: 80000, puzzle: { pieces: [] },
      placements: {}, completed: false, moves: 0, leaderboard: [], finalLeaderboard: [],
    });
    expect(useGameStore.getState()).toMatchObject({ currentRound: 2, placements: {}, placedPieceIds: [], moves: 0 });
});

it("does not undo accepted submission when an earlier poll has the same move count", () => {
  const state = useGameStore.getState();
  state.setRound({ currentRound: 1, roundEndsAt: 50000, puzzle: { pieces: [] } });
  state.applyPlacement({ placements: { r0c0: "r0c0" }, moves: 4, completed: true });
  state.restoreState({
    status: "in_round", currentRound: 1, roundEndsAt: 50000, puzzle: { pieces: [] },
    placements: { r0c0: "r0c0" }, completed: false, moves: 4, leaderboard: [], finalLeaderboard: [],
  });
  expect(useGameStore.getState().completed).toBe(true);
});
