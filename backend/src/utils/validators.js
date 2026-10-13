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

const totalRoundsSchema = z.number().int().min(1).max(10);
const roundDurationSchema = z.number().int().min(60).max(1800);
const leaderboardDurationSchema = z.number().int().min(5).max(120);

const createEventSchema = z.object({
  totalRounds: totalRoundsSchema.default(5),
  roundSeconds: roundDurationSchema.default(DEFAULT_ROUND_SECONDS),
  roundSecondsByRound: z.array(roundDurationSchema).optional(),
  leaderboardSeconds: leaderboardDurationSchema.default(DEFAULT_LEADERBOARD_SECONDS),
}).superRefine((data, ctx) => {
  if (data.roundSecondsByRound) {
    const expected = data.totalRounds || 5;
    if (data.roundSecondsByRound.length !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `roundSecondsByRound must contain exactly ${expected} durations`,
        path: ["roundSecondsByRound"],
      });
    }
  }
});

const timerSettingsSchema = z.object({
  totalRounds: totalRoundsSchema.optional(),
  roundSeconds: roundDurationSchema.optional(),
  roundSecondsByRound: z.array(roundDurationSchema).optional(),
  leaderboardSeconds: leaderboardDurationSchema,
}).refine((settings) => settings.roundSeconds !== undefined || settings.roundSecondsByRound !== undefined, {
  message: "Provide durations for all rounds or a shared round duration.",
  path: ["roundSecondsByRound"],
}).superRefine((data, ctx) => {
  if (data.roundSecondsByRound) {
    const expected = data.totalRounds || 5;
    if (data.roundSecondsByRound.length !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `roundSecondsByRound must contain exactly ${expected} durations`,
        path: ["roundSecondsByRound"],
      });
    }
  }
});

const pieceIdSchema = z.string().regex(/^r\d+c\d+$/).max(20);
const submissionSchema = z.object({
  playerId: uuidSchema,
  roundNumber: z.number().int().min(1).max(10),
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
