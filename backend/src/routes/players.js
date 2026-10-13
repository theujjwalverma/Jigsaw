const express = require("express");
const tournament = require("../services/tournament");
const { joinSchema, eventIdSchema, parseOrThrow } = require("../utils/validators");

const router = express.Router();

router.post("/:eventId/join", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const payload = parseOrThrow(joinSchema, req.body || {});

  const player = tournament.joinEvent(eventId, payload.name, null);
  res.status(201).json({
    playerId: player.id,
    name: player.name,
    duplicateName: tournament
      .listPlayers(eventId)
      .filter((p) => p.name.toLowerCase() === payload.name.toLowerCase()).length > 1,
  });
});

router.get("/:eventId/state/:playerId", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const playerId = parseOrThrow(eventIdSchema, req.params.playerId);
  res.json(tournament.getPlayerState(eventId, playerId));
});

router.get("/:eventId/players", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const event = tournament.ensureEvent(eventId);
  const players = tournament.listPlayers(eventId).map((p) => ({
    roundState: p.rounds[event.currentRound]
      ? {
          moves: p.rounds[event.currentRound].moves,
          completed: p.rounds[event.currentRound].completed,
          placed: p.rounds[event.currentRound].placedPieceIds.length,
        }
      : null,
    id: p.id,
    name: p.name,
    status: p.status,
    connected: p.connected,
    totalMoves: p.totalMoves,
    totalPoints: p.totalPoints,
  }));
  res.json(players);
});

module.exports = router;
