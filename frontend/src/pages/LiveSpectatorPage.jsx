import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { socket } from "../services/socket";
import { MiniBoard } from "../components/MiniBoard";

export function LiveSpectatorPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  // State for code entry when no eventId in URL
  const [roomCode, setRoomCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Spectator live state
  const [spectatorData, setSpectatorData] = useState(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [copied, setCopied] = useState(false);

  // Handle room code input formatting (234 - 234)
  const handleCodeChange = (e) => {
    setCodeError("");
    const rawDigits = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    if (rawDigits.length > 3) {
      setRoomCode(`${rawDigits.slice(0, 3)} - ${rawDigits.slice(3)}`);
    } else {
      setRoomCode(rawDigits);
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setIsLookingUp(true);
    setCodeError("");
    try {
      const cleanDigits = roomCode.replace(/[^0-9]/g, "");
      if (cleanDigits.length !== 6 && !roomCode.trim()) {
        throw new Error("Please enter a valid 6-digit room code (e.g. 234 - 234)");
      }
      const { data } = await api.get(`/events/lookup/${cleanDigits || roomCode.trim()}`);
      navigate(`/live/${data.id}`);
    } catch (err) {
      setCodeError(err.response?.data?.error || err.message || "Tournament room not found");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Fetch spectator state and bind socket listeners
  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;

    const fetchState = async () => {
      try {
        const { data } = await api.get(`/events/${eventId}/spectator`);
        if (isMounted) {
          setSpectatorData(data);
          setError("");
          if (data.id && data.id !== eventId) {
            socket.emit("event:watch", { eventId: data.id });
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || "Failed to load spectator stream");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchState();

    // Socket connection and room watching
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("event:watch", { eventId });

    const handlePlacement = ({ playerId, placements, moves, placedPieceIds, completed }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => {
            if (p.id !== playerId) return p;
            return {
              ...p,
              placements: placements || p.placements,
              moves: moves !== undefined ? moves : p.moves,
              placedPieceIds: placedPieceIds || p.placedPieceIds,
              completed: completed !== undefined ? completed : p.completed,
            };
          }),
        };
      });
    };

    const handlePlayerFinished = ({ playerId, moves, finishedAtMs }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => {
            if (p.id !== playerId) return p;
            return {
              ...p,
              completed: true,
              moves: moves !== undefined ? moves : p.moves,
              finishedAtMs: finishedAtMs || Date.now(),
            };
          }),
        };
      });
    };

    const handleRoundStart = (payload) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentRound: payload.round,
          puzzle: payload.puzzle,
          roundEndsAt: payload.roundEndsAt,
          status: "in_round",
          players: prev.players.map((p) => ({
            ...p,
            completed: false,
            finishedAtMs: null,
            moves: 0,
            placements: {},
            placedPieceIds: [],
          })),
        };
      });
    };

    const handleRoundEnd = () => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return { ...prev, status: "leaderboard" };
      });
    };

    const handleTournamentEnd = () => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return { ...prev, status: "completed" };
      });
    };

    const handlePlayerJoined = ({ playerId, name }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        if (prev.players.some((p) => p.id === playerId)) {
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === playerId ? { ...p, connected: true } : p
            ),
          };
        }
        return {
          ...prev,
          players: [
            ...prev.players,
            {
              id: playerId,
              name,
              connected: true,
              status: "playing",
              moves: 0,
              completed: false,
              finishedAtMs: null,
              placements: {},
              placedPieceIds: [],
            },
          ],
        };
      });
    };

    const handlePlayerDisconnected = ({ playerId }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, connected: false } : p
          ),
        };
      });
    };

    socket.on("spectator:placement", handlePlacement);
    socket.on("spectator:player-finished", handlePlayerFinished);
    socket.on("game:round-start", handleRoundStart);
    socket.on("game:round-end", handleRoundEnd);
    socket.on("game:tournament-end", handleTournamentEnd);
    socket.on("game:player-joined", handlePlayerJoined);
    socket.on("game:player-disconnected", handlePlayerDisconnected);

    // Fallback sync polling every 6 seconds
    const interval = setInterval(fetchState, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      socket.emit("event:unwatch", { eventId });
      socket.off("spectator:placement", handlePlacement);
      socket.off("spectator:player-finished", handlePlayerFinished);
      socket.off("game:round-start", handleRoundStart);
      socket.off("game:round-end", handleRoundEnd);
      socket.off("game:tournament-end", handleTournamentEnd);
      socket.off("game:player-joined", handlePlayerJoined);
      socket.off("game:player-disconnected", handlePlayerDisconnected);
    };
  }, [eventId]);

  // Round countdown timer
  useEffect(() => {
    if (!spectatorData?.roundEndsAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const remainingSec = Math.max(0, Math.ceil((spectatorData.roundEndsAt - Date.now()) / 1000));
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [spectatorData?.roundEndsAt]);

  const copyRoomCode = () => {
    if (!spectatorData?.code) return;
    navigator.clipboard.writeText(spectatorData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPieces = useMemo(() => {
    if (!spectatorData?.puzzle) return 0;
    return spectatorData.puzzle.pieces?.length || spectatorData.puzzle.grid * spectatorData.puzzle.grid;
  }, [spectatorData?.puzzle]);

  // If no eventId, render the Spectator Room Code entry card
  if (!eventId) {
    return (
      <section className="page join-page centered-card">
        <div className="clay-illustration" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <p className="eyebrow">LIVE SPECTATOR MODE</p>
        <h1>Watch Tournament</h1>
        <p className="subtitle">
          Watch players solve puzzles in real-time.<br />
          Every move and placement updates live.
        </p>

        <form onSubmit={handleLookup} className="join-form">
          <label htmlFor="spectator-code">Enter Room Code</label>
          <input
            id="spectator-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9 -]*"
            maxLength={9}
            value={roomCode}
            onChange={handleCodeChange}
            placeholder="234 - 234"
            className="code-input-field"
            required
            autoFocus
            autoComplete="off"
            aria-label="6-digit room code"
          />

          <button type="submit" disabled={isLookingUp}>
            {isLookingUp ? "Connecting..." : "Watch Live 🔴"}
          </button>
        </form>

        {codeError ? (
          <p className="error" role="alert">
            {codeError}
          </p>
        ) : null}

        <div className="card-footer-action">
          <p className="muted">Want to play instead?</p>
          <Link to="/" className="create-room-btn">
            Join Game &rarr;
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <main className="page spectator-page centered-card">
        <p className="eyebrow">CONNECTING TO ARENA</p>
        <h2>Loading Live Stream...</h2>
        <p className="subtitle">Tuning into player puzzle boards...</p>
      </main>
    );
  }

  if (error || !spectatorData) {
    return (
      <main className="page spectator-page centered-card">
        <p className="eyebrow">SPECTATOR FEED</p>
        <h2>Room Not Found</h2>
        <p className="error" role="alert">{error || "Unable to find tournament room"}</p>
        <Link to="/live" className="create-room-btn">
          Enter another Room Code &rarr;
        </Link>
      </main>
    );
  }

  const finishedCount = spectatorData.players.filter((p) => p.completed).length;

  return (
    <main className="page spectator-page">
      {/* Spectator Top HUD */}
      <header className="spectator-hud">
        <div className="spectator-hud-left">
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" />
            LIVE FEED
          </span>
          <div className="spectator-title-group">
            <h1>Spectator Arena</h1>
            <span className="spectator-round-label">
              {spectatorData.currentRound > 0
                ? `Round ${spectatorData.currentRound} of 5 (${spectatorData.puzzle?.grid || 3}x${spectatorData.puzzle?.grid || 3})`
                : "Waiting for Tournament to Start"}
            </span>
          </div>
        </div>

        <div className="spectator-hud-center">
          {timeLeft ? (
            <div className="spectator-timer">
              <span className="timer-icon" aria-hidden="true">⏱</span>
              <span className="timer-text">{timeLeft}</span>
            </div>
          ) : (
            <span className="spectator-status-tag">
              {spectatorData.status === "leaderboard"
                ? "Round Finished • Showing Scores"
                : spectatorData.status === "completed"
                ? "Tournament Complete"
                : "Lobby Standby"}
            </span>
          )}
        </div>

        <div className="spectator-hud-right">
          {spectatorData.code ? (
            <button
              type="button"
              onClick={copyRoomCode}
              className="spectator-code-pill"
              title="Click to copy Room Code"
            >
              <span className="code-pill-label">ROOM</span>
              <span className="code-pill-value">{spectatorData.code}</span>
              <span className="code-pill-copy">{copied ? "Copied!" : "📋"}</span>
            </button>
          ) : null}

          <div className="spectator-stats-pill">
            <span>{spectatorData.players.length} Players</span>
            <span className="dot-sep">•</span>
            <span>{finishedCount} Finished</span>
          </div>
        </div>
      </header>

      {/* Main Player Grid */}
      {spectatorData.players.length === 0 ? (
        <div className="spectator-empty-state centered-card">
          <p className="eyebrow">WAITING FOR PLAYERS</p>
          <h2>No Players in Arena Yet</h2>
          <p className="subtitle">
            Share Room Code <strong>{spectatorData.code}</strong> with players to get started.
          </p>
          <div className="room-code-display" onClick={copyRoomCode}>
            <span className="code-text">{spectatorData.code}</span>
            <span className="copy-badge">{copied ? "Copied!" : "Click to copy"}</span>
          </div>
        </div>
      ) : (
        <section className="spectator-grid-wrapper">
          <div className="spectator-grid">
            {spectatorData.players.map((player) => {
              const placedCount = player.placedPieceIds?.length || Object.keys(player.placements || {}).length;
              const progressPct = totalPieces > 0 ? Math.round((placedCount / totalPieces) * 100) : 0;

              return (
                <article
                  key={player.id}
                  className={`spectator-player-card ${player.completed ? "is-finished" : ""}`}
                >
                  <header className="player-card-header">
                    <div className="player-meta">
                      <span className={`status-indicator ${player.connected ? "online" : "offline"}`} />
                      <strong className="player-name">{player.name}</strong>
                    </div>

                    <div className="player-status-badge">
                      {player.completed ? (
                        <span className="badge-solved">✓ Solved</span>
                      ) : (
                        <span className="badge-moves">{player.moves} moves</span>
                      )}
                    </div>
                  </header>

                  <div className="player-mini-board-container">
                    <MiniBoard
                      puzzle={spectatorData.puzzle}
                      placements={player.placements || {}}
                      completed={player.completed}
                    />
                  </div>

                  <footer className="player-card-footer">
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${player.completed ? 100 : progressPct}%` }}
                      />
                    </div>
                    <div className="player-card-metrics">
                      <span className="progress-text">
                        {player.completed
                          ? "Completed!"
                          : `${placedCount} / ${totalPieces} placed`}
                      </span>
                      <span className="percentage-text">
                        {player.completed ? "100%" : `${progressPct}%`}
                      </span>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
