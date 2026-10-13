import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, API_BASE } from "../services/api";
import { socket } from "../services/socket";

const ROUND_CONFIG = [2, 3, 4, 5, 6].map((grid, index) => ({
  round: index + 1, grid, recommendedSize: grid * 300,
}));

export function AdminPage() {
  let navigate;
  try {
    navigate = useNavigate();
  } catch {
    navigate = () => {};
  }
  const [activeEventId, setActiveEventId] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("jigsaw-admin-event") || "");
  const [eventIdInput, setEventIdInput] = useState(activeEventId);
  const [eventCode, setEventCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [roundSecondsByRound, setRoundSecondsByRound] = useState(() => ROUND_CONFIG.map(() => 300));
  const [leaderboardSeconds, setLeaderboardSeconds] = useState(30);
  const [players, setPlayers] = useState([]);
  const [eventStatus, setEventStatus] = useState("idle");
  const [uploadedRounds, setUploadedRounds] = useState([]);
  const [activeRound, setActiveRound] = useState(0);
  const [isAuthed, setIsAuthed] = useState(false);
  const [uploadMessages, setUploadMessages] = useState({});
  const [copiedJoinUrl, setCopiedJoinUrl] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isTimersOpen, setIsTimersOpen] = useState(false);
  const [roundGrids, setRoundGrids] = useState(() => ({ 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }));
  const [previewUrls, setPreviewUrls] = useState({});
  const activeEventRef = useRef(activeEventId);
  const timerEventRef = useRef("");

  const copyJoinUrl = () => {
    const code = eventCode || activeEventId;
    if (!code) return;
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedJoinUrl(true);
    setTimeout(() => setCopiedJoinUrl(false), 2000);
  };

  useEffect(() => {
    activeEventRef.current = activeEventId;
  }, [activeEventId]);

  const extractError = (error) => error?.response?.data?.error || error?.message || "Request failed";

  const selectEvent = (id, code = "") => {
    activeEventRef.current = id;
    timerEventRef.current = "";
    setActiveEventId(id);
    setEventIdInput(code || id);
    setEventCode(code);
    setUploadMessages({});
    setUploadedRounds([]);
    setPreviewUrls({});
    setActiveRound(0);
    setPlayers([]);
    setEventStatus("loading");
    window.localStorage.setItem("jigsaw-admin-event", id);
  };

  const createEvent = async () => {
    try {
      const { data } = await api.post("/events", {
        roundSecondsByRound: roundSecondsByRound.map(Number),
        leaderboardSeconds: Number(leaderboardSeconds),
      });
      selectEvent(data.id, data.code || "");
      setMessage("New room created");
    } catch (error) {
      setMessage(`Create event failed: ${extractError(error)}`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.get("/auth/session").then(() => {
      if (!cancelled) {
        setIsAuthed(true);
        if (!activeEventRef.current) {
          createEvent();
        }
      }
    }).catch((error) => {
      if (!cancelled) {
        setIsAuthed(false);
        setMessage(`Session check failed: ${extractError(error)}`);
        navigate("/login");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const login = async () => {
    try {
      await api.post("/auth/login", { password });
      setIsAuthed(true);
      setMessage("Admin authenticated");
    } catch (error) {
      setIsAuthed(false);
      setMessage(`Login failed: ${extractError(error)}`);
    }
  };

  const activateEvent = async () => {
    const nextId = eventIdInput.trim();
    if (!nextId) {
      setMessage("Enter an event ID to control");
      return;
    }

    try {
      const { data } = await api.get(`/events/${nextId}`);
      selectEvent(data.id || nextId, data.code || "");
      setMessage(`Event opened: ${data.code || data.id || nextId}`);
      await refreshState(data.id || nextId);
    } catch (error) {
      setMessage(`Open event failed: ${extractError(error)}`);
    }
  };

  const saveTimers = async (e) => {
    e.preventDefault();
    const requestedEventId = activeEventId;
    try {
      const { data } = await api.patch(`/events/${requestedEventId}/settings`, {
        roundSecondsByRound: roundSecondsByRound.map(Number),
        leaderboardSeconds: Number(leaderboardSeconds),
      });
      if (activeEventRef.current !== requestedEventId) return;
      setRoundSecondsByRound(data.roundSecondsByRound);
      setLeaderboardSeconds(data.leaderboardSeconds);
      timerEventRef.current = requestedEventId;
      setMessage("Timer settings saved for future rounds. The running countdown is unchanged.");
    } catch (error) {
      if (activeEventRef.current !== requestedEventId) return;
      if (error.response?.status === 401) setIsAuthed(false);
      setMessage(`Save timer settings failed: ${extractError(error)}`);
    }
  };

  const startGame = async () => {
    if (!activeEventId) {
      setMessage("Please create/select an event first");
      return;
    }

    try {
      await api.post(`/events/${activeEventId}/start-game`);
      setMessage("Game started");
      await refreshState(activeEventId);
    } catch (error) {
      setMessage(`Start round failed: ${extractError(error)}`);
    }
  };

  const endRound = async () => {
    try {
      await api.post(`/events/${activeEventId}/end-round`);
      setMessage("Round ended");
      await refreshState(activeEventId);
    } catch (error) {
      setMessage(`End round failed: ${extractError(error)}`);
    }
  };

  const advanceRound = async () => {
    try {
      const { data } = await api.post(`/events/${activeEventId}/advance-round`);
      setMessage(data.finished ? "Tournament complete" : `Round ${data.round} started`);
      await refreshState(activeEventId);
    } catch (error) {
      setMessage(`Advance round failed: ${extractError(error)}`);
    }
  };

  const refreshState = async (targetEventId = activeEventRef.current) => {
    const requestedEventId = targetEventId?.trim();
    if (!requestedEventId) return;

    try {
      const [eventRes, playersRes] = await Promise.all([
        api.get(`/events/${requestedEventId}`),
        api.get(`/events/${requestedEventId}/players`),
      ]);

      if (activeEventRef.current !== requestedEventId) {
        return;
      }

      setPlayers(playersRes.data);
      setEventStatus(eventRes.data.status);
      setEventCode(eventRes.data.code || "");
      setUploadedRounds(eventRes.data.uploadedRounds || []);
      setActiveRound(eventRes.data.currentRound || 0);
      if (timerEventRef.current !== requestedEventId) {
        timerEventRef.current = requestedEventId;
        setRoundSecondsByRound(eventRes.data.roundSecondsByRound ||
          ROUND_CONFIG.map(() => eventRes.data.roundSeconds));
        setLeaderboardSeconds(eventRes.data.leaderboardSeconds);
      }
      if (eventRes.data.roundGrids) {
        setRoundGrids(eventRes.data.roundGrids);
      }
    } catch (error) {
      setMessage(`Refresh failed: ${extractError(error)}`);
    }
  };

  const uploadRound = async (round, file) => {
    if (!file) return;
    if (!isAuthed || !activeEventId) {
      setMessage("Log in and create or open an event before uploading images.");
      return;
    }
    const requestedEventId = activeEventId;
    const form = new FormData();
    form.append("image", file);
    form.append("grid", String(roundGrids[round] || ROUND_CONFIG[round - 1].grid));
    setUploadMessages((current) => ({ ...current, [round]: "Uploading..." }));
    try {
      await api.post(`/events/${requestedEventId}/upload/${round}`, form);
      if (activeEventRef.current !== requestedEventId) return;
      const localUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : `${API_BASE || ""}/api/events/${requestedEventId}/rounds/${round}/image`;
      setPreviewUrls((current) => ({ ...current, [round]: localUrl }));
      setUploadMessages((current) => ({ ...current, [round]: "Upload complete" }));
      setUploadedRounds((current) => [...new Set([...current, round])]);
      setMessage(`Uploaded image for round ${round}`);
      await refreshState(requestedEventId);
    } catch (error) {
      if (activeEventRef.current !== requestedEventId) return;
      if (error.response?.status === 401) setIsAuthed(false);
      const detail = error.response?.status === 401
        ? "Admin session expired. Log in and select the image again."
        : extractError(error);
      setUploadMessages((current) => ({ ...current, [round]: `Upload failed: ${detail}` }));
      setMessage(`Upload failed: ${detail}`);
    }
  };

  const removePlayer = async (playerId) => {
    try {
      await api.delete(`/events/${activeEventId}/players/${playerId}`);
      await refreshState(activeEventId);
    } catch (error) {
      setMessage(`Remove player failed: ${extractError(error)}`);
    }
  };

  useEffect(() => {
    if (!activeEventId) return;

    socket.connect();
    socket.emit("event:watch", { eventId: activeEventId });

    const onEventChanged = () => {
      refreshState(activeEventId);
    };

    const onConnect = () => {
      socket.emit("event:watch", { eventId: activeEventId });
      refreshState(activeEventId);
    };

    socket.on("connect", onConnect);
    socket.on("game:round-start", onEventChanged);
    socket.on("game:round-end", onEventChanged);
    socket.on("game:tournament-end", onEventChanged);
    socket.on("game:player-joined", onEventChanged);
    socket.on("game:player-disconnected", onEventChanged);
    socket.on("admin:player-removed", onEventChanged);

    refreshState(activeEventId);

    const handle = setInterval(() => {
      refreshState(activeEventId);
    }, 10000);

    return () => {
      clearInterval(handle);
      socket.off("connect", onConnect);
      socket.off("game:round-start", onEventChanged);
      socket.off("game:round-end", onEventChanged);
      socket.off("game:tournament-end", onEventChanged);
      socket.off("game:player-joined", onEventChanged);
      socket.off("game:player-disconnected", onEventChanged);
      socket.off("admin:player-removed", onEventChanged);
      socket.emit("event:unwatch", { eventId: activeEventId });
    };
  }, [activeEventId]);

  const hasRoundOneImage = uploadedRounds.includes(1);
  const hasAllRoundImages = uploadedRounds.length === 5;
  const canControlRounds = isAuthed && Boolean(activeEventId);
  const canStartRoundOne = canControlRounds && eventStatus === "lobby" && activeRound === 0 && hasRoundOneImage;
  const nextRound = activeRound > 0 ? activeRound + 1 : 1;
  const hasNextRoundImage = uploadedRounds.includes(nextRound);
  const canAdvanceRound =
    canControlRounds && eventStatus === "between_rounds" && activeRound > 0 && activeRound < 5 && hasNextRoundImage;

  return (
    <section className="page admin-page">
      <div className="admin-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <p className="eyebrow" style={{ margin: 0 }}>BEHIND THE PLAYGROUND</p>
        <a href="/" className="accent-link" style={{ fontWeight: "600" }}>&larr; Back to Home</a>
      </div>
      <h1>Admin Dashboard</h1>
      <p className="subtitle">Set the pace, gather your players, and let the puzzling begin.</p>

      <div className="admin-grid-layout">
        <div className="admin-column-main">
          <div className="clay-panel" style={{ display: isAuthed ? "none" : undefined }}>
            <h2>Host access</h2>
      <input
        aria-label="Admin password"
        type="password"
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="button" onClick={login}>Login</button>
      <p className={`badge ${isAuthed ? "badge-mint" : "badge-neutral"}`}>Admin session: {isAuthed ? "authenticated" : "not authenticated"}</p>
      {!isAuthed ? <p className="error">Log in before uploading images or starting a round.</p> : null}
      </div>
          {/* 1. Event Card */}
          <div className="clay-panel">
            <h2>Event</h2>
            <button type="button" onClick={createEvent} disabled={!isAuthed} style={{ display: "none" }}>Create Event</button>
            <div style={{ display: "none" }}>
              <input
                id="Event ID"
                aria-label="Room Code or Event ID"
                value={eventIdInput}
                onChange={(e) => setEventIdInput(e.target.value)}
                placeholder="Room Code (e.g. 234-234)"
              />
              <button type="button" onClick={activateEvent} disabled={!eventIdInput.trim()}>Open Event</button>
            </div>
            <button type="button" onClick={() => refreshState(activeEventId)} disabled={!activeEventId} style={{ display: "none" }}>Refresh</button>
            <button type="button" onClick={startGame} disabled={!canStartRoundOne}>Start Round 1</button>
            <button type="button" onClick={endRound} disabled={!canControlRounds || eventStatus !== "in_round"}>End Round Now</button>
            <button type="button" onClick={advanceRound} disabled={!canAdvanceRound}>Advance Round</button>
            <button
              type="button"
              onClick={() => window.open(`/live/${eventCode || activeEventId}`, "_blank")}
              disabled={!activeEventId}
              style={{
                background: "#ff3b5c",
                color: "#ffffff",
                fontWeight: 700,
              }}
            >
              Watch Live 🔴
            </button>
            {message ? <p role="status" className={message.includes("failed:") ? "error" : "notice"}>{message}</p> : null}
            {!activeEventId ? (
              <p className="muted" style={{ margin: "14px 0" }}>Setting up your room...</p>
            ) : null}
            {activeEventId ? (
              <div className="active-room-box" style={{ background: "#f5f0fc", padding: "16px 20px", borderRadius: "18px", margin: "14px 0" }}>
                <p style={{ margin: "0 0 8px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <strong>Room Code: </strong>
                  <span className="badge badge-mint" style={{ fontSize: "1.2rem", padding: "6px 16px", fontWeight: "800", letterSpacing: "2px" }}>
                    {eventCode || "—"}
                  </span>
                  <span className="tooltip-wrapper">
                    <button
                      type="button"
                      className="refresh-room-btn"
                      aria-label="Create new room"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </button>
                    <span className="tooltip-text">Create new room</span>
                  </span>
                </p>
                <div style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <strong>Join URL: </strong>
                  <code>{`${window.location.origin}/join/${eventCode || activeEventId}`}</code>
                  <button
                    type="button"
                    onClick={copyJoinUrl}
                    style={{
                      background: copiedJoinUrl ? "#2cc075" : "#6a4c93",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "10px",
                      padding: "5px 12px",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(106, 76, 147, 0.25)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {copiedJoinUrl ? "Copied! ✓" : "Copy Join URL 📋"}
                  </button>
                </div>
              </div>
            ) : (
              <p>Create an event to get a 6-digit room code and player join link</p>
            )}

            {/* Metric Tiles: Status & Round, Setup & Images, Player Counts */}
            <div className="admin-tiles-grid">
              <div className="admin-tile">
                <span className="admin-tile-label">🎮 Game Status</span>
                <div className="admin-tile-value">
                  <span className={`badge ${eventStatus === "in_round" ? "badge-mint" : "badge-neutral"}`} style={{ textTransform: "uppercase" }}>
                    {eventStatus}
                  </span>
                </div>
                <span className="admin-tile-detail">Current round: <strong>{activeRound || "—"}</strong></span>
              </div>

              <div className="admin-tile">
                <span className="admin-tile-label">🖼️ Image Setup</span>
                <div className="admin-tile-value">
                  <span className={`badge ${hasAllRoundImages ? "badge-mint" : hasRoundOneImage ? "badge-neutral" : "badge-amber"}`}>
                    {uploadedRounds.length} / 5 Ready
                  </span>
                </div>
                <span className="admin-tile-detail">
                  Round 1: <strong>{hasRoundOneImage ? "Uploaded ✓" : "Missing ✕"}</strong> • {hasAllRoundImages ? "All 5 ready" : "Incomplete"}
                </span>
              </div>

              <div className="admin-tile">
                <span className="admin-tile-label">👥 Player Counts</span>
                <div className="admin-tile-value">
                  <span className="badge badge-mint" style={{ fontSize: "1.05rem" }}>
                    {players.length} Players
                  </span>
                </div>
                <span className="admin-tile-detail">
                  <strong>{players.filter((p) => p.connected).length}</strong> Online • <strong>{players.filter((p) => !p.connected).length}</strong> Offline
                </span>
              </div>
            </div>

            {!canStartRoundOne && activeRound === 0 ? (
              <p className="error" style={{ fontSize: "0.85rem" }}>To start: log in, create or open an event, and successfully upload the Round 1 image.</p>
            ) : null}
            {!canAdvanceRound && activeRound > 0 && activeRound < 5 ? (
              <p className="muted" style={{ fontSize: "0.85rem" }}>Advance is enabled only after next round image upload.</p>
            ) : null}
          </div>

          {/* 2. Round Settings Card */}
          <div className="clay-panel">
            <h2>Round Settings</h2>
            <p className="muted">Selecting a file is not confirmation of upload. Wait for "Upload complete" and the round to show "uploaded".</p>
            <p id="image-guidance" className="muted">Aim for about 300 pixels per piece. Landscape and portrait images keep their original proportions; square sizes below are recommendations, not requirements. PNG, JPEG or WebP; up to 5 MB per image. JPEG or WebP works well for large photos.</p>
            <div className="upload-grid">
              {ROUND_CONFIG.map(({ round, grid }) => {
                const currentGrid = roundGrids[round] || grid;
                const recSize = currentGrid * 300;
                const isUploaded = uploadedRounds.includes(round);
                const previewSrc = previewUrls[round] || (isUploaded && activeEventId ? `${API_BASE || ""}/api/events/${activeEventId}/rounds/${round}/image` : null);

                return (
                  <div key={round} className="upload-card">
                    <div className="round-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Round {round}</span>
                        <select
                          className="clay-select"
                          aria-label={`Round ${round} pieces`}
                          value={currentGrid}
                          onChange={async (e) => {
                            const newGrid = Number(e.target.value);
                            setRoundGrids((prev) => ({ ...prev, [round]: newGrid }));
                            if (activeEventId && isAuthed) {
                              try {
                                await api.patch(`/events/${activeEventId}/rounds/${round}/grid`, { grid: newGrid });
                              } catch {
                                // non-blocking
                              }
                            }
                          }}
                        >
                          <option value={2}>2x2 (4 pieces)</option>
                          <option value={3}>3x3 (9 pieces)</option>
                          <option value={4}>4x4 (16 pieces)</option>
                          <option value={5}>5x5 (25 pieces)</option>
                          <option value={6}>6x6 (36 pieces)</option>
                          <option value={7}>7x7 (49 pieces)</option>
                          <option value={8}>8x8 (64 pieces)</option>
                        </select>
                      </div>
                      <span className={`badge ${isUploaded ? "badge-mint" : "badge-neutral"}`} style={{ fontSize: "0.75rem" }}>
                        {isUploaded ? "uploaded" : "missing"}
                      </span>
                    </div>

                    {previewSrc ? (
                      <div className="round-image-preview-wrap">
                        <img
                          src={previewSrc}
                          alt={`Round ${round} preview`}
                          className="round-image-preview"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <span className="round-preview-badge">✓ Preview</span>
                      </div>
                    ) : null}

                    <p id={`round-${round}-image-size`} className="muted">Recommended square size: {recSize} x {recSize} px</p>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      aria-label={`Round ${round} image`}
                      aria-describedby={`image-guidance round-${round}-image-size`}
                      disabled={!canControlRounds || uploadMessages[round] === "Uploading..."}
                      onChange={async (e) => {
                        const input = e.target;
                        await uploadRound(round, input.files?.[0]);
                        input.value = "";
                      }}
                    />
                    {uploadMessages[round] ? (
                      <p role="status" className={uploadMessages[round].startsWith("Upload failed:") ? "error" : ""}>
                        {uploadMessages[round]}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Timer Settings Accordion */}
          <div className="clay-panel accordion-panel">
            <button
              type="button"
              className="accordion-header"
              onClick={() => setIsTimersOpen((prev) => !prev)}
              aria-expanded={isTimersOpen}
            >
              <div className="accordion-title-wrap">
                <span className="accordion-icon">⏱️</span>
                <h2>Timer Settings</h2>
                <span className="badge badge-neutral" style={{ fontSize: "0.85rem" }}>
                  {leaderboardSeconds}s Pause • 5 Rounds
                </span>
              </div>
              <span className={`accordion-chevron ${isTimersOpen ? "open" : ""}`}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            <div className="accordion-body" style={{ display: isTimersOpen ? "block" : "none" }}>
              <form onSubmit={saveTimers} className="settings-form">
                {ROUND_CONFIG.map(({ round, grid }, index) => (
                  <div className="field" key={round}>
                    <label htmlFor={`round-${round}-seconds`}>Round {round} duration (seconds, 60-1800)</label>
                    <input
                      id={`round-${round}-seconds`}
                      type="number"
                      value={roundSecondsByRound[index]}
                      onChange={(e) => setRoundSecondsByRound((current) =>
                        current.map((value, i) => i === index ? e.target.value : value))}
                      min={60}
                      max={1800}
                      required
                    />
                    <span className="muted">{(roundGrids[round] || grid)}x{(roundGrids[round] || grid)} puzzle</span>
                  </div>
                ))}
                <div className="field">
                  <label htmlFor="leaderboard-seconds">Leaderboard pause (seconds, 5-120)</label>
                  <input
                    id="leaderboard-seconds"
                    type="number"
                    value={leaderboardSeconds}
                    onChange={(e) => setLeaderboardSeconds(e.target.value)}
                    min={5}
                    max={120}
                    required
                    placeholder="Leaderboard seconds"
                  />
                </div>
                <button type="submit" disabled={!isAuthed || !activeEventId}>Save Timer Settings</button>
                <p>Each round uses its saved duration when it next starts. Running countdowns and already scheduled leaderboard pauses stay unchanged. Create Event uses the values above.</p>
              </form>
            </div>
          </div>
        </div>

        {/* Column 2: Players */}
        <div className="admin-column-players">
          <div className="clay-panel">
            <h2>Players</h2>
            <ul className="player-list">
              {players.map((player) => (
                <li key={player.id}>
                  {player.name} | {player.connected ? "online" : "offline"} | {player.status} | moves: {player.roundState?.moves ?? 0}
                  <button type="button" onClick={() => removePlayer(player.id)}>Remove</button>
                </li>
              ))}
            </ul>
            {players.length === 0 ? <p className="muted">Your crew will appear here when they join.</p> : null}

            {activeEventId ? (
              <p>
                Export: <a href={`${API_BASE}/api/events/${activeEventId}/export-csv`} target="_blank" rel="noreferrer">Download CSV</a>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showResetConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-card">
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--lavender, #e5dcfa)", display: "grid", placeItems: "center", margin: "0 auto 16px", color: "#6a4c93" }}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </div>
            <h3 id="modal-title" style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "#2d1f47" }}>Create New Room?</h3>
            <p style={{ margin: "0 0 24px", color: "var(--muted, #666)", fontSize: "0.95rem", lineHeight: 1.5 }}>
              Current room <strong>{eventCode || activeEventId}</strong> close ho jayega aur fresh 6-digit room code create hoga.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                style={{
                  background: "#f0eaf8",
                  color: "#574478",
                  border: "none",
                  borderRadius: "14px",
                  padding: "10px 22px",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  cursor: "pointer",
                }}
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowResetConfirm(false);
                  await createEvent();
                }}
                style={{
                  background: "#6a4c93",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "14px",
                  padding: "10px 22px",
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(106, 76, 147, 0.3)",
                }}
              >
                Yes, Create New Room
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
