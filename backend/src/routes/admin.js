const path = require("node:path");
const express = require("express");
const multer = require("multer");
const tournament = require("../services/tournament");
const { MAX_IMAGE_SIZE_BYTES, TOURNAMENT_ROUNDS } = require("../utils/constants");
const { eventIdSchema, parseOrThrow } = require("../utils/validators");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

router.post("/:eventId/upload/:round", upload.single("image"), (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const round = Number(req.params.round);
  if (Number.isNaN(round) || round < 1 || round > TOURNAMENT_ROUNDS) {
    return res.status(400).json({ error: "Invalid round" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return res.status(400).json({ error: "Unsupported file type" });
  }

  const customGrid = req.body?.grid ? Number(req.body.grid) : undefined;
  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  const config = tournament.setRoundImage(eventId, round, dataUrl, customGrid);
  return res.json({ round, grid: config.grid, pieces: config.pieces.length });
});

router.patch("/:eventId/rounds/:round/grid", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const round = Number(req.params.round);
  const grid = Number(req.body?.grid);
  if (Number.isNaN(round) || round < 1 || round > TOURNAMENT_ROUNDS) {
    return res.status(400).json({ error: "Invalid round" });
  }
  if (![2, 3, 4, 5, 6, 7, 8].includes(grid)) {
    return res.status(400).json({ error: "Invalid grid size" });
  }
  const roundGrids = tournament.setRoundGrid(eventId, round, grid);
  return res.json({ roundGrids });
});

router.delete("/:eventId/players/:playerId", (req, res) => {
  const eventId = parseOrThrow(eventIdSchema, req.params.eventId);
  const removed = tournament.removePlayer(eventId, req.params.playerId);
  if (!removed) {
    return res.status(404).json({ error: "Player not found" });
  }
  req.app.get("io").to(eventId).emit("admin:player-removed", { playerId: req.params.playerId });
  return res.status(204).send();
});

module.exports = router;
