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
    code: event.code,
    joinUrl: `/join/${event.code}`,
    roundSeconds: event.roundSeconds,
    roundSecondsByRound: event.roundSecondsByRound,
    leaderboardSeconds: event.leaderboardSeconds,
  });
});

router.get("/lookup/:code", (req, res) => {
  const code = String(req.params.code || "").trim();
  const event = tournament.getEventByCode(code);
  if (!event) {
    return res.status(404).json({ error: "Tournament room not found" });
  }
  return res.json({
    id: event.id,
    code: event.code,
    status: event.status,
    currentRound: event.currentRound,
    joinUrl: `/join/${event.code}`,
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
    code: event.code,
    joinUrl: `/join/${event.code}`,
    status: event.status,
    currentRound: event.currentRound,
    playerCount: event.players.size,
    roundSeconds: event.roundSeconds,
    roundSecondsByRound: event.roundSecondsByRound,
    leaderboardSeconds: event.leaderboardSeconds,
    uploadedRounds: Object.keys(event.roundAssets).map((value) => Number(value)),
    roundGrids: event.roundGrids || { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
  });
});

router.get("/:eventId/rounds/:round/image", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const round = Number(req.params.round);
  const event = tournament.getEvent(eventId);
  if (!event || !event.roundAssets || !event.roundAssets[round]) {
    return res.status(404).json({ error: "Image not found" });
  }
  const dataUrl = event.roundAssets[round].imageUrl;
  if (!dataUrl) {
    return res.status(404).json({ error: "Image not found" });
  }
  if (dataUrl.startsWith("data:")) {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mime = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buffer);
    }
  }
  return res.redirect(dataUrl);
});

router.get("/:eventId/spectator", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const state = tournament.getSpectatorState(eventId);
  return res.json(state);
});

module.exports = router;
