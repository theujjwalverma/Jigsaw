import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export function HomePage() {
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCodeChange = (e) => {
    setError("");
    const rawDigits = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    if (rawDigits.length > 3) {
      setRoomCode(`${rawDigits.slice(0, 3)} - ${rawDigits.slice(3)}`);
    } else {
      setRoomCode(rawDigits);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanDigits = roomCode.replace(/[^0-9]/g, "");
    if (cleanDigits.length !== 6) {
      setError("Please enter a valid 6-digit room code (e.g. 234 - 234)");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/events/lookup/${cleanDigits}`);
      navigate(data.joinUrl || `/join/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Tournament room not found. Check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page home-page">
      <div className="clay-illustration" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="home-top-bar">
        <p className="eyebrow">LIVE JIGSAW TOURNAMENT</p>
        <Link to="/login" className="btn-link-style create-room-btn">
          Create Room &rarr;
        </Link>
      </div>

      <h1>Join Tournament</h1>
      <p className="subtitle">
        Enter the 6-digit room code provided by your host to jump straight into the challenge.
      </p>

      <form onSubmit={handleJoin} className="code-entry-form">
        <label htmlFor="room-code">Room Code</label>
        <div className="code-input-wrapper">
          <input
            id="room-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9 -]*"
            maxLength={9}
            value={roomCode}
            onChange={handleCodeChange}
            placeholder="234 - 234"
            className="room-code-input"
            autoFocus
            autoComplete="off"
            aria-label="6-digit room code"
          />
          <button type="submit" disabled={isLoading || roomCode.replace(/[^0-9]/g, "").length !== 6}>
            {isLoading ? "Checking..." : "Join Game"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="home-footer-card">
        <span>Want to organize your own puzzle competition?</span>{" "}
        <Link to="/login" className="accent-link">
          Create Room as Host
        </Link>
      </div>
    </section>
  );
}
