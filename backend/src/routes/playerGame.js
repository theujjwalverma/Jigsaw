const express = require("express");
const tournament = require("../services/tournament");
const { eventIdSchema, placementSchema, submissionSchema, parseOrThrow } = require("../utils/validators");
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
      // no-op
    }
  }, delayMs);
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
      if (nextRound > TOURNAMENT_ROUNDS) {
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
      // no-op
    }
  }, event.leaderboardSeconds * 1000);
}

router.post("/:eventId/place-piece", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const payload = parseOrThrow(placementSchema, req.body || {});

  const result = tournament.placePiece({ eventId, ...payload });

  try {
    req.app.get("io").to(eventId).emit("spectator:placement", {
      playerId: payload.playerId,
      roundNumber: payload.roundNumber,
      placements: result.placements,
      moves: result.moves,
      placedPieceIds: result.placedPieceIds,
      completed: result.completed,
    });
  } catch {
    // no-op
  }

  return res.json(result);
});

router.post("/:eventId/submit-round", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const payload = parseOrThrow(submissionSchema, req.body || {});
  const result = tournament.submitRound({ eventId, ...payload });
  if (result.wrongPieceCount > 0) {
    return res.status(422).json({
      ...result,
      error: `${result.wrongPieceCount} ${result.wrongPieceCount === 1 ? "piece is" : "pieces are"} wrongly placed. Rearrange them and submit again.`,
    });
  }

  try {
    req.app.get("io").to(eventId).emit("spectator:player-finished", {
      playerId: payload.playerId,
      roundNumber: payload.roundNumber,
      moves: result.moves,
      finishedAtMs: Date.now(),
    });
  } catch {
    // no-op
  }

  if (tournament.allPlayersFinished(eventId)) {
    const event = tournament.getEvent(eventId);
    if (event?.timer) {
      clearTimeout(event.timer);
      event.timer = null;
    }
    const leaderboard = emitRoundEnd(req.app, eventId);
    scheduleAutoAdvance(req.app, eventId);
    return res.json({ ...result, roundEnded: true, leaderboard });
  }

  return res.json(result);
});

module.exports = router;
