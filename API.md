# API Reference

## Auth

- POST /api/auth/login
  - body: { password }
  - returns: { token } and sets admin cookie
- GET /api/auth/session
  - requires a valid admin cookie or bearer token
  - returns: { authenticated: true }; 401 for missing, invalid, or expired tokens
  - not subject to the login-attempt rate limit

## Events

- POST /api/events
  - body: { roundSecondsByRound, leaderboardSeconds }
  - roundSecondsByRound: exactly five integer durations, in Round 1-5 order,
    each 60-1800 seconds; defaults to [300, 300, 300, 300, 300]
  - leaderboardSeconds: integer 5-120, defaults to 30
  - returns: { id, joinUrl, roundSeconds, roundSecondsByRound, leaderboardSeconds }
- GET /api/events/:eventId
  - returns event status summary including roundSecondsByRound and leaderboardSeconds
- PATCH /api/events/:eventId/settings (admin auth required)
  - body: { roundSecondsByRound, leaderboardSeconds }, both required
  - durations have the same constraints and ordering as event creation
  - returns saved settings; 400 for invalid values; 401 without admin auth
  - preserves the running deadline and already scheduled leaderboard pause

For backward compatibility, both create and settings requests also accept a
shared `roundSeconds` (integer 60-1800) instead of `roundSecondsByRound`, applying
it to all five rounds. When both are supplied, the per-round list wins. Responses
retain `roundSeconds` as the Round 1 value; `roundSecondsByRound` is authoritative.
Settings updates still require `leaderboardSeconds` and at least one duration
option.

## Players

- POST /api/events/:eventId/join
  - body: { name }
  - returns: { playerId, name, duplicateName }
- GET /api/events/:eventId/players
  - returns player list and live status summary
- GET /api/events/:eventId/state/:playerId
  - returns: { status, currentRound, roundEndsAt, puzzle, placements,
    placedPieceIds, completed, moves, leaderboard, finalLeaderboard }
  - placements maps cell IDs to occupying piece IDs, including wrong positions
  - placedPieceIds contains pieces currently on the board, not necessarily correct
  - restores the registered player's round state after reload or reconnection
  - 400 for malformed IDs; 404 for an unknown event or player
- POST /api/events/:eventId/place-piece
  - body: { playerId, pieceId, cellId, roundNumber }, all required
  - playerId must be a UUID; pieceId and cellId use puzzle IDs such as r0c0
  - cellId may be null to return a placed piece to the playground
  - accepts any valid cell, including a wrong position; moving onto an occupied
    cell returns its previous piece to the playground
  - returns: { completed, moves, placements, placedPieceIds }
  - increments moves for each actual placement/move/return; duplicates are no-ops
  - placing the final piece does not complete the puzzle; explicit submission
    is required, even for a correct arrangement
  - 400 for malformed payloads, unknown piece/cell IDs, or returning an unplaced
    piece; 404 for unknown events/players; 409 for stale rounds, expired deadlines,
    completed puzzles, or rounds that are no longer active
- POST /api/events/:eventId/submit-round
  - body: { playerId, roundNumber }, both required; UUID and integer 1-5
  - server validates its stored arrangement, not client-provided positions
  - success: { completed: true, moves, placements, placedPieceIds, wrongPieceCount: 0 }
  - records finish time at submission, persists completion, and freezes moves
  - when all players have successfully submitted, also returns roundEnded: true
    and leaderboard, broadcasts game:round-end, and schedules the next round
  - 422 for an incorrect full board: { error, wrongPieceCount, completed: false,
    moves, placements, placedPieceIds }; reveals only the number of wrong
    pieces, leaves the board editable and timer running
  - submission attempts do not increment moves
  - 400 for invalid payloads or an incomplete board; 404 for unknown event/player;
    409 for stale rounds, expired deadlines, completed puzzles, or inactive rounds

## Admin and Gameplay (admin auth required)

- POST /api/events/:eventId/start-game
- POST /api/events/:eventId/end-round
- POST /api/events/:eventId/advance-round
- POST /api/events/:eventId/upload/:round (multipart file field image)
- DELETE /api/events/:eventId/players/:playerId

Round progression supports manual advance and automatic advance after leaderboardSeconds.

## Results

- GET /api/events/:eventId/results
  - returns final leaderboard
  - elapsed times remain milliseconds; the player UI formats them as mm:ss
- GET /api/events/:eventId/export-csv
  - downloads csv of final results

## Socket Events

- game:join
- game:round-start
  - roundSeconds contains the configured duration of the round being started;
    roundEndsAt is its authoritative deadline
- game:piece-placed
- game:piece-placed:confirm
- game:puzzle-complete
- game:round-end
- game:tournament-end
- game:player-joined
- game:player-disconnected
- admin:player-removed
