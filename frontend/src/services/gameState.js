import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useGameStore = create(persist((set, get) => ({
  eventId: null,
  playerId: null,
  playerName: "",
  eventStatus: "idle",
  currentRound: 0,
  roundEndsAt: null,
  puzzle: null,
  placedPieceIds: [],
  placements: {},
  completed: false,
  moves: 0,
  leaderboard: [],
  leaderboardRound: 0,
  finalLeaderboard: [],
  connectionError: "",
  setConnectionError: (connectionError) => set({ connectionError }),
  restoreState: ({ status, currentRound, roundEndsAt, puzzle, placements, completed, moves, leaderboard, finalLeaderboard }) => {
    const state = get();
    if (state.currentRound === currentRound && (state.moves > moves || (state.completed && !completed)) &&
        state.eventStatus === "in_round" && status === "in_round") return;
    set({
      eventStatus: status, currentRound, roundEndsAt, puzzle, placements, completed,
      placedPieceIds: Object.values(placements), moves,
      leaderboard, leaderboardRound: currentRound, finalLeaderboard, connectionError: "",
    });
  },
  setSession: ({ eventId, playerId, playerName }) =>
    set({
      eventId, playerId, playerName, eventStatus: "lobby", currentRound: 0,
      roundEndsAt: null, puzzle: null, placedPieceIds: [], placements: {}, completed: false, moves: 0,
      leaderboard: [], leaderboardRound: 0, finalLeaderboard: [], connectionError: "",
    }),
  setEventStatus: (eventStatus) => set({ eventStatus }),
  setRound: ({ currentRound, roundEndsAt, puzzle }) =>
    set({
      currentRound,
      eventStatus: "in_round",
      roundEndsAt,
      puzzle,
      placedPieceIds: [],
      placements: {},
      completed: false,
      moves: 0,
      leaderboard: [],
      leaderboardRound: 0,
    }),
  applyPlacement: ({ placements, moves, completed }) =>
    set({ placements, placedPieceIds: Object.values(placements), moves, completed }),
  setLeaderboard: ({ leaderboard, round }) =>
    set({ leaderboard, leaderboardRound: round, eventStatus: "between_rounds" }),
  setFinalLeaderboard: (finalLeaderboard) => set({ finalLeaderboard, eventStatus: "finished" }),
}), {
  name: "jigsaw-player-session",
  partialize: ({ eventId, playerId, playerName }) => ({ eventId, playerId, playerName }),
}));
