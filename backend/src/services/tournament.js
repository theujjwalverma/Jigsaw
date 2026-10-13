const { randomUUID } = require("node:crypto");
const { ROUND_CONFIG, TOURNAMENT_ROUNDS, DEFAULT_ROUND_SECONDS } = require("../utils/constants");
const { createPuzzleConfig } = require("./puzzle");
const { getPlacements, movePiece, countWrongPieces } = require("./placements");
const { rankRoundResults, buildTournamentLeaderboard } = require("./scoring");
const {
  saveEventSnapshot,
  loadEventSnapshots,
  saveFinalResults,
} = require("../models/eventStore");

function roundProgress(state) {
  const placements = state ? getPlacements(state) : {};
  return {
    placements,
    placedPieceIds: Object.values(placements),
    completed: state?.completed || false,
    moves: state?.moves || 0,
  };
}

function roundDurations({ roundSecondsByRound, roundSeconds = DEFAULT_ROUND_SECONDS }) {
  return roundSecondsByRound ? [...roundSecondsByRound] : Array(TOURNAMENT_ROUNDS).fill(roundSeconds);
}

function generateRoomCode() {
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function normalizeCode(str) {
  return String(str || "").replace(/[^0-9]/g, "");
}

class TournamentService {
  constructor() {
    this.events = new Map();
    this.restoreFromSnapshotStore();
  }

  restoreFromSnapshotStore() {
    const snapshots = loadEventSnapshots();
    snapshots.forEach((snapshot) => {
      const normalizedStatus = snapshot.status === "in_round" ? "between_rounds" : snapshot.status;
      const roundSecondsByRound = roundDurations(snapshot);
      const players = new Map(
        snapshot.players.map((player) => [player.id, { ...player, socketId: null }]),
      );

      this.events.set(snapshot.id, {
        ...snapshot,
        code: snapshot.code || generateRoomCode(),
        roundSeconds: roundSecondsByRound[0],
        roundSecondsByRound,
        roundGrids: snapshot.roundGrids || { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
        status: normalizedStatus,
        players,
        timer: null,
        advanceTimer: null,
        roundEndsAt: null,
      });
    });
  }

  snapshot(event) {
    return {
      id: event.id,
      code: event.code || generateRoomCode(),
      createdAt: event.createdAt,
      roundSeconds: event.roundSeconds,
      roundSecondsByRound: event.roundSecondsByRound,
      roundGrids: event.roundGrids || { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
      leaderboardSeconds: event.leaderboardSeconds,
      status: event.status,
      currentRound: event.currentRound,
      roundAssets: event.roundAssets,
      roundResults: event.roundResults,
      roundEndsAt: event.roundEndsAt,
      players: [...event.players.values()].map((player) => ({
        ...player,
        socketId: null,
      })),
    };
  }

  persist(event) {
    saveEventSnapshot(this.snapshot(event));
  }

  createEvent(settings) {
    const eventId = randomUUID();
    const roundSecondsByRound = roundDurations(settings);
    const event = {
      id: eventId,
      code: generateRoomCode(),
      createdAt: new Date().toISOString(),
      roundSeconds: roundSecondsByRound[0],
      roundSecondsByRound,
      roundGrids: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
      leaderboardSeconds: settings.leaderboardSeconds,
      status: "lobby",
      currentRound: 0,
      players: new Map(),
      roundAssets: {},
      roundResults: {},
      timer: null,
      advanceTimer: null,
      roundEndsAt: null,
    };
    this.events.set(eventId, event);
    this.persist(event);
    return event;
  }

  getEvent(eventId) {
    if (!eventId) return null;
    return this.events.get(eventId) || this.getEventByCode(eventId);
  }

  getEventByCode(rawCode) {
    const clean = normalizeCode(rawCode);
    for (const event of this.events.values()) {
      if (clean && normalizeCode(event.code) === clean) {
        return event;
      }
      if (event.id === rawCode) {
        return event;
      }
    }
    return null;
  }

  updateTimerSettings(eventId, settings) {
    const event = this.ensureEvent(eventId);
    event.roundSecondsByRound = roundDurations(settings);
    event.roundSeconds = event.roundSecondsByRound[0];
    event.leaderboardSeconds = settings.leaderboardSeconds;
    this.persist(event);
    return {
      roundSeconds: event.roundSeconds,
      roundSecondsByRound: event.roundSecondsByRound,
      leaderboardSeconds: event.leaderboardSeconds,
    };
  }

  getPlayerState(eventId, playerId) {
    const event = this.ensureEvent(eventId);
    const player = event.players.get(playerId);
    if (!player) {
      const error = new Error("Player not found. Please join the event again.");
      error.statusCode = 404;
      throw error;
    }
    const state = player.rounds[event.currentRound];
    return {
      status: event.status,
      currentRound: event.currentRound,
      roundEndsAt: event.roundEndsAt,
      puzzle: state?.puzzleSnapshot || null,
      ...roundProgress(state),
      leaderboard: event.currentRound ? this.getRoundLeaderboard(eventId, event.currentRound) : [],
      finalLeaderboard: event.status === "finished" ? this.getFinalLeaderboard(eventId) : [],
    };
  }

  ensureEvent(eventId) {
    const event = this.getEvent(eventId);
    if (!event) {
      const err = new Error("Event not found");
      err.statusCode = 404;
      throw err;
    }
    return event;
  }

  setRoundImage(eventId, round, imageUrl, customGrid) {
    const event = this.ensureEvent(eventId);
    if (!event.roundGrids) {
      event.roundGrids = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
    }
    const grid = Number(customGrid) || event.roundGrids[round] || ROUND_CONFIG[round - 1].grid;
    event.roundGrids[round] = grid;
    event.roundAssets[round] = createPuzzleConfig({
      imageUrl,
      grid,
    });
    this.persist(event);
    return event.roundAssets[round];
  }

  setRoundGrid(eventId, round, grid) {
    const event = this.ensureEvent(eventId);
    if (!event.roundGrids) {
      event.roundGrids = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
    }
    const parsedGrid = Number(grid);
    event.roundGrids[round] = parsedGrid;
    if (event.roundAssets[round]?.imageUrl) {
      event.roundAssets[round] = createPuzzleConfig({
        imageUrl: event.roundAssets[round].imageUrl,
        grid: parsedGrid,
      });
    }
    this.persist(event);
    return event.roundGrids;
  }

  joinEvent(eventId, name, socketId) {
    const event = this.ensureEvent(eventId);
    if (event.currentRound > 0) {
      const err = new Error("Joining is locked after round 1 starts");
      err.statusCode = 403;
      throw err;
    }

    const playerId = randomUUID();
    const player = {
      id: playerId,
      name,
      socketId,
      connected: true,
      joinedAt: new Date().toISOString(),
      status: "waiting",
      totalMoves: 0,
      totalTimeMs: 0,
      totalPoints: 0,
      rounds: {},
    };

    event.players.set(playerId, player);
    this.persist(event);
    return player;
  }

  reconnect(eventId, playerId, socketId) {
    const event = this.ensureEvent(eventId);
    const player = event.players.get(playerId);
    if (!player) return null;
    player.connected = true;
    player.socketId = socketId;
    player.status = player.rounds[event.currentRound]?.completed
      ? "finished"
      : event.status === "in_round" ? "solving" : "waiting";
    this.persist(event);
    return { event, player };
  }

  setDisconnectedBySocket(socketId) {
    for (const event of this.events.values()) {
      for (const player of event.players.values()) {
        if (player.socketId === socketId) {
          player.connected = false;
          player.status = "disconnected";
          this.persist(event);
          return { event, player };
        }
      }
    }
    return null;
  }

  startRound(eventId, round, nowMs = Date.now()) {
    const event = this.ensureEvent(eventId);
    if (!event.roundAssets[round]) {
      const err = new Error("Round image missing");
      err.statusCode = 400;
      throw err;
    }

    event.status = "in_round";
    event.currentRound = round;
    event.timer = null;
    event.advanceTimer = null;
    const roundSeconds = event.roundSecondsByRound[round - 1];
    event.roundEndsAt = nowMs + roundSeconds * 1000;

    for (const player of event.players.values()) {
      const puzzle = event.roundAssets[round];
      player.status = "solving";
      player.rounds[round] = {
        moves: 0,
        completed: false,
        placedPieceIds: [],
        placements: {},
        startedAtMs: nowMs,
        finishedAtMs: null,
        puzzleSnapshot: puzzle,
      };
    }

    this.persist(event);
    return {
      event,
      puzzle: event.roundAssets[round],
      roundEndsAt: event.roundEndsAt,
      roundSeconds,
    };
  }

  getActivePlayerRound({ eventId, playerId, roundNumber }, nowMs) {
    const event = this.ensureEvent(eventId);
    const round = event.currentRound;
    const player = event.players.get(playerId);
    if (!player) {
      const error = new Error("Player not found.");
      error.statusCode = 404;
      throw error;
    }
    const state = player.rounds[round];
    if (event.status !== "in_round" || roundNumber !== round || !state ||
        state.completed || nowMs >= event.roundEndsAt) {
      const error = new Error("This round is no longer accepting moves or submissions.");
      error.statusCode = 409;
      throw error;
    }
    return { event, player, state };
  }

  placePiece({ eventId, playerId, pieceId, cellId, roundNumber }, nowMs = Date.now()) {
    const { event, state } = this.getActivePlayerRound({ eventId, playerId, roundNumber }, nowMs);
    const result = movePiece(state.puzzleSnapshot.pieces, getPlacements(state), pieceId, cellId);
    state.placements = result.placements;
    state.placedPieceIds = Object.values(result.placements);
    if (result.changed) state.moves += 1;
    this.persist(event);
    return roundProgress(state);
  }

  submitRound({ eventId, playerId, roundNumber }, nowMs = Date.now()) {
    const { event, player, state } = this.getActivePlayerRound({ eventId, playerId, roundNumber }, nowMs);
    const placements = getPlacements(state);
    const pieces = state.puzzleSnapshot.pieces;
    if (pieces.some((piece) => !placements[piece.id])) {
      const error = new Error("Place all pieces on the board before submitting the round.");
      error.statusCode = 400;
      throw error;
    }
    const wrongPieceCount = countWrongPieces(pieces, placements);
    if (wrongPieceCount === 0) {
      state.completed = true;
      state.finishedAtMs = nowMs;
      player.status = "finished";
      this.persist(event);
    }
    return { ...roundProgress(state), wrongPieceCount };
  }

  allPlayersFinished(eventId) {
    const event = this.ensureEvent(eventId);
    const round = event.currentRound;
    if (!round || event.players.size === 0) return false;

    for (const player of event.players.values()) {
      const state = player.rounds[round];
      if (!state?.completed) {
        return false;
      }
    }
    return true;
  }

  endRound(eventId, nowMs = Date.now()) {
    const event = this.ensureEvent(eventId);
    if (event.currentRound < 1) return [];
    if (event.status !== "in_round") {
      return this.getRoundLeaderboard(eventId, event.currentRound);
    }

    const round = event.currentRound;
    const resultInput = [];

    for (const player of event.players.values()) {
      const state = player.rounds[round];
      if (!state) continue;

      const finishMs = state.finishedAtMs || nowMs;
      const timeMs = Math.max(1, finishMs - state.startedAtMs);

      resultInput.push({
        playerId: player.id,
        name: player.name,
        completed: state.completed,
        moves: state.moves,
        timeMs,
      });

      player.totalMoves += state.moves;
      player.totalTimeMs += timeMs;
      if (!state.completed) player.status = "waiting";
    }

    const ranked = rankRoundResults(resultInput);
    ranked.forEach((row) => {
      const p = event.players.get(row.playerId);
      if (p) p.totalPoints += row.points;
    });

    event.roundResults[round] = ranked;
    event.status = round >= TOURNAMENT_ROUNDS ? "finished" : "between_rounds";
    event.roundEndsAt = null;
    event.timer = null;
    event.advanceTimer = null;
    this.persist(event);

    if (event.status === "finished") {
      const finalRows = this.getFinalLeaderboard(eventId);
      saveFinalResults(eventId, finalRows);
    }

    return ranked;
  }

  getRoundLeaderboard(eventId, round) {
    return this.ensureEvent(eventId).roundResults[round] || [];
  }

  getFinalLeaderboard(eventId) {
    const event = this.ensureEvent(eventId);
    const allRounds = Object.values(event.roundResults);
    return buildTournamentLeaderboard([...event.players.values()], allRounds);
  }

  removePlayer(eventId, playerId) {
    const event = this.ensureEvent(eventId);
    const removed = event.players.delete(playerId);
    if (removed) {
      this.persist(event);
    }
    return removed;
  }

  listPlayers(eventId) {
    return [...this.ensureEvent(eventId).players.values()];
  }

  getSpectatorState(eventId) {
    const event = this.ensureEvent(eventId);
    const round = event.currentRound;
    const puzzle = event.roundAssets[round] || null;
    return {
      id: event.id,
      code: event.code,
      status: event.status,
      currentRound: round,
      roundEndsAt: event.roundEndsAt,
      puzzle,
      players: [...event.players.values()].map((p) => {
        const roundState = p.rounds[round] || null;
        return {
          id: p.id,
          name: p.name,
          connected: p.connected,
          status: p.status,
          moves: roundState?.moves || 0,
          completed: roundState?.completed || false,
          finishedAtMs: roundState?.finishedAtMs || null,
          placements: roundState?.placements || {},
          placedPieceIds: roundState?.placedPieceIds || [],
        };
      }),
    };
  }
}

module.exports = new TournamentService();
