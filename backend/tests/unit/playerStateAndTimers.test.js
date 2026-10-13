const store = {
  loadEventSnapshots: vi.fn(() => []),
  saveEventSnapshot: vi.fn(),
  saveFinalResults: vi.fn(),
};
const storePath = require.resolve("../../src/models/eventStore");
const previousStore = require.cache[storePath];
require.cache[storePath] = { exports: store };
let nextId = 0;
const idSpy = vi.spyOn(require("node:crypto"), "randomUUID").mockImplementation(
  () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
);
const tournament = require("../../src/services/tournament");
afterAll(() => {
  if (previousStore) require.cache[storePath] = previousStore;
  else delete require.cache[storePath];
  idSpy.mockRestore();
});
const { createEventSchema, timerSettingsSchema, placementSchema, submissionSchema, parseOrThrow } = require("../../src/utils/validators");
const eventRoutes = require("../../src/routes/events");
const playerRoutes = require("../../src/routes/players");
const gameRoutes = require("../../src/routes/playerGame");
const adminGameRoutes = require("../../src/routes/game");
const jwt = require("jsonwebtoken");
const env = require("../../src/config/env");

describe("player state and timer settings", () => {
  let event, player;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    event = tournament.createEvent({ roundSeconds: 300, leaderboardSeconds: 30 });
    player = tournament.joinEvent(event.id, "Alice", null);
  });
  afterEach(() => vi.useRealTimers());

  it("returns complete player round state with authoritative deadline", () => {
    const puzzle = tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    tournament.placePiece({ eventId: event.id, playerId: player.id, pieceId: "r0c0", cellId: "r0c0", roundNumber: 1 });
    expect(tournament.getPlayerState(event.id, player.id)).toMatchObject({
      status: "in_round", currentRound: 1, roundEndsAt: 301000, puzzle,
      placedPieceIds: ["r0c0"], moves: 1,
      placements: { r0c0: "r0c0" }, completed: false,
    });
  });

  it("restores solving status after a player disconnects and reconnects", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    tournament.reconnect(event.id, player.id, "socket-one");
    tournament.setDisconnectedBySocket("socket-one");
    expect(player.status).toBe("disconnected");
    tournament.reconnect(event.id, player.id, "socket-two");
    expect(player.status).toBe("solving");
  });

  it("returns lobby state and rejects unknown players", () => {
    expect(tournament.getPlayerState(event.id, player.id)).toMatchObject({
      status: "lobby", currentRound: 0, puzzle: null, roundEndsAt: null,
    });
    expect(() => tournament.getPlayerState(event.id, "missing")).toThrow("Player not found");
  });

  it("restores round and final leaderboards for completed rounds", () => {
    tournament.setRoundImage(event.id, 5, "/image.png");
    tournament.startRound(event.id, 5, 1000);
    const rows = tournament.endRound(event.id, 4000);
    expect(tournament.getPlayerState(event.id, player.id)).toMatchObject({
      status: "finished", roundEndsAt: null, leaderboard: rows,
      finalLeaderboard: tournament.getFinalLeaderboard(event.id),
    });
  });

  it("saves settings without changing current deadline and uses them next round", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.setRoundImage(event.id, 2, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    tournament.updateTimerSettings(event.id, { roundSeconds: 60, leaderboardSeconds: 5 });
    expect(event.roundEndsAt).toBe(301000);
    expect(store.saveEventSnapshot).toHaveBeenCalled();
    tournament.startRound(event.id, 2, 5000);
    expect(event.roundEndsAt).toBe(65000);
  });

  it("creates and persists individual round durations and uses each round's time", () => {
    const times = [60, 120, 180, 240, 300];
    event = tournament.createEvent({ roundSecondsByRound: times, leaderboardSeconds: 5 });
    expect(event.roundSecondsByRound).toEqual(times);
    expect(store.saveEventSnapshot).toHaveBeenCalledWith(expect.objectContaining({ roundSecondsByRound: times }));
    for (let round = 1; round <= 5; round++) {
      tournament.setRoundImage(event.id, round, "/image.png");
      const result = tournament.startRound(event.id, round, 5000);
      expect(result.roundSeconds).toBe(times[round - 1]);
      expect(result.roundEndsAt).toBe(5000 + times[round - 1] * 1000);
    }
  });

  it("restores individual durations and migrates old shared-duration snapshots", () => {
    const snapshot = tournament.snapshot(event);
    const times = [90, 180, 270, 360, 450];
    store.loadEventSnapshots.mockReturnValueOnce([{ ...snapshot, roundSecondsByRound: times }]);
    tournament.restoreFromSnapshotStore();
    expect(tournament.getEvent(event.id).roundSecondsByRound).toEqual(times);
    delete snapshot.roundSecondsByRound;
    store.loadEventSnapshots.mockReturnValueOnce([snapshot]);
    tournament.restoreFromSnapshotStore();
    expect(tournament.getEvent(event.id).roundSecondsByRound).toEqual([300, 300, 300, 300, 300]);
  });

  it("saves per-round durations without rescheduling the active countdown or pause", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.setRoundImage(event.id, 2, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    const timer = event.timer = Symbol("round timer");
    const advanceTimer = event.advanceTimer = Symbol("leaderboard timer");
    const times = [90, 180, 270, 360, 450];
    const saved = tournament.updateTimerSettings(event.id, { roundSecondsByRound: times, leaderboardSeconds: 5 });
    expect(saved.roundSecondsByRound).toEqual(times);
    expect(event.roundEndsAt).toBe(301000);
    expect(event.timer).toBe(timer);
    expect(event.advanceTimer).toBe(advanceTimer);
    tournament.startRound(event.id, 2, 5000);
    expect(event.roundEndsAt).toBe(185000);
  });

  it.each([
    [], [60, 60, 60, 60], [60, 60, 60, 60, 60, 60],
    [59, 60, 60, 60, 60], [60, 1801, 60, 60, 60],
    [60, 60, 60.5, 60, 60], [60, 60, 60, "60", 60], null,
  ].map((roundSecondsByRound) => ({ roundSecondsByRound })))("rejects invalid per-round duration lists %j", ({ roundSecondsByRound }) => {
    const payload = { roundSecondsByRound, leaderboardSeconds: 5 };
    expect(() => parseOrThrow(createEventSchema, payload)).toThrow();
    expect(() => parseOrThrow(timerSettingsSchema, payload)).toThrow();
  });

  it("accepts all round duration boundaries and legacy shared settings", () => {
    const payload = { roundSecondsByRound: [60, 1800, 60, 1800, 60], leaderboardSeconds: 5 };
    expect(parseOrThrow(timerSettingsSchema, payload)).toEqual(payload);
    expect(parseOrThrow(createEventSchema, {})).toMatchObject({ roundSeconds: 300, leaderboardSeconds: 30 });
    expect(() => parseOrThrow(timerSettingsSchema, { leaderboardSeconds: 5 })).toThrow();
  });

  it.each([
    { roundSeconds: 59, leaderboardSeconds: 5 },
    { roundSeconds: 1801, leaderboardSeconds: 5 },
    { roundSeconds: 60.5, leaderboardSeconds: 5 },
    { roundSeconds: 60, leaderboardSeconds: 4 },
    { roundSeconds: 60, leaderboardSeconds: 121 },
    {},
  ])("rejects invalid timer settings %j", (payload) => {
    expect(() => parseOrThrow(timerSettingsSchema, payload)).toThrow();
  });

  it.each([60, 1800])("accepts duration boundary %s", (roundSeconds) => {
    expect(parseOrThrow(timerSettingsSchema, { roundSeconds, leaderboardSeconds: 5 }))
      .toEqual({ roundSeconds, leaderboardSeconds: 5 });
  });

  function invoke(router, path, req) {
    const route = router.stack.find((layer) => layer.route?.path === path).route;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    let index = 0;
    const next = () => route.stack[index++].handle(req, res, next);
    next();
    return res;
  }

  it("protects timer changes with admin authentication", () => {
    const res = invoke(eventRoutes, "/:eventId/settings", {
      params: { eventId: event.id }, headers: {}, cookies: {}, body: { roundSeconds: 60, leaderboardSeconds: 5 },
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(event.roundSeconds).toBe(300);
  });

  it("saves validated timer settings through the admin route", () => {
    const res = invoke(eventRoutes, "/:eventId/settings", {
      params: { eventId: event.id }, headers: {},
      cookies: { adminToken: jwt.sign({ role: "admin" }, env.jwtSecret) },
      body: { roundSeconds: 60, leaderboardSeconds: 5 },
    });
    expect(res.json).toHaveBeenCalledWith({
      roundSeconds: 60, roundSecondsByRound: [60, 60, 60, 60, 60], leaderboardSeconds: 5,
    });
  });

  it("serves the registered player's state through the restoration route", () => {
    const res = invoke(playerRoutes, "/:eventId/state/:playerId", {
      params: { eventId: event.id, playerId: player.id },
    });
    expect(res.json).toHaveBeenCalledWith(tournament.getPlayerState(event.id, player.id));
  });

  it("creates, reads and updates per-round settings through the event API", () => {
    const times = [90, 180, 270, 360, 450];
    const created = invoke(eventRoutes, "/", { body: { roundSecondsByRound: times, leaderboardSeconds: 5 } });
    const id = created.json.mock.calls[0][0].id;
    expect(created.json).toHaveBeenCalledWith(expect.objectContaining({ roundSecondsByRound: times }));
    const summary = invoke(eventRoutes, "/:eventId", { params: { eventId: id } });
    expect(summary.json).toHaveBeenCalledWith(expect.objectContaining({ roundSecondsByRound: times }));
    const updated = invoke(eventRoutes, "/:eventId/settings", {
      params: { eventId: id }, headers: {},
      cookies: { adminToken: jwt.sign({ role: "admin" }, env.jwtSecret) },
      body: { roundSecondsByRound: [60, 120, 180, 240, 300], leaderboardSeconds: 10 },
    });
    expect(updated.json).toHaveBeenCalledWith(expect.objectContaining({ roundSecondsByRound: [60, 120, 180, 240, 300] }));
  });

  it("broadcasts the configured durations on manual round start and advance", () => {
    tournament.updateTimerSettings(event.id, { roundSecondsByRound: [60, 120, 180, 240, 300], leaderboardSeconds: 5 });
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.setRoundImage(event.id, 2, "/image.png");
    const emit = vi.fn();
    const req = { params: { eventId: event.id }, app: { get: () => ({ to: () => ({ emit }) }) } };
    invoke(adminGameRoutes, "/:eventId/start-game", req);
    expect(event.roundEndsAt).toBe(65000);
    expect(emit).toHaveBeenCalledWith("game:round-start", expect.objectContaining({ round: 1, roundSeconds: 60 }));
    invoke(adminGameRoutes, "/:eventId/end-round", req);
    invoke(adminGameRoutes, "/:eventId/advance-round", req);
    expect(event.roundEndsAt).toBe(125000);
    expect(emit).toHaveBeenCalledWith("game:round-start", expect.objectContaining({ round: 2, roundSeconds: 120 }));
  });

  it("uses the next round duration during automatic advancement after admin round end", () => {
    tournament.updateTimerSettings(event.id, { roundSecondsByRound: [60, 120, 180, 240, 300], leaderboardSeconds: 5 });
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.setRoundImage(event.id, 2, "/image.png");
    tournament.startRound(event.id, 1);
    const emit = vi.fn();
    invoke(adminGameRoutes, "/:eventId/end-round", {
      params: { eventId: event.id }, app: { get: () => ({ to: () => ({ emit }) }) },
    });
    vi.advanceTimersByTime(5000);
    expect(event.roundEndsAt).toBe(130000);
    expect(emit).toHaveBeenCalledWith("game:round-start", expect.objectContaining({ round: 2, roundSeconds: 120 }));
  });

  it("provides five default durations and reports unknown events through the event API", () => {
    const created = invoke(eventRoutes, "/", {});
    expect(created.json).toHaveBeenCalledWith(expect.objectContaining({ roundSecondsByRound: [300, 300, 300, 300, 300] }));
    const missing = invoke(eventRoutes, "/:eventId", { params: { eventId: "00000000-0000-4000-8000-999999999999" } });
    expect(missing.status).toHaveBeenCalledWith(404);
  });

  it("handles final-round end and manual advance without scheduling another round", () => {
    tournament.setRoundImage(event.id, 5, "/image.png");
    tournament.startRound(event.id, 5);
    const emit = vi.fn();
    const req = { params: { eventId: event.id }, app: { get: () => ({ to: () => ({ emit }) }) } };
    invoke(adminGameRoutes, "/:eventId/end-round", req);
    expect(emit).toHaveBeenCalledWith("game:tournament-end", expect.any(Array));
    const advanced = invoke(adminGameRoutes, "/:eventId/advance-round", req);
    expect(advanced.json).toHaveBeenCalledWith(expect.objectContaining({ finished: true }));
    expect(event.advanceTimer).toBeNull();
  });

  it("keeps a previously scheduled pause when settings change and cancels duplicate end timers", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.setRoundImage(event.id, 2, "/image.png");
    tournament.startRound(event.id, 1);
    const expired = vi.fn();
    event.timer = setTimeout(expired, 1000);
    const emit = vi.fn();
    const req = { params: { eventId: event.id }, app: { get: () => ({ to: () => ({ emit }) }) } };
    invoke(adminGameRoutes, "/:eventId/end-round", req);
    invoke(adminGameRoutes, "/:eventId/end-round", req);
    const scheduledPause = event.advanceTimer;
    tournament.updateTimerSettings(event.id, { roundSecondsByRound: [60, 120, 180, 240, 300], leaderboardSeconds: 5 });
    expect(event.advanceTimer).toBe(scheduledPause);
    vi.advanceTimersByTime(29999);
    expect(event.status).toBe("between_rounds");
    vi.advanceTimersByTime(1);
    expect(event.currentRound).toBe(2);
    expect(event.roundEndsAt).toBe(155000);
    expect(expired).not.toHaveBeenCalled();
    expect(emit.mock.calls.filter(([name]) => name === "game:round-start")).toHaveLength(1);
    vi.advanceTimersByTime(120000);
    expect(event.status).toBe("between_rounds");
  });

  function place(pieceId, cellId, roundNumber = 1) {
    return tournament.placePiece({ eventId: event.id, playerId: player.id, pieceId, cellId, roundNumber });
  }

  function submit(roundNumber = 1) {
    return tournament.submitRound({ eventId: event.id, playerId: player.id, roundNumber });
  }

  it("persists wrong placements, replacements and returns while counting actual changes", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    expect(place("r0c0", "r0c1")).toMatchObject({ completed: false, moves: 1 });
    expect(place("r0c0", "r0c1").moves).toBe(1);
    expect(place("r1c0", "r0c1")).toMatchObject({ placements: { r0c1: "r1c0" }, placedPieceIds: ["r1c0"], moves: 2 });
    expect(place("r1c0", null)).toMatchObject({ placements: {}, placedPieceIds: [], moves: 3 });
    place("r1c1", "r0c0");
    expect(tournament.getPlayerState(event.id, player.id)).toMatchObject({ placements: { r0c0: "r1c1" }, completed: false });
    expect(store.saveEventSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      players: expect.arrayContaining([expect.objectContaining({
        rounds: expect.objectContaining({ 1: expect.objectContaining({ placements: { r0c0: "r1c1" } }) }),
      })]),
    }));
  });

  it("requires explicit submission and permits corrections after a rejected full board", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    place("r0c0", "r0c1");
    place("r0c1", "r0c0");
    place("r1c0", "r1c0");
    expect(place("r1c1", "r1c1").completed).toBe(false);
    expect(tournament.allPlayersFinished(event.id)).toBe(false);
    expect(submit()).toMatchObject({ completed: false, wrongPieceCount: 2, moves: 4 });
    expect(player.status).toBe("solving");
    expect(player.rounds[1].finishedAtMs).toBeNull();
    place("r0c0", "r0c0");
    expect(place("r0c1", "r0c1").completed).toBe(false);
    expect(tournament.allPlayersFinished(event.id)).toBe(false);
    vi.setSystemTime(6000);
    expect(submit()).toMatchObject({ completed: true, wrongPieceCount: 0, moves: 6 });
    expect(player.rounds[1].finishedAtMs).toBe(6000);
    expect(player.status).toBe("finished");
    expect(tournament.allPlayersFinished(event.id)).toBe(true);
    expect(() => place("r0c0", null)).toThrow("no longer accepting");
    expect(() => submit()).toThrow("no longer accepting");
    expect(store.saveEventSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      players: expect.arrayContaining([expect.objectContaining({
        rounds: expect.objectContaining({ 1: expect.objectContaining({ completed: true, finishedAtMs: 6000 }) }),
      })]),
    }));
  });

  it("rejects incomplete, stale, expired and non-active submissions", () => {
    expect(() => submit()).toThrow("no longer accepting");
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    expect(() => submit()).toThrow("Place all pieces");
    expect(() => submit(2)).toThrow("no longer accepting");
    expect(() => tournament.submitRound({ eventId: event.id, playerId: "missing", roundNumber: 1 }))
      .toThrow("Player not found");
    vi.setSystemTime(301000);
    expect(() => submit()).toThrow("no longer accepting");
  });

  it("validates the required submission identity and round number", () => {
    expect(parseOrThrow(submissionSchema, { playerId: player.id, roundNumber: 1 }))
      .toEqual({ playerId: player.id, roundNumber: 1 });
    for (const invalid of [{}, { playerId: "invalid", roundNumber: 1 },
      { playerId: player.id, roundNumber: 0 }, { playerId: player.id, roundNumber: 11 }]) {
      expect(() => parseOrThrow(submissionSchema, invalid)).toThrow();
    }
  });

  it("rejects expired rounds, stale round numbers, invalid pieces and unknown players", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    expect(() => place("r0c0", "r0c0", 2)).toThrow("no longer accepting");
    expect(() => place("r9c9", "r0c0")).toThrow("Invalid puzzle");
    expect(() => tournament.placePiece({
      eventId: event.id, playerId: "missing", pieceId: "r0c0", cellId: "r0c0", roundNumber: 1,
    })).toThrow("Player not found");
    vi.setSystemTime(301000);
    expect(() => place("r0c0", "r0c0")).toThrow("no longer accepting");
  });

  it("validates required placement IDs, destination and round number", () => {
    const payload = { playerId: player.id, pieceId: "r0c0", cellId: "r0c1", roundNumber: 1 };
    expect(parseOrThrow(placementSchema, payload)).toEqual(payload);
    expect(parseOrThrow(placementSchema, { ...payload, cellId: null }).cellId).toBeNull();
    for (const invalid of [
      { ...payload, playerId: "invalid" }, { ...payload, pieceId: "__proto__" },
      { ...payload, cellId: undefined }, { ...payload, roundNumber: undefined },
      { ...payload, roundNumber: 0 }, { ...payload, roundNumber: 11 },
    ]) {
      expect(() => parseOrThrow(placementSchema, invalid)).toThrow();
    }
  });

  it("accepts wrong placement and returns pieces through the REST route without ending the round", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    const body = { playerId: player.id, pieceId: "r0c0", cellId: "r0c1", roundNumber: 1 };
    const app = { get: vi.fn() };
    const response = invoke(gameRoutes, "/:eventId/place-piece", { params: { eventId: event.id }, body, app });
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ completed: false, placements: { r0c1: "r0c0" } }));
    expect(app.get).toHaveBeenCalledWith("io");
    const returned = invoke(gameRoutes, "/:eventId/place-piece", {
      params: { eventId: event.id }, body: { ...body, cellId: null }, app,
    });
    expect(returned.json).toHaveBeenCalledWith(expect.objectContaining({ placements: {}, moves: 2 }));
  });

  it("ends a round only when the correctly arranged board is submitted", () => {
    tournament.updateTimerSettings(event.id, { roundSecondsByRound: [300, 120, 180, 240, 300], leaderboardSeconds: 30 });
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.setRoundImage(event.id, 2, "/next-image.png");
    tournament.startRound(event.id, 1, 1000);
    const previousTimeout = vi.fn();
    event.timer = setTimeout(previousTimeout, 1000);
    for (const id of ["r0c0", "r0c1", "r1c0"]) place(id, id);
    const emit = vi.fn();
    const app = { get: () => ({ to: () => ({ emit }) }) };
    const placement = invoke(gameRoutes, "/:eventId/place-piece", {
      params: { eventId: event.id },
      body: { playerId: player.id, pieceId: "r1c1", cellId: "r1c1", roundNumber: 1 },
      app,
    });
    expect(placement.json).toHaveBeenCalledWith(expect.objectContaining({ completed: false, moves: 4 }));
    expect(emit).toHaveBeenCalledWith("spectator:placement", expect.any(Object));
    const response = invoke(gameRoutes, "/:eventId/submit-round", {
      params: { eventId: event.id }, body: { playerId: player.id, roundNumber: 1 }, app,
    });
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ roundEnded: true, completed: true, moves: 4 }));
    expect(emit).toHaveBeenCalledWith("game:round-end", expect.any(Object));
    expect(event.status).toBe("between_rounds");
    vi.advanceTimersByTime(30000);
    expect(previousTimeout).not.toHaveBeenCalled();
    expect(event.currentRound).toBe(2);
    expect(event.status).toBe("in_round");
    expect(event.roundEndsAt).toBe(155000);
    expect(emit).toHaveBeenCalledWith("game:round-start", expect.objectContaining({ round: 2, roundSeconds: 120 }));
    vi.advanceTimersByTime(120000);
    expect(event.status).toBe("between_rounds");
    expect(emit).toHaveBeenCalledWith("game:round-end", expect.objectContaining({ round: 2 }));
  });

  it("returns an exact wrong-piece count and keeps the round open on rejected submission", () => {
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    place("r0c0", "r0c1");
    place("r0c1", "r0c0");
    place("r1c0", "r1c0");
    place("r1c1", "r1c1");
    const app = { get: vi.fn() };
    const response = invoke(gameRoutes, "/:eventId/submit-round", {
      params: { eventId: event.id }, body: { playerId: player.id, roundNumber: 1 }, app,
    });
    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      completed: false, wrongPieceCount: 2, error: "2 pieces are wrongly placed. Rearrange them and submit again.",
    }));
    expect(app.get).not.toHaveBeenCalled();
    expect(event.status).toBe("in_round");
    expect(tournament.getPlayerState(event.id, player.id).moves).toBe(4);
  });

  it("waits for other players to submit before ending the round", () => {
    tournament.joinEvent(event.id, "Bob", null);
    tournament.setRoundImage(event.id, 1, "/image.png");
    tournament.startRound(event.id, 1, 1000);
    for (const id of ["r0c0", "r0c1", "r1c0", "r1c1"]) place(id, id);
    const app = { get: vi.fn() };
    const response = invoke(gameRoutes, "/:eventId/submit-round", {
      params: { eventId: event.id }, body: { playerId: player.id, roundNumber: 1 }, app,
    });
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ completed: true, wrongPieceCount: 0 }));
    expect(event.status).toBe("in_round");
    expect(app.get).toHaveBeenCalledWith("io");
  });

  it("publishes the final tournament results after the final round is submitted", () => {
    const puzzle = tournament.setRoundImage(event.id, 5, "/final-image.png");
    tournament.startRound(event.id, 5, 1000);
    for (const piece of puzzle.pieces) place(piece.id, piece.id, 5);
    const emit = vi.fn();
    const response = invoke(gameRoutes, "/:eventId/submit-round", {
      params: { eventId: event.id }, body: { playerId: player.id, roundNumber: 5 },
      app: { get: () => ({ to: () => ({ emit }) }) },
    });
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ completed: true, roundEnded: true }));
    expect(event.status).toBe("finished");
    expect(emit).toHaveBeenCalledWith("game:tournament-end", expect.arrayContaining([
      expect.objectContaining({ playerId: player.id }),
    ]));
  });
});
