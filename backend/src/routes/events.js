const express = require("express");
const tournament = require("../services/tournament");
const { createEventSchema, eventIdSchema, parseOrThrow } = require("../utils/validators");
const { timerSettingsSchema } = require("../utils/validators");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.patch("/:eventId/settings", requireAdmin, (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const settings = parseOrThrow(timerSettingsSchema, req.body || {});
  res.json(tournament.updateTimerSettings(eventId, settings));
});

router.post("/", (req, res) => {
  const payload = parseOrThrow(createEventSchema, req.body || {});
  const event = tournament.createEvent(payload);
  res.status(201).json({
    id: event.id,
    joinUrl: `/join/${event.id}`,
    roundSeconds: event.roundSeconds,
    roundSecondsByRound: event.roundSecondsByRound,
    leaderboardSeconds: event.leaderboardSeconds,
  });
});

router.get("/:eventId", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const event = tournament.getEvent(eventId);
  if (!event) {
    return res.status(404).json({ error: "Event not found" });
  }

  return res.json({
    id: event.id,
    status: event.status,
    currentRound: event.currentRound,
    playerCount: event.players.size,
    roundSeconds: event.roundSeconds,
    roundSecondsByRound: event.roundSecondsByRound,
    leaderboardSeconds: event.leaderboardSeconds,
    uploadedRounds: Object.keys(event.roundAssets).map((value) => Number(value)),
  });
});

module.exports = router;
