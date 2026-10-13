import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { useGameStore } from "../services/gameState";

export function JoinPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const setSession = useGameStore((s) => s.setSession);

  const onJoin = async (event) => {
    event.preventDefault();
    setIsJoining(true);
    setError("");
    try {
      const { data } = await api.post(`/events/${eventId}/join`, { name });
      setSession({ eventId, playerId: data.playerId, playerName: data.name });
      navigate(`/lobby/${eventId}`);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to join");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <section className="page join-page">
      <div className="clay-illustration" aria-hidden="true"><span /><span /><span /><span /></div>
      <p className="eyebrow">YOUR NEXT LITTLE ADVENTURE</p>
      <h1>Join Tournament</h1>
      <p className="subtitle">Five puzzles. Friendly competition.<br />A whole lot of satisfying little clicks.</p>
      <div className="join-badges"><span className="badge badge-lavender">5 rounds</span><span className="badge badge-mint">2 x 2 to 6 x 6</span><span className="badge badge-peach">Play together</span></div>
      <form onSubmit={onJoin} className="join-form">
      <label htmlFor="player-name">What should we call you?</label>
      <input
        id="player-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        maxLength={50}
        required
        autoComplete="nickname"
      />
      <button type="submit" disabled={isJoining}>{isJoining ? "Joining..." : "Join Game"}</button>
      </form>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <p className="muted">Join the lobby, settle in, and wait for your host to start.</p>
    </section>
  );
}
