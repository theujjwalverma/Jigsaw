const express = require("express");
const { stringify } = require("csv-stringify/sync");
const tournament = require("../services/tournament");
const { eventIdSchema, parseOrThrow } = require("../utils/validators");

const router = express.Router();

router.get("/:eventId/results", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  res.json({
    finalLeaderboard: tournament.getFinalLeaderboard(eventId),
  });
});

router.get("/:eventId/export-csv", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const rows = tournament.getFinalLeaderboard(eventId).map((row, index) => ({
    rank: index + 1,
    name: row.name,
    totalPoints: row.totalPoints,
    totalMoves: row.totalMoves,
    totalTimeMs: row.totalTimeMs,
  }));

  const csv = stringify(rows, { header: true });
  res.header("Content-Type", "text/csv");
  res.attachment(`event-${eventId}-results.csv`);
  res.send(csv);
});

module.exports = router;
