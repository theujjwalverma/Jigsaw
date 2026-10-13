const db = require("./db");

const upsertEventStmt = db.prepare(`
  INSERT INTO events (id, status, round_seconds, leaderboard_seconds, snapshot_json, updated_at)
  VALUES (@id, @status, @roundSeconds, @leaderboardSeconds, @snapshotJson, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    round_seconds = excluded.round_seconds,
    leaderboard_seconds = excluded.leaderboard_seconds,
    snapshot_json = excluded.snapshot_json,
    updated_at = excluded.updated_at
`);

const selectEventsStmt = db.prepare(`SELECT snapshot_json FROM events`);

const clearResultsStmt = db.prepare(`DELETE FROM final_results WHERE event_id = ?`);
const insertResultStmt = db.prepare(`
  INSERT INTO final_results (
    event_id, rank, player_id, name, total_points, total_moves, total_time_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function saveEventSnapshot(eventSnapshot) {
  upsertEventStmt.run({
    id: eventSnapshot.id,
    status: eventSnapshot.status,
    roundSeconds: eventSnapshot.roundSeconds,
    leaderboardSeconds: eventSnapshot.leaderboardSeconds,
    snapshotJson: JSON.stringify(eventSnapshot),
    updatedAt: new Date().toISOString(),
  });
}

function loadEventSnapshots() {
  return selectEventsStmt
    .all()
    .map((row) => JSON.parse(row.snapshot_json));
}

function saveFinalResults(eventId, rows) {
  const tx = db.transaction(() => {
    clearResultsStmt.run(eventId);
    rows.forEach((row, index) => {
      insertResultStmt.run(
        eventId,
        index + 1,
        row.playerId,
        row.name,
        row.totalPoints,
        row.totalMoves,
        row.totalTimeMs,
      );
    });
  });
  tx();
}

module.exports = {
  saveEventSnapshot,
  loadEventSnapshots,
  saveFinalResults,
};
