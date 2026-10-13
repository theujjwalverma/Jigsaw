const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const dataDir = path.resolve(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, "jigsaw.db");
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    round_seconds INTEGER NOT NULL,
    leaderboard_seconds INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS final_results (
    event_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    name TEXT NOT NULL,
    total_points INTEGER NOT NULL,
    total_moves INTEGER NOT NULL,
    total_time_ms INTEGER NOT NULL,
    PRIMARY KEY (event_id, rank)
  );
`);

module.exports = db;
