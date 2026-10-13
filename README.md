# Jigsaw Tournament

Live five-round online jigsaw tournament for 50+ concurrent players.

## Participant Introduction Banner

[Download the Jigsaw Arena banner](docs/jigsaw-arena-banner.png): a 3840 x 2160
PNG for a widescreen (16:9) PowerPoint slide. Its pastel clay styling features
softly raised puzzle pieces, rounded cards, and pill badges. Three evenly spaced
instruction cards explain joining, arranging pieces, and submitting a round.

## Monorepo Layout

- backend: Express + Socket.IO realtime tournament server
- frontend: React + Vite player and admin interfaces
- docs: testing and operations docs
- docker: container assets

## Quick Start

1. Install dependencies:
   - npm install
2. Configure env files:
   - cp backend/.env.example backend/.env
   - cp frontend/.env.example frontend/.env
3. Set admin password hash in backend/.env.
4. Run both apps:
   - npm run dev

Frontend runs on port 5173, listens on all network interfaces, and proxies
`/api` and `/socket.io` to the backend on port 5001 (5000 is used by macOS
AirPlay Receiver). Leave `VITE_API_URL` empty
for local/Wi-Fi play. Only set it when using a separately hosted backend.

### Players on the same Wi-Fi

1. Run `npm run dev` and keep both servers running.
2. Open `http://<your-computer-LAN-IP>:5173/admin` on the host computer.
3. Log in, create an event, and share the dashboard's **Join URL**
   (`http://<your-computer-LAN-IP>:5173/join/<event-id>`) with players.
4. Players enter their names and join the lobby; upload round images before
   starting the tournament.

Do not share a `localhost` link: it points to the player's own device.
The site root opens the admin dashboard, not a player join page.
Allow incoming connections on port 5173 in the host firewall if prompted.
Guest Wi-Fi/client isolation can block connections between devices.
This development setup is for a trusted local network, not the public internet.

## Scripts

- npm run dev: run backend and frontend concurrently
- npm run test: run backend then frontend test suites
- npm run test:backend
- npm run test:frontend
- npm --workspace frontend run test -- --coverage: frontend coverage report

## Core Feature Coverage

- 5 round progression (2x2 to 6x6)
- Realtime round start/end and piece placement confirmations
- Round and tournament leaderboard calculation
- Admin auth + event creation + round controls + CSV export
- Automatically selected events with refresh-safe admin event selection
- Separate durations for all five rounds and an editable leaderboard pause
- Player session restoration with authoritative puzzle, countdown, and progress
- Interlocking jigsaw image pieces with drag or select-and-place controls
- Socket-driven admin sync with low-frequency polling fallback
- Player reconnection support using socket rejoin

Puzzle pieces and board cells have no visible coordinate labels or correct-cell
highlights. Drag a piece anywhere inside **any** cell, including a wrong one,
or select a piece and tap a cell. Selecting an occupied board piece lets you
move it or use **Return selected piece to playground**; you can also drag it
back to the playground. A piece dropped onto an occupied cell replaces it,
returning the old piece to the playground.

Each placement, move, replacement, or return counts as one move; repeating
the exact same placement does not add a move. Once all pieces are on the board,
**Submit round** appears. Even a correct arrangement remains editable until
submitted. The server accepts the submission only when every piece is correctly
arranged; otherwise it shows how many pieces are wrongly placed, without
highlighting their locations. Players can rearrange and submit again before
the deadline. The timer continues after rejected submissions; successful
submission records the finish time and freezes the board. Submission attempts
do not add moves. The progress bar reports **board coverage**, not how many
pieces are correct.

The tray starts in a jumbled order for each round and retains that order while
pieces are selected, placed, or refreshed by server polling.
The board and image pieces preserve the uploaded image's aspect ratio:
landscape images produce wide rectangles, portrait images produce tall
rectangles, and square images stay square. The board scales down on smaller
screens without stretching the image. Image loading failures are shown to players.

Pieces have rounded interlocking tabs and sockets, with flat outer borders.
Neighboring edges match, and each tab includes image detail from across the
original crop boundary. The tray and board use the same shapes; older saved
puzzles receive consistent shapes without needing to restart the round.
Cells still accept any piece, including incorrect placements, and drag/tap,
replacement, return, and submission rules are unchanged.

### Pastel clay interface

Player and admin screens use a shared pastel palette, softly raised clay cards,
rounded controls, and visible keyboard focus styles. The game HUD shows the
current round, real move count, countdown, and board coverage.
The board and tray stack on smaller screens; image proportions and existing
drag/tap controls are preserved. Reduced-motion preferences disable decorative
animation. Join, lobby, standings, and admin setup share the same styling.
Round and final leaderboard times are shown as **mm:ss** (for example, 92427 ms
is displayed as 01:32). Scoring, API responses, and CSV exports still use the
original millisecond values.

## Current Scope

### Admin upload and start troubleshooting

- Log in before selecting round images, then create an event (automatically
  selected) or use **Open Event** to resume an existing event ID.
- Selecting a filename does not mean the upload succeeded. Wait for
  **Upload complete** and **Round 1 image uploaded** before starting.
- Upload failures are shown beside the affected round. After an expired session,
  log in and select the image again.
- Valid admin cookie sessions are checked on page load, including after refresh.
- **Start Round 1** requires authentication, a selected event, and a successfully
  uploaded Round 1 image. Images for later rounds are only required before those
  rounds start.

### Timer settings

Set each **Round 1-5 duration** independently (60-1800 seconds per round)
and **Leaderboard pause** (5-120 seconds).
For an existing event, click **Save Timer Settings**; for a new event, **Create
Event** uses the entered values. Saved settings affect subsequent rounds and
newly scheduled pauses. Each round uses its saved duration when it next starts;
changing a duration does not extend or reset a running countdown or an already
scheduled pause. Saved durations are restored when reopening the event or
restarting the backend. Existing events with a shared duration keep that value
for all five rounds until edited.

### Recommended round images

The admin portal shows these square-image recommendations beside each upload:

| Round | Puzzle grid | Recommended square size |
|-------|-------------|-------------------------|
| 1 | 2x2 | 600 x 600 px |
| 2 | 3x3 | 900 x 900 px |
| 3 | 4x4 | 1200 x 1200 px |
| 4 | 5x5 | 1500 x 1500 px |
| 5 | 6x6 | 1800 x 1800 px |

These are quality guidelines (about 300 pixels per piece), not upload restrictions.
Landscape and portrait images are supported and keep their original proportions.
Use PNG, JPEG, or WebP up to 5 MB per image; JPEG/WebP is useful for keeping
larger photographs within the file-size limit.

### Player puzzle recovery

Players keep their event/player identity in browser local storage. Reloads and
socket reconnects restore the puzzle image, deadline, exact piece positions
(including wrong arrangements), and results
from the server. Lobby polling never replaces the puzzle with an empty state.
Players without a matching session are sent to the event's join page.
Older correctly snapped snapshots are restored as their original correct
placements. New placement requests must include the destination cell and round
number; stale-round moves and moves after the deadline or completion are rejected.

Event snapshots and final results are stored in SQLite. Timers remain
process-local; restarting the backend pauses an active round between rounds.
