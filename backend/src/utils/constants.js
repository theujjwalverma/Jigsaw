const ROUND_CONFIG = [
  { round: 1, grid: 2 },
  { round: 2, grid: 3 },
  { round: 3, grid: 4 },
  { round: 4, grid: 5 },
  { round: 5, grid: 6 },
];

const TOURNAMENT_ROUNDS = ROUND_CONFIG.length;
const DEFAULT_ROUND_SECONDS = 300;
const DEFAULT_LEADERBOARD_SECONDS = 30;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

module.exports = {
  ROUND_CONFIG,
  TOURNAMENT_ROUNDS,
  DEFAULT_ROUND_SECONDS,
  DEFAULT_LEADERBOARD_SECONDS,
  MAX_IMAGE_SIZE_BYTES,
};
