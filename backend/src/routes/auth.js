const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/session", requireAdmin, (req, res) => {
  res.json({ authenticated: true });
});

router.post("/login", async (req, res) => {
  const password = String(req.body.password || "");

  let valid = false;
  if (env.adminPasswordHash) {
    valid = await bcrypt.compare(password, env.adminPasswordHash);
  } else {
    const fallbackPassword = env.adminPassword || "admin123";
    valid = password === fallbackPassword;
  }

  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ role: "admin" }, env.jwtSecret, { expiresIn: "30m" });
  res.cookie("adminToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 30 * 60 * 1000,
  });
  return res.json({ token });
});

module.exports = router;
