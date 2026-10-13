const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const authRoutes = require("./routes/auth");
const eventsRoutes = require("./routes/events");
const playersRoutes = require("./routes/players");
const gameRoutes = require("./routes/game");
const adminRoutes = require("./routes/admin");
const resultsRoutes = require("./routes/results");
const playerGameRoutes = require("./routes/playerGame");
const { requireAdmin } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(morgan("dev"));

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
  });

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.post("/api/auth/login", loginLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/events", eventsRoutes);
  app.use("/api/events", playersRoutes);
  app.use("/api/events", playerGameRoutes);
  app.use("/api/events", resultsRoutes);
  app.use("/api/events", requireAdmin, gameRoutes);
  app.use("/api/events", requireAdmin, adminRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
