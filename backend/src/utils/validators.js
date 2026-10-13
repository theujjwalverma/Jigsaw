const { z } = require("zod");
const { TOURNAMENT_ROUNDS, DEFAULT_ROUND_SECONDS, DEFAULT_LEADERBOARD_SECONDS } = require("./constants");

const uuidSchema = z.string().uuid();
const eventIdSchema = z.union([
  uuidSchema,
  z.string().regex(/^\d{3}-\d{3}$/),
  z.string().regex(/^\d{6}$/),
]);

const playerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9 ]+$/);

const joinSchema = z.object({
  name: playerNameSchema,
});

const roundDurationSchema = z.number().int().min(60).max(1800);
const roundSecondsByRoundSchema = z.array(roundDurationSchema).length(TOURNAMENT_ROUNDS);
const leaderboardDurationSchema = z.number().int().min(5).max(120);

const createEventSchema = z.object({
  roundSeconds: roundDurationSchema.default(DEFAULT_ROUND_SECONDS),
  roundSecondsByRound: roundSecondsByRoundSchema.optional(),
  leaderboardSeconds: leaderboardDurationSchema.default(DEFAULT_LEADERBOARD_SECONDS),
});

const timerSettingsSchema = z.object({
  roundSeconds: roundDurationSchema.optional(),
  roundSecondsByRound: roundSecondsByRoundSchema.optional(),
  leaderboardSeconds: leaderboardDurationSchema,
}).refine((settings) => settings.roundSeconds !== undefined || settings.roundSecondsByRound !== undefined, {
  message: "Provide durations for all five rounds or a shared round duration.",
  path: ["roundSecondsByRound"],
});

const pieceIdSchema = z.string().regex(/^r\d+c\d+$/).max(20);
const submissionSchema = z.object({
  playerId: uuidSchema,
  roundNumber: z.number().int().min(1).max(5),
});
const placementSchema = submissionSchema.extend({
  pieceId: pieceIdSchema,
  cellId: pieceIdSchema.nullable(),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(", ");
    const error = new Error(message || "Invalid request payload");
    error.statusCode = 400;
    throw error;
  }
  return result.data;
}

module.exports = {
  eventIdSchema,
  playerNameSchema,
  joinSchema,
  createEventSchema,
  timerSettingsSchema,
  placementSchema,
  submissionSchema,
  parseOrThrow,
};
