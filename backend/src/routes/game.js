const express = require("express");
const tournament = require("../services/tournament");
const { eventIdSchema, parseOrThrow } = require("../utils/validators");
const { TOURNAMENT_ROUNDS } = require("../utils/constants");

const router = express.Router();

function emitRoundEnd(app, eventId) {
  const leaderboard = tournament.endRound(eventId);
  const event = tournament.getEvent(eventId);
  app.get("io").to(eventId).emit("game:round-end", {
    round: event.currentRound,
    leaderboard,
  });
  return leaderboard;
}

function scheduleAutoAdvance(app, eventId) {
  const event = tournament.ensureEvent(eventId);
  if (event.status === "finished") {
    const finalLeaderboard = tournament.getFinalLeaderboard(eventId);
    app.get("io").to(eventId).emit("game:tournament-end", finalLeaderboard);
    return;
  }

  if (event.advanceTimer) {
    clearTimeout(event.advanceTimer);
  }

  event.advanceTimer = setTimeout(() => {
    try {
      const latest = tournament.ensureEvent(eventId);
      if (latest.status !== "between_rounds") return;

      const nextRound = latest.currentRound + 1;
      const maxRounds = latest.totalRounds || TOURNAMENT_ROUNDS;
      if (nextRound > maxRounds) {
        const finalLeaderboard = tournament.getFinalLeaderboard(eventId);
        app.get("io").to(eventId).emit("game:tournament-end", finalLeaderboard);
        return;
      }

      const { puzzle, roundEndsAt, roundSeconds } = tournament.startRound(eventId, nextRound);
      scheduleRoundAutoEnd(app, eventId, roundEndsAt);
      app.get("io").to(eventId).emit("game:round-start", {
        round: nextRound,
        puzzle,
        roundEndsAt,
        roundSeconds,
      });
    } catch {
      // no-op for deleted or invalid events
    }
  }, event.leaderboardSeconds * 1000);
}

function scheduleRoundAutoEnd(app, eventId, roundEndsAt) {
  const event = tournament.ensureEvent(eventId);
  if (event.timer) {
    clearTimeout(event.timer);
  }

  const delayMs = Math.max(0, roundEndsAt - Date.now());
  event.timer = setTimeout(() => {
    try {
      emitRoundEnd(app, eventId);
      scheduleAutoAdvance(app, eventId);
    } catch {
      // No-op if event has been reset or removed.
    }
  }, delayMs);
}

router.post("/:eventId/start-game", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const { puzzle, roundEndsAt, roundSeconds } = tournament.startRound(eventId, 1);
  scheduleRoundAutoEnd(req.app, eventId, roundEndsAt);
  req.app.get("io").to(eventId).emit("game:round-start", {
    round: 1,
    puzzle,
    roundEndsAt,
    roundSeconds,
  });
  res.json({ round: 1, roundEndsAt });
});

router.post("/:eventId/end-round", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const event = tournament.getEvent(eventId);
  if (event?.timer) {
    clearTimeout(event.timer);
    event.timer = null;
  }
  const leaderboard = emitRoundEnd(req.app, eventId);
  scheduleAutoAdvance(req.app, eventId);
  res.json({ leaderboard });
});

router.post("/:eventId/advance-round", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const event = tournament.ensureEvent(eventId);
  if (event.advanceTimer) {
    clearTimeout(event.advanceTimer);
    event.advanceTimer = null;
  }
  const nextRound = event.currentRound + 1;
  const maxRounds = event.totalRounds || TOURNAMENT_ROUNDS;

  if (nextRound > maxRounds) {
    const finalLeaderboard = tournament.getFinalLeaderboard(eventId);
    req.app.get("io").to(eventId).emit("game:tournament-end", finalLeaderboard);
    return res.json({ finished: true, finalLeaderboard });
  }

  const { puzzle, roundEndsAt, roundSeconds } = tournament.startRound(eventId, nextRound);
  scheduleRoundAutoEnd(req.app, eventId, roundEndsAt);
  req.app.get("io").to(eventId).emit("game:round-start", {
    round: nextRound,
    puzzle,
    roundEndsAt,
    roundSeconds,
  });
  return res.json({ round: nextRound, roundEndsAt });
});

module.exports = router;
