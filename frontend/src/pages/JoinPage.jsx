import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { useGameStore } from "../services/gameState";

export function JoinPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const setSession = useGameStore((s) => s.setSession);

  useEffect(() => {
    if (eventId) {
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
    }
  }, [eventId]);

  const handleCodeChange = (e) => {
    setError("");
    const rawDigits = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    if (rawDigits.length > 3) {
      setRoomCode(`${rawDigits.slice(0, 3)} - ${rawDigits.slice(3)}`);
    } else {
      setRoomCode(rawDigits);
    }
  };

  const onJoin = async (event) => {
    event.preventDefault();
    setIsJoining(true);
    setError("");
    try {
      let targetEventId = eventId;
      if (!targetEventId) {
        const cleanDigits = roomCode.replace(/[^0-9]/g, "");
        if (cleanDigits.length !== 6 && !roomCode.trim()) {
          throw new Error("Please enter a valid 6-digit room code (e.g. 234 - 234)");
        }
        const lookupRes = await api.get(`/events/lookup/${cleanDigits || roomCode.trim()}`);
        targetEventId = lookupRes.data.id;
      }

      const { data } = await api.post(`/events/${targetEventId}/join`, { name });
      setSession({ eventId: targetEventId, playerId: data.playerId, playerName: data.name });
      navigate(`/lobby/${targetEventId}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to join room");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <section className="page join-page centered-card">
      <div className="clay-illustration" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <p className="eyebrow">YOUR NEXT LITTLE ADVENTURE</p>
      <h1>Join Tournament</h1>
      <p className="subtitle">
        Five puzzles. Friendly competition.<br />
        A whole lot of satisfying little clicks.
      </p>

      <div className="join-badges">
        <span className="badge badge-lavender">5 rounds</span>
        <span className="badge badge-mint">2 x 2 to 6 x 6</span>
        <span className="badge badge-peach">Play together</span>
      </div>

      <form onSubmit={onJoin} className="join-form">
        <label htmlFor="room-code">Room Code</label>
        <input
          id="room-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9 -]*"
          maxLength={9}
          value={roomCode}
          onChange={handleCodeChange}
          placeholder="234 - 234"
          className="code-input-field"
          required
          autoFocus={!eventId}
          autoComplete="off"
          aria-label="6-digit room code"
        />

        <label htmlFor="player-name">What should we call you?</label>
        <input
          id="player-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Enter your name"
          maxLength={50}
          required
          autoFocus={Boolean(eventId)}
          autoComplete="nickname"
        />

        <button type="submit" disabled={isJoining}>
          {isJoining ? "Joining..." : "Join Game"}
        </button>
      </form>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="card-footer-action">
        <p className="muted">Want to spectate live?</p>
        <Link to={eventId ? `/live/${eventId}` : "/live"} className="create-room-btn">
          Watch Live 🔴 &rarr;
        </Link>
      </div>

      <div className="card-footer-action">
        <p className="muted">Hosting a tournament?</p>
        <Link to="/login" className="create-room-btn">
          Create Room &rarr;
        </Link>
      </div>
    </section>
  );
}
