# Architecture

## Runtime Model

- Backend is the source of truth for rounds, timing, and score computation.
- Frontend clients render local state from server events and only send user intent (piece placement).
- Socket.IO handles low-latency tournament updates.
- A player-state REST endpoint provides authoritative recovery and polling
  fallback, including the puzzle, placements, deadline, and results.
- Admin timing updates persist five individual round durations without
  rescheduling active countdowns or already scheduled leaderboard pauses.
  Round start reads its own duration and broadcasts that duration with the
  authoritative deadline, for both manual and automatic advancement.
  Snapshot recovery expands older shared-duration settings into five equal
  values, preserving existing events.

## Backend Modules

- src/services/tournament.js: event lifecycle, player state, round orchestration.
- src/services/puzzle.js: round puzzle config generation.
- src/services/placements.js: pure cell-to-piece updates, replacement/return,
  whole-board correctness, and legacy snapped-placement recovery.
- src/services/scoring.js: rank and points logic.
- src/models/db.js and src/models/eventStore.js: SQLite snapshot persistence for events and final standings.
- src/routes/*: REST endpoints for auth, events, players, game controls, admin uploads, and exports.
- src/websocket/handlers.js: join/reconnect, placement, disconnect propagation.

## Frontend Modules

- src/services/gameState.js: shared Zustand store; only player identity is
  persisted in browser local storage.
- src/services/playerState.js: complete server snapshot recovery with stale
  session guards and visible connection errors.
- src/hooks/useGameSocket.js: socket subscriptions, rejoin on connect, and
  two-second authoritative state polling.
- src/pages/*: Join, Lobby, Game, Leaderboard, Admin.
- src/components/*: board/tray/timer/leaderboard primitives.
- src/utils/pieceImage.js: shared image crop styling for tray and placed pieces.
- src/hooks/useImageAspectRatio.js: intrinsic image dimensions, guarded image
  loading, and aspect-ratio preservation for both board and tray.
- src/components/GameHud.jsx: round track, real game statistics, and occupancy
  progress without individual position hints.

## Data Flow

1. Admin logs in and creates event.
2. Players join via event link.
3. Admin starts round -> server broadcasts game:round-start.
4. Players place, move, or return pieces -> server validates the piece/cell/round
   and persists exact positions. Occupied cells return their prior piece to the
   playground. Incorrect positions are accepted without revealing correct cells.
   Filling the board does not complete it. Players explicitly submit the round;
   the server rejects an incorrect arrangement with only its wrong-piece count.
   A correct submission persists completion and its timestamp, then freezes moves.
   Failed submissions do not reset the countdown or add moves.
   Client polling cannot overwrite accepted completion with an earlier,
   same-move-count snapshot.
5. Round ends -> server ranks players and broadcasts leaderboard.
6. Server auto-advances to the next round after leaderboard delay (or admin can advance manually).
7. After round 5, final leaderboard is produced, persisted to SQLite, and exportable as CSV.
