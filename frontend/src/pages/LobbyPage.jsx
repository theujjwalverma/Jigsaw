import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { useGameStore } from "../services/gameState";

export function LobbyPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const status = useGameStore((s) => s.eventStatus);
  const currentRound = useGameStore((s) => s.currentRound);
  const puzzle = useGameStore((s) => s.puzzle);
  const playerId = useGameStore((s) => s.playerId);
  const sessionEventId = useGameStore((s) => s.eventId);
  const connectionError = useGameStore((s) => s.connectionError);

  useEffect(() => {
    if (!playerId || sessionEventId !== eventId) navigate(`/join/${eventId}`, { replace: true });
    else if (status === "in_round" && puzzle) {
      navigate(`/game/${eventId}/${currentRound}`);
    } else if (status === "between_rounds" || status === "finished") {
      navigate(`/leaderboard/${eventId}/${currentRound}`);
    }
  }, [status, puzzle, currentRound, eventId, playerId, sessionEventId, navigate]);

  useEffect(() => {
    api
      .get(`/events/${eventId}`)
      .then(({ data }) => {
        if (data.code) {
          const rawDigits = data.code.replace(/[^0-9]/g, "");
          if (rawDigits.length > 3) {
            setRoomCode(`${rawDigits.slice(0, 3)} - ${rawDigits.slice(3)}`);
          } else {
            setRoomCode(data.code);
          }
        }
      })
      .catch(() => {});
  }, [eventId]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/events/${eventId}/players`);
        setPlayers(data);
        setError("");
      } catch (err) {
        setError(err.response?.data?.error || "Unable to load lobby players.");
      }
    };

    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [eventId]);

  return (
    <section className="page lobby-page centered-card">
      <p className="eyebrow">THE GATHERING SPOT</p>
      <h1>Lobby</h1>

      {roomCode ? (
        <div className="lobby-room-code-badge">
          <span className="room-code-label">ROOM CODE</span>
          <strong className="room-code-number">{roomCode}</strong>
        </div>
      ) : null}

      {error || connectionError ? <p role="alert" className="error">{error || connectionError}</p> : null}

      <div className="lobby-banner clay-panel">
        <span className="waiting-orb" aria-hidden="true" />
        <div>
          <h2>{status === "lobby" ? "You're in. Get comfy!" : "The challenge is on!"}</h2>
          <p>{status === "lobby" ? "Waiting for admin to start..." : "Game in progress"}</p>
        </div>
      </div>

      <div className="panel-heading">
        <h2>Your puzzle crew</h2>
        <span className="badge badge-mint">{players.filter((p) => p.connected).length} online</span>
      </div>

      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id}>
            <span className="player-avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
            <strong>{p.name}</strong>
            <span className={`badge ${p.connected ? "badge-mint" : "badge-neutral"}`}>{p.connected ? "online" : "offline"}</span>
          </li>
        ))}
      </ul>
      <p className="play-hint">Match image pieces to their cells. Every round brings a bigger puzzle.</p>
    </section>
  );
}
